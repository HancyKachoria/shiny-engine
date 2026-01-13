import axios, { AxiosInstance } from 'axios';

/**
 * Railway Provisioning Service
 * Handles project creation, service provisioning, and environment variable management
 */
export class RailwayProvisioningService {
  private client: AxiosInstance;
  private apiKey: string;
  private dryRun: boolean;

  constructor(apiKey: string, dryRun: boolean = false) {
    this.apiKey = apiKey;
    this.dryRun = dryRun;
    this.client = axios.create({
      baseURL: 'https://backboard.railway.com/graphql/v2',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a new Railway project
   * @param name - Name of the project
   * @returns Promise with project ID and name
   */
  async createProject(name: string): Promise<{ id: string; name: string }> {
    if (this.dryRun) {
      const mockId = `dry-run-project-${Date.now()}`;
      console.log(`   [DRY RUN] Would create project: ${name} (ID: ${mockId})`);
      return {
        id: mockId,
        name: name,
      };
    }

    try {
      const mutation = `
        mutation projectCreate($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            id
            name
          }
        }
      `;

      const variables = {
        input: {
          name: name,
        },
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      const project = response.data?.data?.projectCreate;
      if (!project) {
        throw new Error('Failed to create project: No project data returned');
      }

      return {
        id: project.id,
        name: project.name,
      };
    } catch (error: any) {
      console.error('Failed to create Railway project:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Creates a service within a Railway project
   * @param projectId - ID of the Railway project
   * @param name - Name of the service
   * @param source - Optional source configuration (GitHub repo, etc.)
   * @returns Promise with service ID and name
   */
  async createService(
    projectId: string,
    name: string,
    source?: {
      type: 'GITHUB';
      github: {
        repo: string;
        branch: string;
        rootDirectory?: string;
      };
    }
  ): Promise<{ id: string; name: string }> {
    if (this.dryRun) {
      const mockId = `dry-run-service-${Date.now()}`;
      console.log(`   [DRY RUN] Would create service: ${name} (ID: ${mockId})`);
      if (source) {
        console.log(`   [DRY RUN] Would connect GitHub: ${source.github.repo} (branch: ${source.github.branch})`);
      }
      return {
        id: mockId,
        name: name,
      };
    }

    try {
      const mutation = `
        mutation serviceCreate($input: ServiceCreateInput!) {
          serviceCreate(input: $input) {
            id
            name
          }
        }
      `;

      const input: any = {
        projectId: projectId,
        name: name,
      };

      // Include source if provided
      if (source) {
        input.source = source;
      }

      const variables = {
        input: input,
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      const service = response.data?.data?.serviceCreate;
      if (!service) {
        throw new Error('Failed to create service: No service data returned');
      }

      return {
        id: service.id,
        name: service.name,
      };
    } catch (error: any) {
      console.error('Failed to create Railway service:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Connects a GitHub repository to a Railway service
   * @param serviceId - ID of the Railway service
   * @param githubRepo - GitHub repository in format "owner/repo"
   * @param branch - Branch to deploy from (default: "main")
   * @param rootDirectory - Root directory within the repository (optional)
   * @returns Promise<void>
   */
  async connectGitHub(
    serviceId: string,
    githubRepo: string,
    branch: string = 'main',
    rootDirectory?: string
  ): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would connect GitHub: ${githubRepo} (branch: ${branch})`);
      return;
    }

    try {
      const mutation = `
        mutation serviceUpdate($input: ServiceUpdateInput!) {
          serviceUpdate(input: $input) {
            id
          }
        }
      `;

      const sourceInput: any = {
        type: 'GITHUB',
        github: {
          repo: githubRepo,
          branch: branch,
        },
      };

      if (rootDirectory) {
        sourceInput.github.rootDirectory = rootDirectory;
      }

      const variables = {
        input: {
          id: serviceId,
          source: sourceInput,
        },
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      if (!response.data?.data?.serviceUpdate) {
        throw new Error('Failed to connect GitHub repository: No data returned');
      }
    } catch (error: any) {
      console.error('Failed to connect GitHub repository:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Gets the default environment ID for a project
   * @param projectId - ID of the Railway project
   * @returns Promise<string> - Environment ID
   */
  private async getDefaultEnvironment(projectId: string): Promise<string> {
    if (this.dryRun) {
      return `dry-run-env-${Date.now()}`;
    }

    try {
      const query = `
        query getProject($id: String!) {
          project(id: $id) {
            environments {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      `;

      const response = await this.client.post('', {
        query: query,
        variables: { id: projectId },
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      const environments = response.data?.data?.project?.environments?.edges;
      if (!environments || environments.length === 0) {
        throw new Error('No environments found for project');
      }

      // Return the first environment (usually "production" or default)
      return environments[0].node.id;
    } catch (error: any) {
      console.error('Failed to get default environment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Sets environment variables for a Railway service
   * @param projectId - ID of the Railway project
   * @param serviceId - ID of the Railway service
   * @param variables - Object with key-value pairs of environment variables
   * @returns Promise<void>
   */
  async setVariables(
    projectId: string,
    serviceId: string,
    variables: Record<string, string>
  ): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would set environment variables:`);
      Object.entries(variables).forEach(([key, value]) => {
        const maskedValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
        console.log(`     ${key} = ${maskedValue}`);
      });
      return;
    }

    try {
      // Get the default environment ID
      const environmentId = await this.getDefaultEnvironment(projectId);

      // Use variableCollectionUpsert for batch updates (triggers only one deployment)
      const mutation = `
        mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input) {
            id
          }
        }
      `;

      const variables_input = {
        projectId: projectId,
        environmentId: environmentId,
        serviceId: serviceId,
        variables: variables, // Railway expects a plain object, not an array
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: {
          input: variables_input,
        },
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      if (!response.data?.data?.variableCollectionUpsert) {
        throw new Error('Failed to set environment variables: No data returned');
      }
    } catch (error: any) {
      // If the batch mutation doesn't work, try setting variables individually
      console.warn('Batch variable update failed, trying individual updates:', error.message);
      
      // Get environment ID for individual updates
      const environmentId = await this.getDefaultEnvironment(projectId);
      
      // Fallback: Set variables one by one
      for (const [key, value] of Object.entries(variables)) {
        try {
          await this.setVariable(projectId, environmentId, serviceId, key, value);
        } catch (individualError: any) {
          console.error(`Failed to set variable ${key}:`, individualError.message);
          throw individualError;
        }
      }
    }
  }

  /**
   * Sets a single environment variable for a Railway service
   * @param projectId - ID of the Railway project
   * @param environmentId - ID of the environment
   * @param serviceId - ID of the Railway service
   * @param key - Environment variable name
   * @param value - Environment variable value
   * @returns Promise<void>
   */
  private async setVariable(
    projectId: string,
    environmentId: string,
    serviceId: string,
    key: string,
    value: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation variableUpsert($input: VariableUpsertInput!) {
          variableUpsert(input: $input) {
            id
          }
        }
      `;

      const variables = {
        input: {
          projectId: projectId,
          environmentId: environmentId,
          serviceId: serviceId,
          name: key,
          value: value,
        },
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }

      if (!response.data?.data?.variableUpsert) {
        throw new Error(`Failed to set variable ${key}: No data returned`);
      }
    } catch (error: any) {
      console.error(`Failed to set variable ${key}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Streamlit Optimizer - Adds Streamlit-specific environment variables
   * @param variables - Existing variables object
   * @returns Variables object with Streamlit configuration
   */
  private optimizeForStreamlit(variables: Record<string, string> = {}): Record<string, string> {
    const streamlitVars = {
      PORT: '8501',
      STREAMLIT_SERVER_PORT: '8501',
      STREAMLIT_SERVER_ADDRESS: '0.0.0.0',
    };

    return {
      ...variables,
      ...streamlitVars,
    };
  }

  /**
   * Complete provisioning flow: Creates project, service, connects GitHub, and sets variables
   * @param projectName - Name of the project
   * @param serviceName - Name of the service
   * @param githubRepo - GitHub repository in format "owner/repo"
   * @param branch - Branch to deploy from (default: "main")
   * @param variables - Environment variables to set (optional)
   * @param isStreamlit - Whether this is a Streamlit app (optional, will auto-optimize)
   * @returns Promise with project and service IDs
   */
  async provisionBackend(
    projectName: string,
    serviceName: string,
    githubRepo: string,
    branch: string = 'main',
    variables?: Record<string, string>,
    isStreamlit?: boolean
  ): Promise<{
    projectId: string;
    serviceId: string;
    projectName: string;
    serviceName: string;
  }> {
    // Step 1: Create project
    const project = await this.createProject(projectName);

    // Step 2: Create service with GitHub source (more efficient)
    const service = await this.createService(project.id, serviceName, {
      type: 'GITHUB',
      github: {
        repo: githubRepo,
        branch: branch,
      },
    });

    // Step 3: Optimize for Streamlit if detected
    let finalVariables = variables || {};
    if (isStreamlit) {
      finalVariables = this.optimizeForStreamlit(finalVariables);
    }

    // Step 4: Set environment variables
    if (Object.keys(finalVariables).length > 0) {
      await this.setVariables(project.id, service.id, finalVariables);
    }

    return {
      projectId: project.id,
      serviceId: service.id,
      projectName: project.name,
      serviceName: service.name,
    };
  }

  /**
   * Deletes a Railway service (rollback)
   * @param serviceId - ID of the Railway service to delete
   * @returns Promise<void>
   */
  async deleteService(serviceId: string): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would delete Railway service: ${serviceId}`);
      return;
    }

    try {
      const mutation = `
        mutation serviceDelete($input: ServiceDeleteInput!) {
          serviceDelete(input: $input) {
            id
          }
        }
      `;

      const variables = {
        input: {
          id: serviceId,
        },
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }
    } catch (error: any) {
      console.error('Failed to delete Railway service:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Deletes a Railway project (rollback)
   * @param projectId - ID of the Railway project to delete
   * @returns Promise<void>
   */
  async deleteProject(projectId: string): Promise<void> {
    if (this.dryRun) {
      console.log(`   [DRY RUN] Would delete Railway project: ${projectId}`);
      return;
    }

    try {
      const mutation = `
        mutation projectDelete($input: ProjectDeleteInput!) {
          projectDelete(input: $input) {
            id
          }
        }
      `;

      const variables = {
        input: {
          id: projectId,
        },
      };

      const response = await this.client.post('', {
        query: mutation,
        variables: variables,
      });

      if (response.data?.errors) {
        throw new Error(`Railway API error: ${JSON.stringify(response.data.errors)}`);
      }
    } catch (error: any) {
      console.error('Failed to delete Railway project:', error.response?.data || error.message);
      throw error;
    }
  }
}
