import axios, { AxiosInstance } from 'axios';

/**
 * Railway API client wrapper
 */
export class RailwayClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://backboard.railway.com/graphql/v2',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Health check: Verifies that the Railway API key is valid
   * by attempting to query user information
   * @returns Promise<boolean> - true if API key is valid, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `
        query {
          me {
            id
            email
          }
        }
      `;

      const response = await this.client.post('', { query });
      
      // Check if we got a valid response with user data
      return (
        response.status === 200 &&
        response.data?.data?.me !== null &&
        response.data?.data?.me !== undefined
      );
    } catch (error: any) {
      console.error('Railway health check failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Discover existing projects on Railway
   * @returns Promise<any[]> - Array of projects
   */
  async discoverProjects(): Promise<any[]> {
    try {
      const query = `
        query {
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
              }
            }
          }
        }
      `;

      const response = await this.client.post('', { query });
      
      if (response.data?.data?.projects?.edges) {
        return response.data.data.projects.edges.map((edge: any) => edge.node);
      }
      
      return [];
    } catch (error: any) {
      console.error('Failed to discover Railway projects:', error.response?.data || error.message);
      throw error;
    }
  }
}
