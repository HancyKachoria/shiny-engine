import { Vercel } from '@vercel/sdk';

/**
 * Vercel API client wrapper
 */
export class VercelClient {
  private client: Vercel;

  constructor(apiToken: string) {
    this.client = new Vercel({ bearerToken: apiToken });
  }

  /**
   * Health check: Verifies that the Vercel API token is valid
   * by attempting to fetch user information
   * @returns Promise<boolean> - true if token is valid, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Attempt to get user information to verify token validity
      const user = await this.client.user.getAuthUser();
      return user !== null && user !== undefined;
    } catch (error) {
      console.error('Vercel health check failed:', error);
      return false;
    }
  }

  /**
   * Discover existing projects on Vercel
   * @returns Promise<any[]> - Array of projects
   */
  async discoverProjects(): Promise<any[]> {
    try {
      const response = await this.client.projects.getProjects({});
      // The response is an array of projects directly
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to discover Vercel projects:', error);
      throw error;
    }
  }
}
