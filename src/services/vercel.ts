import { Vercel } from '@vercel/sdk';

/**
 * Vercel Provisioning Service
 * Handles frontend project creation and environment variable management
 */
export class VercelProvisioningService {
  private client: Vercel;
  private apiToken: string;
  private dryRun: boolean;

  constructor(apiToken: string, dryRun: boolean = false) {
    this.apiToken = apiToken;
    this.dryRun = dryRun;
    this.client = new Vercel({ bearerToken: apiToken });
  }

  /**
   * Creates a new Vercel project
   * @param name - Name of the project
   * @param gitRepository - Optional GitHub repository in format "owner/repo"
   * @returns Promise with project ID and name
   */
  async createProject(
    name: string,
    gitRepository?: { type: 'github'; repo: string; productionBranch?: string }
  ): Promise<{ id: string; name: string }> {
    if (this.dryRun) {
      const mockId = `dry-run-vercel-project-${Date.now()}`;
      console.log(`   [DRY RUN] Would create Vercel project: ${name} (ID: ${mockId})`);
      if (gitRepository) {
        console.log(`   [DRY RUN] Would connect GitHub: ${gitRepository.repo}`);
      }
      return {
        id: mockId,
        name: name,
      };
    }

    try {
      const projectData: any = {
        name: name,
      };

      // Add Git repository if provided
      if (gitRepository) {
        projectData.gitRepository = {
          type: gitRepository.type,
          repo: gitRepository.repo,
        };
        if (gitRepository.productionBranch) {
          projectData.productionBranch = gitRepository.productionBranch;
        }
      }

      const project = await this.client.projects.createProject({
        requestBody: projectData,
      });

      return {
        id: project.id || project.name, // Vercel uses name as identifier
        name: project.name,
      };
    } catch (error: any) {
      console.error('Failed to create Vercel project:', error.message || error);
      throw error;
    }
  }

  /**
   * Adds environment variables to a Vercel project
   * @param projectIdOrName - Project ID or name
   * @param variables - Object with key-value pairs of environment variables
   * @param targets - Environments where variables should be available (default: ['production', 'preview', 'development'])
   * @returns Promise<void>
   */
  async addEnvVariables(
    projectIdOrName: string,
    variables: Record<string, string>,
    targets: ('production' | 'preview' | 'development')[] = ['production', 'preview', 'development']
  ): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would add environment variables to project ${projectIdOrName}:`);
      Object.entries(variables).forEach(([key, value]) => {
        const maskedValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
        console.log(`     ${key} = ${maskedValue} (targets: ${targets.join(', ')})`);
      });
      return;
    }

    try {
      // Convert variables object to Vercel's expected format
      const envVars = Object.entries(variables).map(([key, value]) => ({
        key: key,
        value: value,
        target: targets,
        type: 'encrypted' as const, // Use encrypted for all variables for security
      }));

      await this.client.projects.createProjectEnv({
        idOrName: projectIdOrName,
        upsert: 'true',
        requestBody: envVars,
      });
    } catch (error: any) {
      console.error('Failed to add environment variables:', error.message || error);
      throw error;
    }
  }

  /**
   * Gets the deployment URL for a project
   * @param projectIdOrName - Project ID or name
   * @returns Promise with deployment URL
   */
  async getProjectUrl(projectIdOrName: string): Promise<string> {
    if (this.dryRun) {
      const mockUrl = `https://${projectIdOrName}.vercel.app`;
      console.log(`   [DRY RUN] Would fetch project URL: ${mockUrl}`);
      return mockUrl;
    }

    try {
      // Get project details - Vercel SDK uses getProjects and filters
      const projects = await this.client.projects.getProjects({});
      const project = Array.isArray(projects) 
        ? projects.find((p: any) => p.id === projectIdOrName || p.name === projectIdOrName)
        : null;
      
      if (!project) {
        throw new Error(`Project not found: ${projectIdOrName}`);
      }

      // Vercel projects have a default domain
      if (project.targets?.production?.url) {
        return project.targets.production.url;
      }

      // Fallback to standard Vercel domain format
      return `https://${project.name}.vercel.app`;
    } catch (error: any) {
      console.error('Failed to get project URL:', error.message || error);
      throw error;
    }
  }

  /**
   * Complete provisioning flow: Creates project, connects GitHub, and sets environment variables
   * @param projectName - Name of the project
   * @param githubRepo - GitHub repository in format "owner/repo"
   * @param environmentVariables - Environment variables to set
   * @returns Promise with project information
   */
  async provisionFrontend(
    projectName: string,
    githubRepo?: string,
    environmentVariables?: Record<string, string>
  ): Promise<{
    projectId: string;
    projectName: string;
    projectUrl: string;
  }> {
    // Step 1: Create project
    const gitRepo = githubRepo
      ? {
          type: 'github' as const,
          repo: githubRepo,
          productionBranch: 'main',
        }
      : undefined;

    const project = await this.createProject(projectName, gitRepo);

    // Step 2: Set environment variables if provided
    if (environmentVariables && Object.keys(environmentVariables).length > 0) {
      await this.addEnvVariables(project.id, environmentVariables);
    }

    // Step 3: Get project URL
    const projectUrl = await this.getProjectUrl(project.id);

    return {
      projectId: project.id,
      projectName: project.name,
      projectUrl: projectUrl,
    };
  }

  /**
   * Deletes a Vercel project (rollback)
   * @param projectIdOrName - Project ID or name to delete
   * @returns Promise<void>
   */
  async deleteProject(projectIdOrName: string): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would delete Vercel project: ${projectIdOrName}`);
      return;
    }

    try {
      await this.client.projects.deleteProject({
        idOrName: projectIdOrName,
      });
    } catch (error: any) {
      console.error('Failed to delete Vercel project:', error.message || error);
      throw error;
    }
  }
}
