import dotenv from 'dotenv';
import * as readline from 'readline';
import { DiscoveryService } from './discovery';
import { RailwayProvisioningService } from './railway';
import { NeonProvisioningService } from './neon';
import { VercelProvisioningService } from './vercel';
import { ProjectType, ProjectBlueprint } from '../types';

// Load environment variables
dotenv.config();

/**
 * Progress callback type for deployment updates
 */
export type ProgressCallback = (step: {
  step: number;
  total: number;
  message: string;
  platform: 'neon' | 'railway' | 'vercel' | 'system';
  timestamp: number;
  completed?: boolean;
}) => void;

/**
 * Unified Deployment Orchestrator
 * Coordinates discovery and provisioning across multiple platforms
 */
export class Orchestrator {
  private discoveryService: DiscoveryService;
  private railwayProvisioning: RailwayProvisioningService;
  private neonProvisioning: NeonProvisioningService;
  private vercelProvisioning: VercelProvisioningService;
  private dryRun: boolean;

  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun;
    
    const railwayApiKey = process.env.RAILWAY_API_KEY;
    const neonApiKey = process.env.NEON_API_KEY;
    const vercelToken = process.env.VERCEL_TOKEN;
    
    // Only require API keys if not in dry-run mode
    if (!dryRun) {
      if (!railwayApiKey) {
        throw new Error('RAILWAY_API_KEY is required in environment variables');
      }
      if (!neonApiKey) {
        throw new Error('NEON_API_KEY is required in environment variables');
      }
      if (!vercelToken) {
        throw new Error('VERCEL_TOKEN is required in environment variables');
      }
    }

    this.discoveryService = new DiscoveryService();
    this.railwayProvisioning = new RailwayProvisioningService(railwayApiKey || '', dryRun);
    this.neonProvisioning = new NeonProvisioningService(neonApiKey || '', dryRun);
    this.vercelProvisioning = new VercelProvisioningService(vercelToken || '', dryRun);
  }

  /**
   * Extracts GitHub repository information from a URL or path
   * @param repoPath - Repository path or URL
   * @returns GitHub repo in format "owner/repo" or null if not a GitHub URL
   */
  private extractGitHubRepo(repoPath: string): string | null {
    // Check if it's a GitHub URL
    const githubUrlPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/;
    const match = repoPath.match(githubUrlPattern);
    
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');
      return `${owner}/${repo}`;
    }

    return null;
  }

  /**
   * Prompts user for confirmation before real deployment
   * @returns Promise<boolean> - true if user confirms
   */
  private async confirmDeployment(): Promise<boolean> {
    if (this.dryRun) {
      return true; // No confirmation needed for dry-run
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      console.log('\n⚠️  WARNING: This is a REAL deployment!');
      console.log('I am about to create 3 real projects on your accounts:');
      console.log('  1. Neon (Database)');
      console.log('  2. Railway (Backend)');
      console.log('  3. Vercel (Frontend)');
      console.log('\nType "CONFIRM" to proceed, or anything else to cancel:');

      rl.question('> ', (answer) => {
        rl.close();
        const confirmed = answer.trim().toUpperCase() === 'CONFIRM';
        if (!confirmed) {
          console.log('\n❌ Deployment cancelled by user.');
        }
        resolve(confirmed);
      });
    });
  }

  /**
   * Resource tracking for rollback
   */
  private trackedResources: Array<{
    platform: 'neon' | 'railway' | 'vercel';
    type: 'project' | 'service';
    id: string;
    name?: string;
  }> = [];

  /**
   * Rollback function - deletes all created resources in reverse order
   * @param errorMessage - The error message that triggered the rollback
   * @param progressCallback - Optional callback for rollback progress
   */
  private async rollback(errorMessage: string, progressCallback?: ProgressCallback): Promise<void> {
    const sendRollbackProgress = (message: string, platform: 'neon' | 'railway' | 'vercel' | 'system') => {
      if (progressCallback) {
        progressCallback({
          step: 0,
          total: this.trackedResources.length + 1,
          message,
          platform,
          timestamp: Date.now(),
          completed: false,
        });
      }
      // Log rollback messages
      if (!progressCallback) {
        console.log(`[ROLLBACK] ${message}`);
      }
    };

    // Send error event with human-readable explanation
    const humanReadableError = `Deployment failed: ${errorMessage}. Initiating automatic rollback to clean up all created resources and prevent charges.`;
    sendRollbackProgress(humanReadableError, 'system');

    // Delete resources in reverse order
    for (let i = this.trackedResources.length - 1; i >= 0; i--) {
      const resource = this.trackedResources[i];
      
      try {
        if (resource.platform === 'neon' && resource.type === 'project') {
          sendRollbackProgress(`Deleting Neon project: ${resource.name || resource.id}`, 'neon');
          await this.neonProvisioning.deleteProject(resource.id);
          sendRollbackProgress(`Neon project deleted successfully`, 'neon');
        } else if (resource.platform === 'railway') {
          if (resource.type === 'service') {
            sendRollbackProgress(`Deleting Railway service: ${resource.name || resource.id}`, 'railway');
            await this.railwayProvisioning.deleteService(resource.id);
            sendRollbackProgress(`Railway service deleted successfully`, 'railway');
          } else if (resource.type === 'project') {
            sendRollbackProgress(`Deleting Railway project: ${resource.name || resource.id}`, 'railway');
            await this.railwayProvisioning.deleteProject(resource.id);
            sendRollbackProgress(`Railway project deleted successfully`, 'railway');
          }
        } else if (resource.platform === 'vercel' && resource.type === 'project') {
          sendRollbackProgress(`Deleting Vercel project: ${resource.name || resource.id}`, 'vercel');
          await this.vercelProvisioning.deleteProject(resource.id);
          sendRollbackProgress(`Vercel project deleted successfully`, 'vercel');
        }
      } catch (rollbackError: any) {
        const errorMsg = `Failed to delete ${resource.platform} ${resource.type}: ${rollbackError.message}`;
        sendRollbackProgress(errorMsg, resource.platform);
        console.error(`[ROLLBACK ERROR] ${errorMsg}`, rollbackError);
        // Continue with other resources even if one fails
      }
    }

    // Clear tracked resources
    this.trackedResources = [];
    sendRollbackProgress('Rollback completed. All resources cleaned up.', 'system');
  }

  /**
   * Track a created resource for potential rollback
   */
  private trackResource(
    platform: 'neon' | 'railway' | 'vercel',
    type: 'project' | 'service',
    id: string,
    name?: string
  ): void {
    this.trackedResources.push({ platform, type, id, name });
  }

  /**
   * Orchestrates the full trinity deployment (Neon → Railway → Vercel)
   * @param repoPath - Local path or Git URL to the repository
   * @param projectName - Optional custom project name (defaults to repo name)
   * @param serviceName - Optional custom service name (defaults to repo name)
   * @param environmentVariables - Optional additional environment variables
   * @param progressCallback - Optional callback for progress updates
   * @returns Promise with deployment information
   */
  async deployFullTrinity(
    repoPath: string,
    projectName?: string,
    serviceName?: string,
    environmentVariables?: Record<string, string>,
    progressCallback?: ProgressCallback
  ): Promise<{
    blueprint: ProjectBlueprint;
    deployments: {
      neon?: { projectId: string; databaseUrl: string };
      railway?: { projectId: string; serviceId: string; url?: string };
      vercel?: { projectId: string; projectUrl: string };
    };
  }> {
    // Clear any previously tracked resources
    this.trackedResources = [];
    
    const totalSteps = 11;
    let currentStep = 0;

    const sendProgress = (message: string, platform: 'neon' | 'railway' | 'vercel' | 'system', completed = false) => {
      currentStep++;
      if (progressCallback) {
        progressCallback({
          step: currentStep,
          total: totalSteps,
          message,
          platform,
          timestamp: Date.now(),
          completed,
        });
      }
      // Log to console for CLI usage (only if no callback provided)
      if (!progressCallback) {
        console.log(`[${platform.toUpperCase()}] ${message}`);
      }
    };

    try {
      sendProgress('Starting Full Trinity Deployment Orchestration', 'system');
    sendProgress(`Repository: ${repoPath}`, 'system');

    // Step 1: Discover project type
    sendProgress('Discovering project type...', 'system');
    const blueprint = await this.discoveryService.scanRepository(repoPath);
    
    sendProgress(
      `Detected: ${blueprint.type.toUpperCase()} (${(blueprint.confidence * 100).toFixed(1)}% confidence, ${blueprint.indicators.length} indicators)`,
      'system'
    );

    // Step 2: User confirmation for real deployments (Full Trinity only)
    // Skip confirmation when progressCallback is provided (API mode)
    // Only prompt in CLI mode when no callback is provided
    if (!this.dryRun && !progressCallback) {
      const confirmed = await this.confirmDeployment();
      if (!confirmed) {
        throw new Error('Deployment cancelled by user');
      }
    }

    // Extract GitHub repository information
    const githubRepo = this.extractGitHubRepo(repoPath);
    if (!githubRepo) {
      throw new Error(
        'GitHub repository URL is required for full trinity deployment. ' +
        'Please provide a GitHub URL (e.g., https://github.com/owner/repo)'
      );
    }

    // Generate project and service names if not provided
    const baseName = projectName || this.generateNameFromRepo(githubRepo);
    const finalServiceName = serviceName || baseName;

    const deployments: any = {};

    // Step 3: Deploy Neon (Database) - FIRST
    sendProgress('Deploying to Neon (Database)', 'neon');
    sendProgress('Creating Neon database project...', 'neon');
    const neonResult = await this.neonProvisioning.provisionDatabase(`${baseName}-db`);
    // Track resource for rollback
    this.trackResource('neon', 'project', neonResult.projectId, neonResult.projectName);
    sendProgress('Neon database created successfully', 'neon', true);
    sendProgress('DATABASE_URL retrieved', 'neon', true);
    deployments.neon = {
      projectId: neonResult.projectId,
      databaseUrl: neonResult.databaseUrl,
    };

    // Step 4: Deploy Railway (Backend) - SECOND (with DATABASE_URL)
    sendProgress('Deploying to Railway (Backend)', 'railway');
    sendProgress('Creating Railway backend project...', 'railway');
    
    // Merge DATABASE_URL from Neon with any provided environment variables
    const railwayEnvVars = {
      DATABASE_URL: neonResult.databaseUrl,
      ...environmentVariables,
    };

    const branch = this.extractBranchFromUrl(repoPath) || 'main';
    sendProgress('Connecting GitHub repository...', 'railway');
    
    // Check if this is a Streamlit app
    const isStreamlit = blueprint.metadata?.isStreamlit === true;
    if (isStreamlit) {
      sendProgress('Detected Streamlit app - applying Railway Streamlit optimizer...', 'railway');
    }
    
    sendProgress('Setting environment variables...', 'railway');
    const railwayResult = await this.railwayProvisioning.provisionBackend(
      `${baseName}-backend`,
      finalServiceName,
      githubRepo,
      branch,
      railwayEnvVars,
      isStreamlit // Pass Streamlit flag to Railway service
    );
    // Track resources for rollback (both project and service)
    this.trackResource('railway', 'project', railwayResult.projectId, railwayResult.projectName);
    this.trackResource('railway', 'service', railwayResult.serviceId, railwayResult.serviceName);
    sendProgress('Railway backend deployed successfully', 'railway', true);
    deployments.railway = {
      projectId: railwayResult.projectId,
      serviceId: railwayResult.serviceId,
    };

    // Get Railway service URL (if available)
    // Note: Railway URLs are typically available after deployment
    // For now, we'll construct a potential URL
    if (!this.dryRun) {
      deployments.railway.url = `https://${railwayResult.serviceName}.railway.app`;
    }

    // Step 5: Deploy Vercel (Frontend) - THIRD (with Railway URL)
    sendProgress('Deploying to Vercel (Frontend)', 'vercel');
    sendProgress('Creating Vercel frontend project...', 'vercel');

    // Prepare Vercel environment variables with Railway URL
    const vercelEnvVars: Record<string, string> = {
      NEXT_PUBLIC_API_URL: deployments.railway.url || 'https://api.example.com',
      ...environmentVariables,
    };

    sendProgress('Connecting GitHub repository...', 'vercel');
    sendProgress('Setting environment variables (NEXT_PUBLIC_API_URL)...', 'vercel');
    const vercelResult = await this.vercelProvisioning.provisionFrontend(
      `${baseName}-frontend`,
      githubRepo,
      vercelEnvVars
    );
    // Track resource for rollback
    this.trackResource('vercel', 'project', vercelResult.projectId, vercelResult.projectName);
    sendProgress('Vercel frontend deployed successfully', 'vercel', true);
    deployments.vercel = {
      projectId: vercelResult.projectId,
      projectUrl: vercelResult.projectUrl,
    };

    sendProgress('All deployments completed!', 'system', true);

    // Clear tracked resources on success (no rollback needed)
    this.trackedResources = [];

    return {
      blueprint,
      deployments,
    };
    } catch (error: any) {
      // Error occurred during deployment - trigger rollback
      const errorMessage = error.message || 'Unknown error occurred during deployment';
      
      sendProgress(`❌ Deployment failed: ${errorMessage}`, 'system');
      sendProgress('Initiating rollback to clean up created resources...', 'system');
      
      // Perform rollback
      await this.rollback(errorMessage, progressCallback);
      
      // Re-throw error with rollback context
      throw new Error(`Deployment failed: ${errorMessage}. Rollback completed - all created resources have been cleaned up.`);
    }
  }

  /**
   * Orchestrates the deployment process for a repository (single platform)
   * @param repoPath - Local path or Git URL to the repository
   * @param projectName - Optional custom project name (defaults to repo name)
   * @param serviceName - Optional custom service name (defaults to repo name)
   * @param environmentVariables - Optional environment variables to set
   * @returns Promise with deployment information
   */
  async deploy(
    repoPath: string,
    projectName?: string,
    serviceName?: string,
    environmentVariables?: Record<string, string>
  ): Promise<{
    blueprint: ProjectBlueprint;
    deployment?: {
      platform: string;
      projectId?: string;
      serviceId?: string;
      projectName?: string;
      serviceName?: string;
    };
  }> {
    // Step 1: Discover project type
    const blueprint = await this.discoveryService.scanRepository(repoPath);

    // Step 2: Route to appropriate platform based on project type
    let deployment;

    switch (blueprint.type) {
      case ProjectType.BACKEND:
        deployment = await this.deployToRailway(
          repoPath,
          blueprint,
          projectName,
          serviceName,
          environmentVariables
        );
        break;

      case ProjectType.FRONTEND:
        deployment = await this.deployToVercel(
          repoPath,
          blueprint,
          projectName,
          environmentVariables
        );
        break;

      case ProjectType.DATABASE:
        deployment = await this.deployToNeon(
          repoPath,
          blueprint,
          projectName
        );
        break;

      default:
        throw new Error(`Cannot deploy project of type: ${blueprint.type}`);
    }

    return {
      blueprint,
      deployment,
    };
  }

  /**
   * Deploys a backend project to Railway
   * @param repoPath - Repository path or URL
   * @param blueprint - Project blueprint from discovery
   * @param projectName - Optional custom project name
   * @param serviceName - Optional custom service name
   * @param environmentVariables - Optional environment variables
   * @returns Deployment information
   */
  private async deployToRailway(
    repoPath: string,
    blueprint: ProjectBlueprint,
    projectName?: string,
    serviceName?: string,
    environmentVariables?: Record<string, string>
  ): Promise<{
    platform: string;
    projectId: string;
    serviceId: string;
    projectName: string;
    serviceName: string;
  }> {
    // Extract GitHub repository information
    const githubRepo = this.extractGitHubRepo(repoPath);
    
    if (!githubRepo) {
      throw new Error(
        'GitHub repository URL is required for Railway deployment. ' +
        'Please provide a GitHub URL (e.g., https://github.com/owner/repo)'
      );
    }

    // Generate project and service names if not provided
    const finalProjectName = projectName || this.generateNameFromRepo(githubRepo);
    const finalServiceName = serviceName || this.generateNameFromRepo(githubRepo);

    // Extract branch from URL if specified, otherwise default to 'main'
    const branch = this.extractBranchFromUrl(repoPath) || 'main';

    // Check if this is a Streamlit app
    const isStreamlit = blueprint.metadata?.isStreamlit === true;

    // Provision on Railway with Streamlit optimization if applicable
    const result = await this.railwayProvisioning.provisionBackend(
      finalProjectName,
      finalServiceName,
      githubRepo,
      branch,
      environmentVariables,
      isStreamlit // Pass Streamlit detection flag
    );

    return {
      platform: 'railway',
      ...result,
    };
  }

  /**
   * Deploys a frontend project to Vercel
   * @param repoPath - Repository path or URL
   * @param blueprint - Project blueprint from discovery
   * @param projectName - Optional custom project name
   * @param environmentVariables - Optional environment variables
   * @returns Deployment information
   */
  private async deployToVercel(
    repoPath: string,
    blueprint: ProjectBlueprint,
    projectName?: string,
    environmentVariables?: Record<string, string>
  ): Promise<{
    platform: string;
    projectId: string;
    projectName: string;
    projectUrl: string;
  }> {
    // Extract GitHub repository information
    const githubRepo = this.extractGitHubRepo(repoPath);
    
    if (!githubRepo) {
      throw new Error(
        'GitHub repository URL is required for Vercel deployment. ' +
        'Please provide a GitHub URL (e.g., https://github.com/owner/repo)'
      );
    }

    // Generate project name if not provided
    const finalProjectName = projectName || this.generateNameFromRepo(githubRepo);

    // Provision on Vercel
    const result = await this.vercelProvisioning.provisionFrontend(
      finalProjectName,
      githubRepo,
      environmentVariables
    );

    return {
      platform: 'vercel',
      ...result,
    };
  }

  /**
   * Deploys a database project to Neon
   * @param repoPath - Repository path or URL
   * @param blueprint - Project blueprint from discovery
   * @param projectName - Optional custom project name
   * @returns Deployment information
   */
  private async deployToNeon(
    repoPath: string,
    blueprint: ProjectBlueprint,
    projectName?: string
  ): Promise<{
    platform: string;
    projectId: string;
    projectName: string;
    databaseUrl: string;
  }> {
    // Extract GitHub repository information for naming
    const githubRepo = this.extractGitHubRepo(repoPath);
    const finalProjectName = projectName || (githubRepo ? this.generateNameFromRepo(githubRepo) : 'neon-database');

    // Provision on Neon
    const result = await this.neonProvisioning.provisionDatabase(finalProjectName);

    return {
      platform: 'neon',
      ...result,
    };
  }

  /**
   * Generates a project/service name from a GitHub repository
   * @param githubRepo - GitHub repo in format "owner/repo"
   * @returns Generated name
   */
  private generateNameFromRepo(githubRepo: string): string {
    const parts = githubRepo.split('/');
    const repoName = parts[parts.length - 1];
    // Convert kebab-case or snake_case to a readable name
    return repoName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  /**
   * Extracts branch name from a GitHub URL if specified
   * @param url - GitHub URL
   * @returns Branch name or null
   */
  private extractBranchFromUrl(url: string): string | null {
    const branchMatch = url.match(/[#&]branch=([^&]+)/);
    return branchMatch ? branchMatch[1] : null;
  }
}
