// src/tools/write-file.ts — Write File Tool
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BaseTool } from './base.js';
/**
 * Tool for writing content to a file with automatic parent directory creation.
 */
export class WriteFileTool extends BaseTool {
    name = 'write_file';
    description = 'Write content to a file. Creates parent directories automatically.';
    inputSchema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to write',
            },
            content: {
                type: 'string',
                description: 'Content to write to the file',
            },
        },
        required: ['path', 'content'],
    };
    async execute(input) {
        const path = input.path;
        const content = input.content;
        try {
            // Create parent directories if they don't exist
            const parentDir = dirname(path);
            await mkdir(parentDir, { recursive: true });
            // Write the file
            await writeFile(path, content, 'utf-8');
            return {
                success: true,
                output: `Successfully wrote ${content.length} characters to '${path}'`,
                metadata: {
                    path,
                    bytesWritten: Buffer.byteLength(content, 'utf-8'),
                },
            };
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to write file '${path}': ${error.message}`,
            };
        }
    }
}
