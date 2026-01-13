import dotenv from 'dotenv';
import { VercelClient } from './lib/vercel';
import { RailwayClient } from './lib/railway';
import { NeonClient } from './lib/neon';
import { DiscoveryService } from './services/discovery';
import { Orchestrator } from './services/orchestrator';
import { ProjectType } from './types';

// Load environment variables
dotenv.config();

/**
 * Main initialization script for Unified Deployment Orchestrator
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle test-discovery command
  if (command === 'test-discovery') {
    await runDiscoveryTest(args[1]);
    return;
  }

  // Handle deploy command
  if (command === 'deploy') {
    // Parse flags and arguments
    // args already has 'deploy' removed by process.argv.slice(2)
    // So args[0] is 'deploy', args[1+] are the actual arguments
    const deployArgs = args.slice(1); // Skip 'deploy' command
    const flags = deployArgs.filter(arg => arg && arg.startsWith('--'));
    const nonFlagArgs = deployArgs.filter(arg => arg && !arg.startsWith('--'));
    const dryRun = flags.includes('--dry-run') || flags.includes('--test') || 
                   deployArgs.includes('--dry-run') || deployArgs.includes('--test');
    const fullTrinity = flags.includes('--full-trinity') || flags.includes('--trinity') ||
                        deployArgs.includes('--full-trinity') || deployArgs.includes('--trinity');
    
    if (fullTrinity) {
      await runFullTrinityDeploy(nonFlagArgs[0], nonFlagArgs[1], nonFlagArgs[2], dryRun);
    } else {
      await runDeploy(nonFlagArgs[0], nonFlagArgs[1], nonFlagArgs[2], dryRun);
    }
    return;
  }

  // Default: Run health checks
  await runHealthChecks();
}

/**
 * Runs health checks for all services
 */
async function runHealthChecks() {
  console.log('🚀 Unified Deployment Orchestrator - Initialization\n');

  // Validate environment variables
  const vercelToken = process.env.VERCEL_TOKEN;
  const railwayApiKey = process.env.RAILWAY_API_KEY;
  const neonApiKey = process.env.NEON_API_KEY;

  if (!vercelToken || !railwayApiKey || !neonApiKey) {
    console.error('❌ Error: Missing required environment variables.');
    console.error('Please ensure all API keys are set in your .env file:');
    console.error('  - VERCEL_TOKEN');
    console.error('  - RAILWAY_API_KEY');
    console.error('  - NEON_API_KEY');
    console.error('\nSee .env.example for reference.');
    process.exit(1);
  }

  // Initialize clients
  const vercelClient = new VercelClient(vercelToken);
  const railwayClient = new RailwayClient(railwayApiKey);
  const neonClient = new NeonClient(neonApiKey);

  // Perform health checks
  console.log('🔍 Performing health checks...\n');

  const healthChecks = {
    Vercel: false,
    Railway: false,
    Neon: false,
  };

  try {
    console.log('Checking Vercel API...');
    healthChecks.Vercel = await vercelClient.healthCheck();
    console.log(healthChecks.Vercel ? '✅ Vercel: API key is valid' : '❌ Vercel: API key is invalid');
  } catch (error) {
    console.error('❌ Vercel: Health check failed with error:', error);
  }

  try {
    console.log('Checking Railway API...');
    healthChecks.Railway = await railwayClient.healthCheck();
    console.log(healthChecks.Railway ? '✅ Railway: API key is valid' : '❌ Railway: API key is invalid');
  } catch (error) {
    console.error('❌ Railway: Health check failed with error:', error);
  }

  try {
    console.log('Checking Neon API...');
    healthChecks.Neon = await neonClient.healthCheck();
    console.log(healthChecks.Neon ? '✅ Neon: API key is valid' : '❌ Neon: API key is invalid');
  } catch (error) {
    console.error('❌ Neon: Health check failed with error:', error);
  }

  console.log('\n📊 Health Check Summary:');
  console.log('─'.repeat(40));
  Object.entries(healthChecks).forEach(([service, status]) => {
    console.log(`${service.padEnd(10)}: ${status ? '✅ Valid' : '❌ Invalid'}`);
  });
  console.log('─'.repeat(40));

  // Exit with appropriate code
  const allHealthy = Object.values(healthChecks).every(status => status === true);
  
  if (allHealthy) {
    console.log('\n✅ All API keys are valid! Ready to discover projects.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some API keys are invalid. Please check your credentials.');
    process.exit(1);
  }
}

/**
 * Runs discovery test on a repository
 */
async function runDiscoveryTest(repoPath?: string) {
  console.log('🔍 Discovery Service - Repository Scanner\n');

  if (!repoPath) {
    console.error('❌ Error: Repository path is required.');
    console.error('Usage: npm run dev test-discovery <path-or-url>');
    console.error('\nExamples:');
    console.error('  npm run dev test-discovery ./my-project');
    console.error('  npm run dev test-discovery https://github.com/user/repo.git');
    process.exit(1);
  }

  const discoveryService = new DiscoveryService();

  try {
    console.log(`📂 Scanning repository: ${repoPath}\n`);
    console.log('⏳ Analyzing files and detecting project type...\n');

    const blueprint = await discoveryService.scanRepository(repoPath);

    // Display results
    console.log('📊 Discovery Results:');
    console.log('═'.repeat(50));
    console.log(`Type:       ${blueprint.type.toUpperCase()}`);
    console.log(`Confidence: ${(blueprint.confidence * 100).toFixed(1)}%`);
    console.log(`Path:       ${blueprint.path}`);
    
    if (blueprint.indicators.length > 0) {
      console.log(`\n🔍 Detected Indicators (${blueprint.indicators.length}):`);
      blueprint.indicators.forEach((indicator, index) => {
        console.log(`  ${index + 1}. ${indicator}`);
      });
    }

    if (blueprint.metadata) {
      console.log('\n📦 Metadata:');
      if (blueprint.metadata.framework) {
        console.log(`  Framework:      ${blueprint.metadata.framework}`);
      }
      if (blueprint.metadata.runtime) {
        console.log(`  Runtime:        ${blueprint.metadata.runtime}`);
      }
      if (blueprint.metadata.packageManager) {
        console.log(`  Package Manager: ${blueprint.metadata.packageManager}`);
      }
      if (blueprint.metadata.technologies && blueprint.metadata.technologies.length > 0) {
        console.log(`  Technologies:   ${blueprint.metadata.technologies.join(', ')}`);
      }
    }

    console.log('\n💡 Recommended Deployment Platform:');
    switch (blueprint.type) {
      case ProjectType.FRONTEND:
        console.log('  → Vercel (Frontend deployment)');
        break;
      case ProjectType.BACKEND:
        console.log('  → Railway (Backend deployment)');
        break;
      case ProjectType.DATABASE:
        console.log('  → Neon (Database deployment)');
        break;
      default:
        console.log('  → Unable to determine (unknown project type)');
    }

    console.log('═'.repeat(50));
    console.log('\n✅ Discovery completed successfully!');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Discovery failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Runs the orchestrator deployment flow
 */
async function runDeploy(
  repoPath?: string,
  projectName?: string,
  serviceName?: string,
  dryRun: boolean = false
) {
  if (!repoPath) {
    console.error('❌ Error: Repository path is required.');
    console.error('Usage: npm run dev -- deploy <path-or-url> [project-name] [service-name] [--dry-run] [--full-trinity]');
    console.error('\nExamples:');
    console.error('  npm run dev -- deploy https://github.com/user/repo.git');
    console.error('  npm run dev -- deploy ./my-project "My Project" "My Service"');
    console.error('  npm run dev -- deploy https://github.com/user/repo.git "Test" "Service" --dry-run');
    console.error('  npm run dev -- deploy https://github.com/user/repo.git "My App" "My Service" --full-trinity');
    console.error('\nNote: Use "--" after "npm run dev" to pass flags like --dry-run or --full-trinity');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🧪 DRY RUN MODE: No actual deployments will be made\n');
  }

  try {
    const orchestrator = new Orchestrator(dryRun);
    
    // Parse environment variables from command line if provided
    // For now, we'll use empty object - can be extended later
    const envVars: Record<string, string> = {};

    const result = await orchestrator.deploy(
      repoPath,
      projectName,
      serviceName,
      Object.keys(envVars).length > 0 ? envVars : undefined
    );

    console.log('\n' + '═'.repeat(50));
    if (dryRun) {
      console.log('🧪 DRY RUN: Deployment Orchestration Simulation Complete!');
    } else {
      console.log('🎉 Deployment Orchestration Complete!');
    }
    console.log('═'.repeat(50));
    
    if (result.deployment) {
      console.log('\n📦 Deployment Details:');
      console.log(`   Platform: ${result.deployment.platform}`);
      if (result.deployment.projectId) {
        console.log(`   Project ID: ${result.deployment.projectId}`);
      }
      if (result.deployment.serviceId) {
        console.log(`   Service ID: ${result.deployment.serviceId}`);
      }
      if (result.deployment.projectName) {
        console.log(`   Project Name: ${result.deployment.projectName}`);
      }
      if (result.deployment.serviceName) {
        console.log(`   Service Name: ${result.deployment.serviceName}`);
      }
    }

    if (dryRun) {
      console.log('\n🧪 This was a dry run - no actual resources were created.');
    } else {
      console.log('\n✅ Orchestration completed successfully!');
    }
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Deployment orchestration failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Runs the full trinity deployment flow (Neon → Railway → Vercel)
 */
async function runFullTrinityDeploy(
  repoPath?: string,
  projectName?: string,
  serviceName?: string,
  dryRun: boolean = false
) {
  if (!repoPath) {
    console.error('❌ Error: Repository path is required.');
    console.error('Usage: npm run dev -- deploy <path-or-url> [project-name] [service-name] [--full-trinity] [--dry-run]');
    console.error('\nExamples:');
    console.error('  npm run dev -- deploy https://github.com/user/repo.git --full-trinity');
    console.error('  npm run dev -- deploy https://github.com/user/repo.git "My App" "My Service" --full-trinity --dry-run');
    console.error('\nNote: Full Trinity deploys to Neon (DB) → Railway (BE) → Vercel (FE)');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🧪 DRY RUN MODE: No actual deployments will be made\n');
  }

  try {
    const orchestrator = new Orchestrator(dryRun);
    
    // Parse environment variables from command line if provided
    // For now, we'll use empty object - can be extended later
    const envVars: Record<string, string> = {};

    const result = await orchestrator.deployFullTrinity(
      repoPath,
      projectName,
      serviceName,
      Object.keys(envVars).length > 0 ? envVars : undefined
    );

    console.log('\n' + '═'.repeat(50));
    if (dryRun) {
      console.log('🧪 DRY RUN: Full Trinity Deployment Simulation Complete!');
    } else {
      console.log('🎉 Full Trinity Deployment Complete!');
    }
    console.log('═'.repeat(50));
    
    if (result.deployments) {
      console.log('\n📦 Deployment Details:');
      
      if (result.deployments.neon) {
        console.log('\n💚 Neon (Database):');
        console.log(`   Project ID: ${result.deployments.neon.projectId}`);
        console.log(`   DATABASE_URL: ${result.deployments.neon.databaseUrl.substring(0, 50)}...`);
      }
      
      if (result.deployments.railway) {
        console.log('\n🚂 Railway (Backend):');
        console.log(`   Project ID: ${result.deployments.railway.projectId}`);
        console.log(`   Service ID: ${result.deployments.railway.serviceId}`);
        if (result.deployments.railway.url) {
          console.log(`   URL: ${result.deployments.railway.url}`);
        }
      }
      
      if (result.deployments.vercel) {
        console.log('\n▲ Vercel (Frontend):');
        console.log(`   Project ID: ${result.deployments.vercel.projectId}`);
        console.log(`   URL: ${result.deployments.vercel.projectUrl}`);
      }
    }

    if (dryRun) {
      console.log('\n🧪 This was a dry run - no actual resources were created.');
    } else {
      console.log('\n✅ Full Trinity deployment completed successfully!');
      console.log('\n🔗 Your application is now live:');
      if (result.deployments.vercel) {
        console.log(`   Frontend: ${result.deployments.vercel.projectUrl}`);
      }
      if (result.deployments.railway?.url) {
        console.log(`   Backend API: ${result.deployments.railway.url}`);
      }
    }
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Full Trinity deployment failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
