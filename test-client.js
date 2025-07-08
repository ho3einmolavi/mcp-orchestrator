import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTestClient {
  constructor() {
    this.serverProcess = null;
    this.messageId = 1;
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('Server stderr:', data.toString());
      });

      this.serverProcess.stdout.on('data', (data) => {
        console.log('Server stdout:', data.toString());
      });

      // Wait a bit for server to start
      setTimeout(resolve, 1000);
    });
  }

  async sendMessage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const message = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method,
        params
      };

      console.log('Sending:', JSON.stringify(message, null, 2));

      this.serverProcess.stdin.write(JSON.stringify(message) + '\n');

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for response'));
      }, 5000);

      this.serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString().trim());
          console.log('Received:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async testTools() {
    console.log('\n=== Testing Tools ===\n');

    // List tools
    console.log('1. Listing available tools...');
    await this.sendMessage('tools/list');

    // Test get_current_time
    console.log('\n2. Testing get_current_time...');
    await this.sendMessage('tools/call', {
      name: 'get_current_time',
      arguments: {}
    });

    // Test calculate
    console.log('\n3. Testing calculate...');
    await this.sendMessage('tools/call', {
      name: 'calculate',
      arguments: { expression: '2 + 2 * 3' }
    });

    // Test get_system_info
    console.log('\n4. Testing get_system_info...');
    await this.sendMessage('tools/call', {
      name: 'get_system_info',
      arguments: {}
    });

    // Test echo
    console.log('\n5. Testing echo...');
    await this.sendMessage('tools/call', {
      name: 'echo',
      arguments: { message: 'Hello, MCP Server!' }
    });
  }

  async testResources() {
    console.log('\n=== Testing Resources ===\n');

    // List resources
    console.log('1. Listing available resources...');
    await this.sendMessage('resources/list');

    // Test reading example.txt
    console.log('\n2. Reading example.txt...');
    await this.sendMessage('resources/read', {
      uri: 'file:///example.txt'
    });

    // Test reading config.json
    console.log('\n3. Reading config.json...');
    await this.sendMessage('resources/read', {
      uri: 'file:///config.json'
    });
  }

  async run() {
    try {
      console.log('Starting MCP server...');
      await this.startServer();
      console.log('Server started successfully!\n');

      await this.testTools();
      await this.testResources();

      console.log('\n=== All tests completed! ===');
    } catch (error) {
      console.error('Error during testing:', error);
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log('\nServer stopped.');
      }
    }
  }
}

// Run the test client
const client = new MCPTestClient();
client.run(); 