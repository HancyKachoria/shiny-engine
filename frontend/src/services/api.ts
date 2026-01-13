// Real API service - replaces mockApi.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DiscoveryResult {
  type: 'frontend' | 'backend' | 'database' | 'unknown';
  confidence: number;
  indicators: string[];
  metadata?: {
    framework?: string;
    runtime?: string;
    packageManager?: string;
    technologies?: string[];
  };
}

export interface DeploymentPlan {
  neon: {
    name: string;
    status: 'pending' | 'ready';
  };
  railway: {
    name: string;
    status: 'pending' | 'ready';
    databaseUrl?: string;
  };
  vercel: {
    name: string;
    status: 'pending' | 'ready';
    apiUrl?: string;
  };
}

export interface DeploymentStep {
  step: number;
  total: number;
  message: string;
  platform: 'neon' | 'railway' | 'vercel' | 'system';
  timestamp: number;
  completed?: boolean;
}

export interface DeploymentComplete {
  success: boolean;
  deployments?: {
    neon?: { projectId: string; databaseUrl: string };
    railway?: { projectId: string; serviceId: string; url?: string };
    vercel?: { projectId: string; projectUrl: string };
  };
  deployment?: {
    platform: string;
    projectId?: string;
    serviceId?: string;
    projectName?: string;
    serviceName?: string;
  };
}

class ApiService {
  /**
   * Analyzes a GitHub repository
   */
  async analyzeRepository(githubUrl: string): Promise<DiscoveryResult> {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ githubUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze repository');
    }

    return response.json();
  }

  /**
   * Gets deployment plan (generated from discovery results)
   */
  async getDeploymentPlan(githubUrl: string, _discovery: DiscoveryResult): Promise<DeploymentPlan> {
    // Generate plan from discovery results
    const repoName = githubUrl.split('/').pop()?.replace('.git', '') || 'project';
    const baseName = repoName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()).replace(/\s+/g, '');

    return {
      neon: {
        name: `${baseName}-db`,
        status: 'ready',
      },
      railway: {
        name: `${baseName}-backend`,
        status: 'ready',
      },
      vercel: {
        name: `${baseName}-frontend`,
        status: 'ready',
      },
    };
  }

  /**
   * Deploys using Server-Sent Events (EventSource) for real-time progress
   */
  async deployFullTrinity(
    githubUrl: string,
    projectName: string,
    serviceName: string,
    dryRun: boolean,
    onProgress: (step: DeploymentStep) => void,
    onComplete: (result: DeploymentComplete) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // Build query string for GET request (EventSource only supports GET)
    const params = new URLSearchParams({
      githubUrl,
      projectName,
      serviceName,
      fullTrinity: 'true',
      dryRun: dryRun.toString(),
    });

    const eventSource = new EventSource(`${API_BASE_URL}/api/deploy?${params.toString()}`);

    return new Promise((resolve, reject) => {
      eventSource.onmessage = (event) => {
        // Default message handler (if no event type specified)
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            console.log('SSE message:', data.message);
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.addEventListener('progress', (event) => {
        try {
          const step = JSON.parse(event.data) as DeploymentStep;
          onProgress(step);
        } catch (e) {
          console.error('Failed to parse progress event:', e);
        }
      });

      eventSource.addEventListener('complete', (event) => {
        try {
          const result = JSON.parse(event.data) as DeploymentComplete;
          onComplete(result);
          eventSource.close();
          resolve();
        } catch (e) {
          console.error('Failed to parse complete event:', e);
          eventSource.close();
          reject(new Error('Failed to parse completion data'));
        }
      });

      eventSource.addEventListener('error', (event: any) => {
        try {
          const errorData = JSON.parse(event.data);
          // Use human-readable message if available, otherwise use regular message
          const errorMessage = errorData.humanReadable || errorData.message || 'Deployment failed';
          const error = new Error(errorMessage);
          onError(error);
          eventSource.close();
          reject(error);
        } catch (e) {
          const error = new Error('Deployment failed');
          onError(error);
          eventSource.close();
          reject(error);
        }
      });

      eventSource.addEventListener('close', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          console.log('Connection closed:', data.message);
        } catch (e) {
          console.log('Connection closed');
        }
        eventSource.close();
        resolve();
      });

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        reject(new Error('Connection to server lost'));
      };
    });
  }
}

export const api = new ApiService();
