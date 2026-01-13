import axios, { AxiosInstance } from 'axios';

/**
 * Neon API client wrapper
 */
export class NeonClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://console.neon.tech/api/v2',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Health check: Verifies that the Neon API key is valid
   * by attempting to fetch account information
   * @returns Promise<boolean> - true if API key is valid, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Attempt to get projects list to verify API key validity
      const response = await this.client.get('/projects');
      
      // If we get a successful response (even with empty array), the key is valid
      return response.status === 200;
    } catch (error: any) {
      // 401 or 403 typically means invalid API key
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Neon health check failed: Invalid API key');
        return false;
      }
      console.error('Neon health check failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Discover existing projects on Neon
   * @returns Promise<any[]> - Array of projects
   */
  async discoverProjects(): Promise<any[]> {
    try {
      const response = await this.client.get('/projects');
      
      if (response.data?.projects) {
        return response.data.projects;
      }
      
      return [];
    } catch (error: any) {
      console.error('Failed to discover Neon projects:', error.response?.data || error.message);
      throw error;
    }
  }
}
