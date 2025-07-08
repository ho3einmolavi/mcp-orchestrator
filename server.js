import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create MCP server instance
const server = new Server(
  {
    name: 'test-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define tools that the LLM can call
const tools = [
  {
    name: 'get_current_time',
    description: 'Get the current date and time',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate',
    description: 'Perform basic mathematical calculations',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2 * 3")',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'get_system_info',
    description: 'Get basic system information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'echo',
    description: 'Echo back the input message',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to echo back',
        },
      },
      required: ['message'],
    },
  },
];

// Define resources that the LLM can access
const resources = [
  {
    uri: 'file:///example.txt',
    name: 'Example Text File',
    description: 'A sample text file',
    mimeType: 'text/plain',
  },
  {
    uri: 'file:///config.json',
    name: 'Configuration File',
    description: 'Server configuration information',
    mimeType: 'application/json',
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
    case 'get_current_time':
      return {
        content: [
          {
            type: 'text',
            text: `Current time: ${new Date().toISOString()}`,
          },
        ],
      };

    case 'calculate':
      try {
        const expression = args.expression;
        // Using Function constructor for safe evaluation (be careful in production!)
        const result = Function(`'use strict'; return (${expression})`)();
        return {
          content: [
            {
              type: 'text',
              text: `${expression} = ${result}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error calculating expression: ${error.message}`,
            },
          ],
        };
      }

    case 'get_system_info':
      return {
        content: [
          {
            type: 'text',
            text: `System Information:
- Platform: ${process.platform}
- Node.js Version: ${process.version}
- Architecture: ${process.arch}
- Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          },
        ],
      };

    case 'echo':
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${args.message}`,
          },
        ],
      };

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
    case 'file:///example.txt':
      return {
        contents: [
          {
            uri: 'file:///example.txt',
            mimeType: 'text/plain',
            text: 'This is an example text file content.\nIt contains some sample text for demonstration purposes.',
          },
        ],
      };

    case 'file:///config.json':
      return {
        contents: [
          {
            uri: 'file:///config.json',
            mimeType: 'application/json',
            text: JSON.stringify({
              serverName: 'test-mcp-server',
              version: '1.0.0',
              features: ['tools', 'resources'],
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server started and listening on stdio');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
}); 