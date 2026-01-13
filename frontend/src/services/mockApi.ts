// Mock API service for frontend development
// This simulates the backend API calls

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
  id: string;
  platform: 'neon' | 'railway' | 'vercel';
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message: string;
  timestamp: number;
}

class MockApiService {
  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async analyzeRepository(githubUrl: string): Promise<DiscoveryResult> {
    // Simulate API delay
    await this.delay(1500);

    // Mock detection logic based on URL patterns
    const urlLower = githubUrl.toLowerCase();
    
    if (urlLower.includes('frontend') || urlLower.includes('next') || urlLower.includes('react')) {
      return {
        type: 'frontend',
        confidence: 0.95,
        indicators: ['next.config.js', 'package.json: react', 'vite.config'],
        metadata: {
          framework: 'nextjs',
          runtime: 'node',
          packageManager: 'npm',
          technologies: ['react', 'nextjs'],
        },
      };
    } else if (urlLower.includes('backend') || urlLower.includes('api') || urlLower.includes('server')) {
      return {
        type: 'backend',
        confidence: 0.92,
        indicators: ['Dockerfile', 'requirements.txt', 'package.json: express'],
        metadata: {
          framework: 'express',
          runtime: 'node',
          packageManager: 'npm',
          technologies: ['express', 'nodejs'],
        },
      };
    } else if (urlLower.includes('database') || urlLower.includes('db') || urlLower.includes('prisma')) {
      return {
        type: 'database',
        confidence: 0.88,
        indicators: ['prisma/schema.prisma', 'schema.sql'],
        metadata: {
          runtime: 'postgresql',
          technologies: ['prisma'],
        },
      };
    }

    // Default: backend
    return {
      type: 'backend',
      confidence: 0.85,
      indicators: ['Dockerfile', 'package.json'],
      metadata: {
        runtime: 'node',
        packageManager: 'npm',
      },
    };
  }

  async getDeploymentPlan(githubUrl: string, _discovery: DiscoveryResult): Promise<DeploymentPlan> {
    await this.delay(800);

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

  async deployFullTrinity(
    _githubUrl: string,
    _projectName: string,
    onProgress: (step: DeploymentStep) => void
  ): Promise<{ success: boolean; urls: { neon?: string; railway?: string; vercel?: string } }> {
    const steps: DeploymentStep[] = [
      {
        id: '1',
        platform: 'neon',
        status: 'in-progress',
        message: 'Creating Neon database project...',
        timestamp: Date.now(),
      },
      {
        id: '2',
        platform: 'neon',
        status: 'completed',
        message: 'Neon project created successfully',
        timestamp: Date.now() + 2000,
      },
      {
        id: '3',
        platform: 'neon',
        status: 'completed',
        message: 'DATABASE_URL retrieved',
        timestamp: Date.now() + 2500,
      },
      {
        id: '4',
        platform: 'railway',
        status: 'in-progress',
        message: 'Creating Railway backend project...',
        timestamp: Date.now() + 3000,
      },
      {
        id: '5',
        platform: 'railway',
        status: 'in-progress',
        message: 'Connecting GitHub repository...',
        timestamp: Date.now() + 4500,
      },
      {
        id: '6',
        platform: 'railway',
        status: 'in-progress',
        message: 'Setting environment variables (DATABASE_URL)...',
        timestamp: Date.now() + 6000,
      },
      {
        id: '7',
        platform: 'railway',
        status: 'completed',
        message: 'Railway backend deployed successfully',
        timestamp: Date.now() + 7500,
      },
      {
        id: '8',
        platform: 'vercel',
        status: 'in-progress',
        message: 'Creating Vercel frontend project...',
        timestamp: Date.now() + 8000,
      },
      {
        id: '9',
        platform: 'vercel',
        status: 'in-progress',
        message: 'Connecting GitHub repository...',
        timestamp: Date.now() + 9500,
      },
      {
        id: '10',
        platform: 'vercel',
        status: 'in-progress',
        message: 'Setting environment variables (NEXT_PUBLIC_API_URL)...',
        timestamp: Date.now() + 11000,
      },
      {
        id: '11',
        platform: 'vercel',
        status: 'completed',
        message: 'Vercel frontend deployed successfully',
        timestamp: Date.now() + 12500,
      },
    ];

    // Simulate progress
    for (const step of steps) {
      await this.delay(step.timestamp - Date.now() - (steps[0].timestamp - Date.now()));
      onProgress(step);
    }

    return {
      success: true,
      urls: {
        neon: 'https://console.neon.tech/project/mock-project',
        railway: 'https://mock-backend.railway.app',
        vercel: 'https://mock-frontend.vercel.app',
      },
    };
  }
}

export const mockApi = new MockApiService();
