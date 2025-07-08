import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Simple MCP Client Example
 * 
 * This example shows how to connect to the MCP server from another application.
 * You can use this as a starting point for integrating MCP into your own projects.
 */

class SimpleMCPClient {
  constructor(serverPath) {
    this.serverPath = serverPath;
    this.serverProcess = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [this.serverPath], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('Server:', data.toString().trim());
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
          console.error('Failed to parse server response:', error);
        }
      });

      this.serverProcess.on('error', (error) => {
        reject(error);
      });

      // Wait a moment for server to start
      setTimeout(resolve, 1000);
    });
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

  async listTools() {
    const response = await this.sendRequest('tools/list');
    return response.result.tools;
  }

  async callTool(name, arguments_ = {}) {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: arguments_
    });
    return response.result;
  }

  async listResources() {
    const response = await this.sendRequest('resources/list');
    return response.result.resources;
  }

  async readResource(uri) {
    const response = await this.sendRequest('resources/read', { uri });
    return response.result;
  }

  disconnect() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

// Example usage
async function main() {
  const client = new SimpleMCPClient('server.js');
  
  try {
    console.log('Connecting to MCP server...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Example 1: List available tools
    console.log('Available tools:');
    const tools = await client.listTools();
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // Example 2: Call a tool
    console.log('\nCalling get_current_time tool:');
    const timeResult = await client.callTool('get_current_time');
    console.log('Result:', timeResult.content[0].text);

    // Example 3: Perform a calculation
    console.log('\nPerforming calculation:');
    const calcResult = await client.callTool('calculate', {
      expression: '10 * 5 + 2'
    });
    console.log('Result:', calcResult.content[0].text);

    // Example 4: List available resources
    console.log('\nAvailable resources:');
    const resources = await client.listResources();
    resources.forEach(resource => {
      console.log(`- ${resource.name}: ${resource.description}`);
    });

    // Example 5: Read a resource
    console.log('\nReading example.txt:');
    const fileContent = await client.readResource('file:///example.txt');
    console.log('Content:', fileContent.contents[0].text);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.disconnect();
    console.log('\nDisconnected from server.');
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SimpleMCPClient }; 