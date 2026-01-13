import * as fs from 'fs-extra';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { ProjectType, ProjectBlueprint } from '../types';

/**
 * Discovery Service
 * Scans repositories to detect project types based on file signatures
 */
export class DiscoveryService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), '.temp-repos');
  }

  /**
   * Scans a repository (local path or URL) to detect project type
   * @param repoPath - Local file path or Git URL
   * @returns Promise<ProjectBlueprint>
   */
  async scanRepository(repoPath: string): Promise<ProjectBlueprint> {
    let scanPath: string | undefined;
    let shouldCleanup = false;

    try {
      // Check if it's a URL or local path
      if (this.isGitUrl(repoPath)) {
        // Clone the repository temporarily
        scanPath = await this.cloneRepository(repoPath);
        shouldCleanup = true;
      } else {
        // Use the local path directly
        scanPath = path.resolve(repoPath);
        
        // Verify the path exists
        if (!(await fs.pathExists(scanPath))) {
          throw new Error(`Path does not exist: ${scanPath}`);
        }
      }

      // Get all files in the repository
      const files = await this.getAllFiles(scanPath);
      
      // Detect project type based on file signatures
      const blueprint = await this.detectProjectType(scanPath, files);

      return blueprint;
    } finally {
      // Cleanup temporary cloned repository if needed
      if (shouldCleanup && scanPath) {
        await this.cleanup(scanPath);
      }
    }
  }

  /**
   * Checks if the given string is a Git URL
   */
  private isGitUrl(pathOrUrl: string): boolean {
    return (
      pathOrUrl.startsWith('http://') ||
      pathOrUrl.startsWith('https://') ||
      pathOrUrl.startsWith('git@') ||
      pathOrUrl.startsWith('git://')
    );
  }

  /**
   * Clones a Git repository to a temporary directory
   */
  private async cloneRepository(url: string): Promise<string> {
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);

    // Generate a unique directory name
    const repoName = this.extractRepoName(url);
    const clonePath = path.join(this.tempDir, repoName);

    // Remove existing directory if it exists
    if (await fs.pathExists(clonePath)) {
      await fs.remove(clonePath);
    }

    // Clone the repository
    const git: SimpleGit = simpleGit();
    await git.clone(url, clonePath, ['--depth', '1']);

    return clonePath;
  }

  /**
   * Extracts repository name from URL
   */
  private extractRepoName(url: string): string {
    const match = url.match(/([^/]+)\.git$/);
    if (match) {
      return match[1];
    }
    const parts = url.split('/');
    return parts[parts.length - 1].replace(/\.git$/, '') || 'repo';
  }

  /**
   * Recursively gets all files in a directory
   */
  private async getAllFiles(dir: string, fileList: string[] = []): Promise<string[]> {
    const files = await fs.readdir(dir);

    for (const file of files) {
      // Skip hidden directories and common ignore patterns
      if (file.startsWith('.') && file !== '.env.example') {
        continue;
      }

      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // Skip common directories that don't help with detection
        if (['node_modules', '.git', 'dist', 'build', '.next', '.cache'].includes(file)) {
          continue;
        }
        await this.getAllFiles(filePath, fileList);
      } else {
        // Store relative path from the repository root
        const relativePath = path.relative(dir, filePath);
        fileList.push(relativePath);
      }
    }

    return fileList;
  }

  /**
   * Detects project type based on file signatures
   */
  private async detectProjectType(repoPath: string, files: string[]): Promise<ProjectBlueprint> {
    const indicators: string[] = [];
    let frontendScore = 0;
    let backendScore = 0;
    let databaseScore = 0;
    const metadata: ProjectBlueprint['metadata'] = {
      technologies: [],
    };

    // Frontend indicators (Vercel)
    const frontendSignatures = [
      { pattern: /^next\.config\.(js|ts|mjs)$/i, weight: 3, name: 'next.config' },
      { pattern: /^vercel\.json$/i, weight: 2, name: 'vercel.json' },
      { pattern: /^nuxt\.config\.(js|ts)$/i, weight: 2, name: 'nuxt.config' },
      { pattern: /^vite\.config\.(js|ts)$/i, weight: 1, name: 'vite.config' },
      { pattern: /^angular\.json$/i, weight: 2, name: 'angular.json' },
      { pattern: /^vue\.config\.(js|ts)$/i, weight: 1, name: 'vue.config' },
      { pattern: /^remix\.config\.(js|ts)$/i, weight: 2, name: 'remix.config' },
      { pattern: /^astro\.config\.(js|ts|mjs)$/i, weight: 2, name: 'astro.config' },
    ];

    // Backend indicators (Railway)
    const backendSignatures = [
      { pattern: /^Dockerfile$/i, weight: 3, name: 'Dockerfile' },
      { pattern: /^docker-compose\.(yml|yaml)$/i, weight: 2, name: 'docker-compose' },
      { pattern: /^railway\.json$/i, weight: 3, name: 'railway.json' },
      { pattern: /^\.railway$/i, weight: 2, name: '.railway' },
      { pattern: /^requirements\.txt$/i, weight: 2, name: 'requirements.txt' },
      { pattern: /^go\.mod$/i, weight: 2, name: 'go.mod' },
      { pattern: /^Cargo\.toml$/i, weight: 2, name: 'Cargo.toml' },
      { pattern: /^pom\.xml$/i, weight: 2, name: 'pom.xml' },
      { pattern: /^build\.gradle$/i, weight: 2, name: 'build.gradle' },
    ];

    // Database indicators (Neon)
    const databaseSignatures = [
      { pattern: /^prisma\/schema\.prisma$/i, weight: 3, name: 'prisma/schema.prisma' },
      { pattern: /^schema\.sql$/i, weight: 2, name: 'schema.sql' },
      { pattern: /^migrations\//i, weight: 2, name: 'migrations/' },
      { pattern: /^drizzle\.config\.(ts|js)$/i, weight: 2, name: 'drizzle.config' },
      { pattern: /^typeorm\.config\.(ts|js)$/i, weight: 2, name: 'typeorm.config' },
      { pattern: /^sequelize\.config\.(js|ts)$/i, weight: 2, name: 'sequelize.config' },
      { pattern: /^knexfile\.(js|ts)$/i, weight: 2, name: 'knexfile' },
    ];

    // Check package.json for additional clues
    const packageJsonPath = files.find(f => f.toLowerCase() === 'package.json');
    if (packageJsonPath) {
      try {
        const packageJsonContent = await fs.readJson(path.join(repoPath, packageJsonPath));
        const dependencies = {
          ...packageJsonContent.dependencies,
          ...packageJsonContent.devDependencies,
        };

        // Frontend frameworks
        if (dependencies.next) {
          frontendScore += 3;
          indicators.push('package.json: next');
          metadata.framework = 'nextjs';
          metadata.technologies?.push('nextjs');
        }
        if (dependencies.react || dependencies['react-dom']) {
          frontendScore += 1;
          indicators.push('package.json: react');
          if (!metadata.framework) metadata.framework = 'react';
        }
        if (dependencies.vue) {
          frontendScore += 1;
          indicators.push('package.json: vue');
          if (!metadata.framework) metadata.framework = 'vue';
        }
        if (dependencies.angular) {
          frontendScore += 2;
          indicators.push('package.json: angular');
          if (!metadata.framework) metadata.framework = 'angular';
        }

        // Backend frameworks
        if (dependencies.express) {
          backendScore += 2;
          indicators.push('package.json: express');
          metadata.technologies?.push('express');
        }
        if (dependencies.fastify) {
          backendScore += 2;
          indicators.push('package.json: fastify');
          metadata.technologies?.push('fastify');
        }
        if (dependencies['@nestjs/core']) {
          backendScore += 2;
          indicators.push('package.json: nestjs');
          metadata.technologies?.push('nestjs');
        }

        // Database ORMs
        if (dependencies['@prisma/client']) {
          databaseScore += 2;
          indicators.push('package.json: @prisma/client');
          metadata.technologies?.push('prisma');
        }
        if (dependencies.drizzle) {
          databaseScore += 2;
          indicators.push('package.json: drizzle');
          metadata.technologies?.push('drizzle');
        }
        if (dependencies.typeorm) {
          databaseScore += 2;
          indicators.push('package.json: typeorm');
          metadata.technologies?.push('typeorm');
        }

        // Package manager detection
        if (await fs.pathExists(path.join(repoPath, 'yarn.lock'))) {
          metadata.packageManager = 'yarn';
        } else if (await fs.pathExists(path.join(repoPath, 'pnpm-lock.yaml'))) {
          metadata.packageManager = 'pnpm';
        } else {
          metadata.packageManager = 'npm';
        }

        // Runtime detection
        if (packageJsonContent.engines?.node) {
          metadata.runtime = 'node';
        }
      } catch (error) {
        // Ignore package.json parsing errors
      }
    }

    // Check for Python backend
    let isStreamlitApp = false;
    if (files.some(f => f.toLowerCase() === 'requirements.txt')) {
      backendScore += 2;
      metadata.runtime = 'python';
      metadata.technologies?.push('python');
      
      // Check if it's a Streamlit app
      try {
        const requirementsPath = files.find(f => f.toLowerCase() === 'requirements.txt');
        if (requirementsPath) {
          const requirementsContent = await fs.readFile(
            path.join(repoPath, requirementsPath),
            'utf-8'
          );
          if (requirementsContent.toLowerCase().includes('streamlit')) {
            isStreamlitApp = true;
            metadata.framework = 'streamlit';
            metadata.technologies?.push('streamlit');
            indicators.push('requirements.txt: streamlit');
            backendScore += 3; // Strong indicator for Streamlit
          }
        }
      } catch (error) {
        // Ignore file read errors
      }
    }
    
    // Check for Streamlit app files (app.py, main.py, streamlit_app.py, etc.)
    if (!isStreamlitApp) {
      const streamlitFilePatterns = [
        /app\.py$/i,
        /main\.py$/i,
        /streamlit_app\.py$/i,
        /.*streamlit.*\.py$/i,
      ];
      
      const streamlitFiles = files.filter(f => 
        streamlitFilePatterns.some(pattern => pattern.test(f)) ||
        (f.toLowerCase().endsWith('.py') && 
         (f.toLowerCase().includes('app') || f.toLowerCase().includes('main')))
      );
      
      for (const streamlitFile of streamlitFiles.slice(0, 5)) { // Check first 5 Python files
        try {
          const filePath = path.join(repoPath, streamlitFile);
          // Check if file is a regular file (not a directory)
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const lowerContent = fileContent.toLowerCase();
            if (lowerContent.includes('streamlit') || 
                lowerContent.includes('import streamlit') ||
                lowerContent.includes('from streamlit') ||
                fileContent.includes('st.') ||
                fileContent.includes('streamlit.run')) {
              isStreamlitApp = true;
              metadata.framework = 'streamlit';
              if (!metadata.technologies?.includes('streamlit')) {
                metadata.technologies?.push('streamlit');
              }
              indicators.push(`streamlit file: ${streamlitFile}`);
              backendScore += 2;
              break;
            }
          }
        } catch (error) {
          // Ignore file read errors
        }
      }
    }
    
    // Check for Streamlit config file or directory
    if (!isStreamlitApp && files.some(f => 
      f.toLowerCase().includes('.streamlit') || 
      f.toLowerCase().includes('streamlit.config')
    )) {
      isStreamlitApp = true;
      metadata.framework = 'streamlit';
      if (!metadata.technologies?.includes('streamlit')) {
        metadata.technologies?.push('streamlit');
      }
      indicators.push('.streamlit config');
      backendScore += 2;
    }
    
    if (files.some(f => f.toLowerCase() === 'pyproject.toml')) {
      backendScore += 1;
      if (!metadata.runtime) metadata.runtime = 'python';
      if (!metadata.technologies?.includes('python')) {
        metadata.technologies?.push('python');
      }
    }
    
    // Store Streamlit detection in metadata
    if (isStreamlitApp) {
      metadata.isStreamlit = true;
    }

    // Check for Go backend
    if (files.some(f => f.toLowerCase() === 'go.mod')) {
      backendScore += 2;
      metadata.runtime = 'go';
      metadata.technologies?.push('go');
    }

    // Check for Rust backend
    if (files.some(f => f.toLowerCase() === 'cargo.toml')) {
      backendScore += 2;
      metadata.runtime = 'rust';
      metadata.technologies?.push('rust');
    }

    // Scan files for signatures
    for (const file of files) {
      // Frontend signatures
      for (const sig of frontendSignatures) {
        if (sig.pattern.test(file)) {
          frontendScore += sig.weight;
          indicators.push(sig.name);
        }
      }

      // Backend signatures
      for (const sig of backendSignatures) {
        if (sig.pattern.test(file)) {
          backendScore += sig.weight;
          indicators.push(sig.name);
        }
      }

      // Database signatures
      for (const sig of databaseSignatures) {
        if (sig.pattern.test(file)) {
          databaseScore += sig.weight;
          indicators.push(sig.name);
        }
      }
    }

    // Determine project type based on scores
    let projectType: ProjectType;
    let confidence: number;
    const maxScore = Math.max(frontendScore, backendScore, databaseScore);
    const totalScore = frontendScore + backendScore + databaseScore;

    if (maxScore === 0) {
      projectType = ProjectType.UNKNOWN;
      confidence = 0;
    } else if (frontendScore >= backendScore && frontendScore >= databaseScore) {
      projectType = ProjectType.FRONTEND;
      confidence = Math.min(1, frontendScore / Math.max(1, totalScore));
    } else if (backendScore >= databaseScore) {
      projectType = ProjectType.BACKEND;
      confidence = Math.min(1, backendScore / Math.max(1, totalScore));
    } else {
      projectType = ProjectType.DATABASE;
      confidence = Math.min(1, databaseScore / Math.max(1, totalScore));
    }

    return {
      type: projectType,
      path: repoPath,
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
      indicators: [...new Set(indicators)], // Remove duplicates
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Cleans up temporary cloned repository
   */
  private async cleanup(clonePath: string): Promise<void> {
    try {
      if (await fs.pathExists(clonePath)) {
        await fs.remove(clonePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temporary directory: ${clonePath}`, error);
    }
  }
}
