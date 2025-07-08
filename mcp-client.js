import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MCP Client for connecting to the MCP server
 */
class MCPClient {
  constructor(serverPath) {
    this.serverPath = serverPath;
    this.serverProcess = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.availableTools = [];
    this.availableResources = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [this.serverPath], {
        cwd: join(__dirname, '..', 'test-mcp-server'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('MCP Server:', data.toString().trim());
      });

      this.serverProcess.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString().trim());
          const pendingRequest = this.pendingRequests.get(response.id);
          if (pendingRequest) {
            this.pendingRequests.delete(response.id);
            pendingRequest.resolve(response);
          }
        } catch (error) {
          console.error('Failed to parse MCP server response:', error);
        }
      });

      this.serverProcess.on('error', (error) => {
        reject(error);
      });

      // Wait for server to start
      setTimeout(async () => {
        try {
          // Initialize by fetching available tools and resources
          await this.initialize();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 1000);
    });
  }

  async initialize() {
    // Get available tools
    const toolsResponse = await this.sendRequest('tools/list');
    this.availableTools = toolsResponse.result.tools;

    // Get available resources
    const resourcesResponse = await this.sendRequest('resources/list');
    this.availableResources = resourcesResponse.result.resources;
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.serverProcess.stdin.write(JSON.stringify(message) + '\n');

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async callTool(name, arguments_ = {}) {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: arguments_
    });
    return response.result;
  }

  async readResource(uri) {
    const response = await this.sendRequest('resources/read', { uri });
    return response.result;
  }

  getAvailableTools() {
    return this.availableTools;
  }

  getAvailableResources() {
    return this.availableResources;
  }

  disconnect() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

export { MCPClient }; 