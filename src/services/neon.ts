import axios, { AxiosInstance } from 'axios';

/**
 * Neon Provisioning Service
 * Handles database project creation and connection string retrieval
 */
export class NeonProvisioningService {
  private client: AxiosInstance;
  private apiKey: string;
  private dryRun: boolean;

  constructor(apiKey: string, dryRun: boolean = false) {
    this.apiKey = apiKey;
    this.dryRun = dryRun;
    this.client = axios.create({
      baseURL: 'https://console.neon.tech/api/v2',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a new Neon project
   * @param name - Name of the project
   * @returns Promise with project ID and name
   */
  async createProject(name: string): Promise<{ id: string; name: string }> {
    if (this.dryRun) {
      const mockId = `dry-run-neon-project-${Date.now()}`;
      console.log(`   [DRY RUN] Would create Neon project: ${name} (ID: ${mockId})`);
      return {
        id: mockId,
        name: name,
      };
    }

    try {
      const response = await this.client.post('/projects', {
        project: {
          name: name,
        },
      });

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create Neon project: ${response.statusText}`);
      }

      const project = response.data?.project;
      if (!project) {
        throw new Error('Failed to create project: No project data returned');
      }

      return {
        id: project.id,
        name: project.name,
      };
    } catch (error: any) {
      console.error('Failed to create Neon project:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Gets the default branch for a project
   * @param projectId - ID of the Neon project
   * @returns Promise with branch ID
   */
  private async getDefaultBranch(projectId: string): Promise<string> {
    if (this.dryRun) {
      return `dry-run-branch-${Date.now()}`;
    }

    try {
      const response = await this.client.get(`/projects/${projectId}/branches`);

      if (response.data?.branches && response.data.branches.length > 0) {
        // Return the first branch (usually the main branch)
        return response.data.branches[0].id;
      }

      throw new Error('No branches found for project');
    } catch (error: any) {
      console.error('Failed to get default branch:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Gets the DATABASE_URL connection string for a project
   * @param projectId - ID of the Neon project
   * @returns Promise with DATABASE_URL
   */
  async getDatabaseUrl(projectId: string): Promise<string> {
    if (this.dryRun) {
      const mockUrl = `postgresql://dry-run-user:dry-run-password@dry-run-host.neon.tech/dry-run-db?sslmode=require`;
      console.log(`   [DRY RUN] Would fetch DATABASE_URL: ${mockUrl}`);
      return mockUrl;
    }

    try {
      // Get the default branch
      const branchId = await this.getDefaultBranch(projectId);

      // Get connection URI for the branch
      const response = await this.client.get(
        `/projects/${projectId}/branches/${branchId}/connection_uri`
      );

      if (response.data?.uri) {
        return response.data.uri;
      }

      // Fallback: Try to construct from connection details
      const connectionResponse = await this.client.get(
        `/projects/${projectId}/branches/${branchId}/connection_details`
      );

      if (connectionResponse.data) {
        const details = connectionResponse.data;
        // Construct connection string from details
        const uri = `postgresql://${details.user}:${details.password}@${details.host}/${details.database}?sslmode=require`;
        return uri;
      }

      throw new Error('Could not retrieve DATABASE_URL from Neon API');
    } catch (error: any) {
      console.error('Failed to get DATABASE_URL:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Complete provisioning flow: Creates project and returns DATABASE_URL
   * @param projectName - Name of the project
   * @returns Promise with project ID, name, and DATABASE_URL
   */
  async provisionDatabase(projectName: string): Promise<{
    projectId: string;
    projectName: string;
    databaseUrl: string;
  }> {
    // Step 1: Create project
    const project = await this.createProject(projectName);

    // Step 2: Get DATABASE_URL
    const databaseUrl = await this.getDatabaseUrl(project.id);

    return {
      projectId: project.id,
      projectName: project.name,
      databaseUrl: databaseUrl,
    };
  }

  /**
   * Deletes a Neon project (rollback)
   * @param projectId - ID of the Neon project to delete
   * @returns Promise<void>
   */
  async deleteProject(projectId: string): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would delete Neon project: ${projectId}`);
      return;
    }

    try {
      const response = await this.client.delete(`/projects/${projectId}`);
      
      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Failed to delete Neon project: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Failed to delete Neon project:', error.response?.data || error.message);
      throw error;
    }
  }
}
