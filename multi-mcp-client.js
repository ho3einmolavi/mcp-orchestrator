import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Multi-MCP Client for connecting to multiple MCP servers
 */
class MultiMCPClient {
  constructor() {
    this.servers = new Map();
    this.allTools = [];
    this.allResources = [];
    this.messageId = 1;
  }

  /**
   * Add an MCP server to the client
   */
  addServer(name, serverPath, workingDir) {
    this.servers.set(name, {
      path: serverPath,
      workingDir: workingDir,
      process: null,
      pendingRequests: new Map(),
      tools: [],
      resources: []
    });
  }

  /**
   * Connect to all registered MCP servers
   */
  async connect() {
    const connectionPromises = [];
    
    for (const [name, server] of this.servers) {
      connectionPromises.push(this.connectToServer(name, server));
    }

    await Promise.all(connectionPromises);
    
    // Aggregate all tools and resources
    this.allTools = [];
    this.allResources = [];
    
    for (const [name, server] of this.servers) {
      this.allTools.push(...server.tools.map(tool => ({
        ...tool,
        server: name
      })));
      this.allResources.push(...server.resources.map(resource => ({
        ...resource,
        server: name
      })));
    }
  }

  /**
   * Connect to a specific MCP server
   */
  async connectToServer(name, server) {
    return new Promise((resolve, reject) => {
      server.process = spawn('node', [server.path], {
        cwd: server.workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      server.process.stderr.on('data', (data) => {
        console.log(`[${name}] Server:`, data.toString().trim());
      });

      server.process.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString().trim());
          const pendingRequest = server.pendingRequests.get(response.id);
          if (pendingRequest) {
            server.pendingRequests.delete(response.id);
            pendingRequest.resolve(response);
          }
        } catch (error) {
          console.error(`[${name}] Failed to parse server response:`, error);
        }
      });

      server.process.on('error', (error) => {
        reject(error);
      });

      // Wait for server to start and initialize
      setTimeout(async () => {
        try {
          await this.initializeServer(name, server);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 1000);
    });
  }

  /**
   * Initialize a server by fetching its tools and resources
   */
  async initializeServer(name, server) {
    // Get available tools
    const toolsResponse = await this.sendRequestToServer(name, 'tools/list');
    server.tools = toolsResponse.result.tools;

    // Get available resources
    const resourcesResponse = await this.sendRequestToServer(name, 'resources/list');
    server.resources = resourcesResponse.result.resources;
  }

  /**
   * Send a request to a specific server
   */
  async sendRequestToServer(serverName, method, params = {}) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      server.pendingRequests.set(id, { resolve, reject });
      server.process.stdin.write(JSON.stringify(message) + '\n');

      // Set timeout
      setTimeout(() => {
        if (server.pendingRequests.has(id)) {
          server.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName, toolName, arguments_ = {}) {
    const response = await this.sendRequestToServer(serverName, 'tools/call', {
      name: toolName,
      arguments: arguments_
    });
    return response.result;
  }

  /**
   * Read a resource from a specific server
   */
  async readResource(serverName, uri) {
    const response = await this.sendRequestToServer(serverName, 'resources/read', { uri });
    return response.result;
  }

  /**
   * Get all available tools from all servers
   */
  getAllTools() {
    return this.allTools;
  }

  /**
   * Get all available resources from all servers
   */
  getAllResources() {
    return this.allResources;
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName) {
    for (const [name, server] of this.servers) {
      if (server.tools.some(tool => tool.name === toolName)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Find which server has a specific resource
   */
  findResourceServer(uri) {
    for (const [name, server] of this.servers) {
      if (server.resources.some(resource => resource.uri === uri)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Disconnect from all servers
   */
  disconnect() {
    for (const [name, server] of this.servers) {
      if (server.process) {
        server.process.kill();
      }
    }
  }
}

export { MultiMCPClient }; 