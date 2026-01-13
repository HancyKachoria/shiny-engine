import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DiscoveryService } from '../src/services/discovery';
import { Orchestrator, ProgressCallback } from '../src/services/orchestrator';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/analyze
 * Analyzes a GitHub repository and returns the project blueprint
 */
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { githubUrl } = req.body;

    if (!githubUrl || typeof githubUrl !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid githubUrl in request body',
      });
    }

    // Validate GitHub URL format
    const githubUrlPattern = /^https?:\/\/github\.com\/[^\/]+\/[^\/]+/;
    if (!githubUrlPattern.test(githubUrl)) {
      return res.status(400).json({
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
      });
    }

    const discoveryService = new DiscoveryService();
    const blueprint = await discoveryService.scanRepository(githubUrl);

    // Transform to frontend-friendly format
    const response = {
      type: blueprint.type,
      confidence: blueprint.confidence,
      indicators: blueprint.indicators,
      metadata: blueprint.metadata || {},
    };

    res.json(response);
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze repository',
      message: error.message,
    });
  }
});

/**
 * Helper function to extract GitHub repo from URL
 */
function extractGitHubRepo(url: string): string | null {
  const githubUrlPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/;
  const match = url.match(githubUrlPattern);
  if (match) {
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    return `${owner}/${repo}`;
  }
  return null;
}

/**
 * Helper function to generate name from repo
 */
function generateNameFromRepo(githubRepo: string): string {
  const parts = githubRepo.split('/');
  const repoName = parts[parts.length - 1];
  return repoName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * GET /api/deploy
 * Deploys using the orchestrator with Server-Sent Events for real-time updates
 * Uses GET with query parameters to support EventSource
 */
app.get('/api/deploy', async (req: Request, res: Response) => {
  try {
    const { githubUrl, projectName, serviceName, fullTrinity, dryRun } = req.query;
    
    // Decode URL parameters
    const decodedGithubUrl = githubUrl ? decodeURIComponent(githubUrl as string) : '';
    const decodedProjectName = projectName ? decodeURIComponent(projectName as string) : undefined;
    const decodedServiceName = serviceName ? decodeURIComponent(serviceName as string) : undefined;
    const isFullTrinity = fullTrinity === 'true';
    const isDryRun = dryRun === 'true';

    if (!decodedGithubUrl || decodedGithubUrl === '') {
      return res.status(400).json({
        error: 'Missing or invalid githubUrl in query parameters',
      });
    }

    // Validate GitHub URL format
    const githubUrlPattern = /^https?:\/\/github\.com\/[^\/]+\/[^\/]+/;
    if (!githubUrlPattern.test(decodedGithubUrl)) {
      return res.status(400).json({
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
      });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (isFullTrinity) {
        // Full Trinity deployment using orchestrator with progress callback
        const orchestrator = new Orchestrator(isDryRun);

        // Progress callback that sends SSE events
        const progressCallback: ProgressCallback = (progress) => {
          sendEvent('progress', progress);
        };

        // Deploy with progress callback
        const result = await orchestrator.deployFullTrinity(
          decodedGithubUrl,
          decodedProjectName,
          decodedServiceName,
          undefined, // environmentVariables
          progressCallback
        );

        // Send completion event
        sendEvent('complete', {
          success: true,
          deployments: result.deployments,
        });
        
        // Send close event after completion
        sendEvent('close', { message: 'Deployment completed successfully' });
      } else {
        // Single platform deployment
        const orchestrator = new Orchestrator(isDryRun);

        sendEvent('progress', {
          step: 0,
          total: 5,
          message: 'Starting deployment...',
          platform: 'system',
          timestamp: Date.now(),
        });

        const result = await orchestrator.deploy(
          decodedGithubUrl,
          decodedProjectName,
          decodedServiceName
        );

        sendEvent('progress', {
          step: 1,
          total: 5,
          message: `Deploying to ${result.deployment?.platform}...`,
          platform: result.deployment?.platform || 'system',
          timestamp: Date.now(),
        });

        sendEvent('complete', {
          success: true,
          deployment: result.deployment,
        });
        
        // Send close event
        sendEvent('close', { message: 'Deployment completed' });
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      
      // Parse error message to extract rollback information
      const errorMessage = error.message || 'Deployment failed';
      const isRollbackComplete = errorMessage.includes('Rollback completed');
      
      // Send error event with human-readable message
      sendEvent('error', {
        message: errorMessage,
        rollbackCompleted: isRollbackComplete,
        humanReadable: isRollbackComplete 
          ? errorMessage
          : `Deployment failed: ${errorMessage}. Automatic rollback initiated to clean up created resources.`,
        timestamp: Date.now(),
      });
      
      // Send close event
      sendEvent('close', { 
        message: isRollbackComplete 
          ? 'Connection closed. Rollback completed successfully.'
          : 'Connection closed due to error' 
      });
    } finally {
      // Ensure connection is closed
      res.write('event: close\ndata: {"message": "Connection closed"}\n\n');
      res.end();
    }
  } catch (error: any) {
    console.error('Request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
