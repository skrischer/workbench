// src/tools/project-summary.ts — Project Summary Tool

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { BaseTool } from './base.js';
import { walkDirectory } from './utils/ignore.js';
import type { ToolResult } from '../types/index.js';

/**
 * Structure to hold package.json data
 */
interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Tool for generating a comprehensive project summary.
 * Reads package.json, generates directory tree, and identifies key files.
 */
export class ProjectSummaryTool extends BaseTool {
  readonly name = 'project_summary';
  readonly description = 'Generate a comprehensive project summary including package.json info, directory structure, dependencies, and scripts.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the project directory (default: current directory)',
        default: '.',
      },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = (input.path as string | undefined) || '.';

    try {
      const sections: string[] = [];

      // 1. Read package.json if it exists
      const packageJsonPath = join(projectPath, 'package.json');
      let packageData: PackageJson | null = null;

      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        packageData = JSON.parse(packageContent) as PackageJson;

        sections.push('## Project Information\n');
        if (packageData.name) {
          sections.push(`**Name:** ${packageData.name}`);
        }
        if (packageData.version) {
          sections.push(`**Version:** ${packageData.version}`);
        }
        if (packageData.description) {
          sections.push(`**Description:** ${packageData.description}`);
        }
      } catch {
        // package.json doesn't exist or is invalid - we'll note this later
      }

      // 2. Generate directory tree (depth 2)
      const tree = await this.generateDirectoryTree(projectPath);
      sections.push('\n## Directory Structure\n');
      sections.push('```');
      if (tree) {
        sections.push(tree);
      } else {
        sections.push('(empty)');
      }
      sections.push('```');

      // 3. Identify key files
      const keyFiles = await this.identifyKeyFiles(projectPath);
      if (keyFiles.length > 0) {
        sections.push('\n## Key Files\n');
        keyFiles.forEach(file => {
          sections.push(`- ${file}`);
        });
      }

      // 4. List dependencies
      if (packageData?.dependencies && Object.keys(packageData.dependencies).length > 0) {
        sections.push('\n## Dependencies\n');
        Object.entries(packageData.dependencies).forEach(([name, version]) => {
          sections.push(`- ${name}: ${version}`);
        });
      }

      // 5. List devDependencies
      if (packageData?.devDependencies && Object.keys(packageData.devDependencies).length > 0) {
        sections.push('\n## Dev Dependencies\n');
        Object.entries(packageData.devDependencies).forEach(([name, version]) => {
          sections.push(`- ${name}: ${version}`);
        });
      }

      // 6. List scripts
      if (packageData?.scripts && Object.keys(packageData.scripts).length > 0) {
        sections.push('\n## Scripts\n');
        Object.entries(packageData.scripts).forEach(([name, command]) => {
          sections.push(`- **${name}:** \`${command}\``);
        });
      }

      // If no package.json was found, add a note at the top
      if (!packageData) {
        sections.unshift('## Project Information\n');
        sections.unshift('_No package.json found in this directory_\n');
      }

      const output = sections.join('\n');

      return {
        success: true,
        output,
        metadata: {
          path: projectPath,
          hasPackageJson: packageData !== null,
          keyFilesCount: keyFiles.length,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to generate project summary for '${projectPath}': ${error.message}`,
      };
    }
  }

  /**
   * Generate a directory tree with depth 2
   */
  private async generateDirectoryTree(rootPath: string): Promise<string> {
    const lines: string[] = [];
    const entries: { path: string; name: string; type: 'file' | 'directory'; depth: number }[] = [];

    // Collect all entries
    for await (const entry of walkDirectory(rootPath, { depth: 2 })) {
      entries.push(entry);
    }

    // Sort entries: directories first, then alphabetically
    entries.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Build tree representation
    const pathMap = new Map<string, typeof entries>();
    
    for (const entry of entries) {
      const depth = entry.depth;
      const indent = '  '.repeat(depth);
      const prefix = entry.type === 'directory' ? '📁' : '📄';
      const suffix = entry.type === 'directory' ? '/' : '';
      
      lines.push(`${indent}${prefix} ${entry.name}${suffix}`);
    }

    return lines.join('\n');
  }

  /**
   * Identify key project files
   */
  private async identifyKeyFiles(rootPath: string): Promise<string[]> {
    const keyFilePatterns = [
      'README.md',
      'README.txt',
      'README',
      'package.json',
      'tsconfig.json',
      'jsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'vitest.config.ts',
      'vitest.config.js',
      '.gitignore',
      '.env',
      '.env.example',
      'docker-compose.yml',
      'Dockerfile',
      'Makefile',
    ];

    const foundFiles: string[] = [];

    for await (const entry of walkDirectory(rootPath, { depth: 1 })) {
      if (entry.type === 'file' && keyFilePatterns.includes(entry.name)) {
        foundFiles.push(entry.name);
      }
    }

    return foundFiles.sort();
  }
}
