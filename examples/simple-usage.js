import { MCPClient } from '../lib/mcp-client.js';

/**
 * Simple example of using the production-ready MCPClient
 */

async function simpleExample() {
  console.log('🚀 Simple MCP Client Example\n');

  // Create client with production configuration
  const client = new MCPClient({
    debug: true,
    timeout: 15000,
    autoReconnect: true,
    maxReconnectAttempts: 3
  });

  try {
    // Add servers
    client.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
    client.addServer('file-ops', 'server.js', './mcp-servers/file-operations');

    // Set up event listeners
    client.on('connected', (data) => {
      console.log(`✅ Connected to ${data.serverCount} servers`);
    });

    client.on('toolCalled', (data) => {
      console.log(`🔧 Called: ${data.server}:${data.tool}`);
    });

    client.on('error', (data) => {
      console.error(`❌ Error: ${data.server} - ${data.error}`);
    });

    // Connect to all servers
    await client.connect();

    // Call some tools
    console.log('\n📊 Calling tools...\n');

    const timeResult = await client.callTool('basic-tools', 'get_current_time', {});
    console.log('Current time:', timeResult.content[0].text);

    const calcResult = await client.callTool('basic-tools', 'calculate', { expression: '15 * 3 + 7' });
    console.log('Calculation result:', calcResult.content[0].text);

    const filesResult = await client.callTool('file-ops', 'list_files', {});
    console.log('Files in directory:', filesResult.content[0].text);

    // Show status
    console.log('\n📊 Server Status:');
    const status = client.getServerStatus();
    for (const [server, info] of Object.entries(status)) {
      console.log(`  ${server}: ${info.connected ? 'Connected' : 'Disconnected'} (${info.toolCount} tools)`);
    }

    // Show metrics
    console.log('\n📈 Performance Metrics:');
    const metrics = client.getMetrics();
    console.log(`  Total requests: ${metrics.totalRequests}`);
    console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(0)}ms`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Clean up
    client.disconnect();
    console.log('\n👋 Disconnected from all servers');
  }
}

// Run the example
simpleExample(); 