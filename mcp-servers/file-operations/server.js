import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';

// Create MCP server instance for file operations
const server = new Server(
  {
    name: 'file-operations-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define file operation tools
const tools = [
  {
    name: 'list_files',
    description: 'List files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (defaults to current directory)',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
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
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path of the directory to create',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_info',
    description: 'Get information about a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file or directory',
        },
      },
      required: ['path'],
    },
  },
];

// Define file resources
const resources = [
  {
    uri: 'file:///workspace/',
    name: 'Workspace Directory',
    description: 'Main workspace directory',
    mimeType: 'text/plain',
  },
];

// Handle tool calls
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'list_files':
      try {
        const path = args.path || '.';
        const files = await fs.readdir(path, { withFileTypes: true });
        const fileList = files.map(file => ({
          name: file.name,
          type: file.isDirectory() ? 'directory' : 'file',
          path: join(path, file.name)
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: `Files in ${path}:\n${fileList.map(f => `- ${f.name} (${f.type})`).join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing files: ${error.message}`,
            },
          ],
        };
      }

    case 'read_file':
      try {
        const content = await fs.readFile(args.path, 'utf8');
        return {
          content: [
            {
              type: 'text',
              text: `File content of ${args.path}:\n\n${content}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error reading file: ${error.message}`,
            },
          ],
        };
      }

    case 'write_file':
      try {
        // Ensure directory exists
        await fs.mkdir(dirname(args.path), { recursive: true });
        await fs.writeFile(args.path, args.content, 'utf8');
        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote content to ${args.path}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error writing file: ${error.message}`,
            },
          ],
        };
      }

    case 'create_directory':
      try {
        await fs.mkdir(args.path, { recursive: true });
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created directory: ${args.path}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating directory: ${error.message}`,
            },
          ],
        };
      }

    case 'file_info':
      try {
        const stats = await fs.stat(args.path);
        const info = {
          name: basename(args.path),
          path: args.path,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          permissions: stats.mode.toString(8),
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `File Information for ${args.path}:\n${JSON.stringify(info, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting file info: ${error.message}`,
            },
          ],
        };
      }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Handle resource requests
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'file:///workspace/':
      try {
        const files = await fs.readdir('.', { withFileTypes: true });
        const fileList = files.map(file => ({
          name: file.name,
          type: file.isDirectory() ? 'directory' : 'file'
        }));
        
        return {
          contents: [
            {
              uri: 'file:///workspace/',
              mimeType: 'application/json',
              text: JSON.stringify({
                workspace: 'Current workspace directory',
                files: fileList,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: 'file:///workspace/',
              mimeType: 'text/plain',
              text: `Error reading workspace: ${error.message}`,
            },
          ],
        };
      }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('File Operations MCP Server started and listening on stdio');
}

main().catch((error) => {
  console.error('Failed to start File Operations MCP server:', error);
  process.exit(1);
}); 