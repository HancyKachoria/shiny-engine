/**
 * Project type enumeration
 */
export enum ProjectType {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DATABASE = 'database',
  UNKNOWN = 'unknown',
}

/**
 * Project Blueprint interface
 * Represents the detected characteristics of a project
 */
export interface ProjectBlueprint {
  /** The detected project type */
  type: ProjectType;
  /** The repository path that was scanned */
  path: string;
  /** Confidence score (0-1) indicating how certain we are about the type */
  confidence: number;
  /** Array of file signatures/indicators that were found */
  indicators: string[];
  /** Optional metadata about the project */
  metadata?: {
    /** Framework or technology detected (e.g., 'nextjs', 'express', 'prisma', 'streamlit') */
    framework?: string;
    /** Package manager detected (e.g., 'npm', 'yarn', 'pnpm') */
    packageManager?: string;
    /** Runtime detected (e.g., 'node', 'python', 'go') */
    runtime?: string;
    /** Additional detected technologies */
    technologies?: string[];
    /** Whether the project is a Streamlit app */
    isStreamlit?: boolean;
  };
}
