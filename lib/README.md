# Production-Ready MCP Client Library

A robust, feature-rich client library for connecting to multiple Model Context Protocol (MCP) servers with production-level error handling, monitoring, and configuration.

## 🚀 Features

- **🔌 Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **🛠️ Tool Management**: Call tools across different servers with ease
- **📁 Resource Handling**: Read resources from any connected server
- **🔄 Auto-Reconnection**: Automatic reconnection with configurable retry logic
- **📊 Event System**: Built-in event system for monitoring and logging
- **⚡ High Performance**: Efficient connection management and request handling
- **🛡️ Error Handling**: Comprehensive error handling and timeout management
- **🔧 Configurable**: Flexible configuration options for different use cases
- **📈 Metrics**: Built-in performance metrics and health monitoring
- **🏥 Health Checks**: Automatic health monitoring and status reporting

## 📦 Installation

Copy the library file to your project:

```bash
cp lib/mcp-client.js your-project/
```

## 🚀 Quick Start

```javascript
import { MCPClient } from './lib/mcp-client.js';

// Create client instance
const client = new MCPClient({
  debug: true,
  timeout: 15000,
  autoReconnect: true,
  maxReconnectAttempts: 3
});

// Add MCP servers
client.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
client.addServer('file-ops', 'server.js', './mcp-servers/file-operations');

// Connect to all servers
await client.connect();

// Call a tool
const result = await client.callTool('basic-tools', 'get_current_time', {});
console.log(result.content[0].text);

// Disconnect when done
client.disconnect();
```

## 📚 API Reference

### Constructor

```javascript
new MCPClient(options)
```

**Options:**
- `timeout` (number): Request timeout in milliseconds (default: 10000)
- `debug` (boolean): Enable debug logging (default: false)
- `autoReconnect` (boolean): Enable auto-reconnection (default: false)
- `maxReconnectAttempts` (number): Maximum reconnection attempts (default: 3)
- `reconnectDelay` (number): Delay between reconnection attempts (default: 1000)
- `startupDelay` (number): Delay before initializing server (default: 1000)

### Methods

#### `addServer(name, serverPath, workingDir, options)`

Add an MCP server to the client.

```javascript
client.addServer('my-server', 'server.js', './mcp-servers/my-server', {
  timeout: 15000,
  maxReconnectAttempts: 5
});
```

#### `connect()`

Connect to all registered MCP servers.

```javascript
await client.connect();
```

#### `callTool(serverName, toolName, arguments)`

Call a tool on a specific server.

```javascript
const result = await client.callTool('basic-tools', 'calculate', {
  expression: '2 + 2 * 3'
});
```

#### `readResource(serverName, uri)`

Read a resource from a specific server.

```javascript
const resource = await client.readResource('file-ops', 'file:///example.txt');
```

#### `getAllTools()`

Get all available tools from all servers.

```javascript
const tools = client.getAllTools();
console.log(tools.map(t => `${t.server}:${t.name}`));
```

#### `getServerStatus()`

Get status information for all servers.

```javascript
const status = client.getServerStatus();
// Returns: { 'server-name': { connected: true, toolCount: 4, health: {...} } }
```

#### `getMetrics()`

Get performance metrics.

```javascript
const metrics = client.getMetrics();
// Returns: { totalRequests: 10, successfulRequests: 9, averageResponseTime: 150 }
```

#### `disconnect()`

Disconnect from all servers.

```javascript
client.disconnect();
```

### Events

The client extends EventEmitter and emits the following events:

```javascript
// Connection events
client.on('connected', (data) => {
  console.log(`Connected to ${data.serverCount} servers`);
});

client.on('connectionFailed', (data) => {
  console.error(`Connection failed: ${data.error}`);
});

client.on('disconnected', () => {
  console.log('Disconnected from all servers');
});

// Server events
client.on('serverAdded', (data) => {
  console.log(`Added server: ${data.name}`);
});

client.on('serverInitialized', (data) => {
  console.log(`Server ${data.server} initialized with ${data.toolCount} tools`);
});

client.on('serverDisconnected', (data) => {
  console.log(`Server ${data.server} disconnected`);
});

client.on('serverUnhealthy', (data) => {
  console.log(`Server ${data.server} is unhealthy: ${data.error}`);
});

// Tool and resource events
client.on('toolCalled', (data) => {
  console.log(`Tool called: ${data.server}:${data.tool}`);
});

client.on('resourceRead', (data) => {
  console.log(`Resource read: ${data.server}:${data.uri}`);
});

// Request events
client.on('requestCompleted', (data) => {
  if (data.success) {
    console.log(`Request completed: ${data.server}:${data.method} (${data.responseTime}ms)`);
  } else {
    console.error(`Request failed: ${data.server}:${data.method} - ${data.error}`);
  }
});

// Error events
client.on('error', (data) => {
  console.error(`Server error: ${data.server} - ${data.error}`);
});

client.on('serverLog', (data) => {
  console.log(`[${data.server}] ${data.message}`);
});
```

## 🔧 Integration Examples

### Express.js Integration

```javascript
import express from 'express';
import { MCPClient } from './lib/mcp-client.js';

const app = express();
app.use(express.json());

// Create MCP client
const client = new MCPClient({ debug: true });

// Initialize MCP servers
async function initializeMCP() {
  client.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
  client.addServer('file-ops', 'server.js', './mcp-servers/file-operations');
  await client.connect();
}

// API Routes
app.get('/api/time', async (req, res) => {
  try {
    const result = await client.callTool('basic-tools', 'get_current_time', {});
    res.json({ time: result.content[0].text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: client.getServerStatus(),
    metrics: client.getMetrics()
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  client.disconnect();
  process.exit(0);
});

// Start server
initializeMCP().then(() => {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
});
```

### Fastify Integration

```javascript
import Fastify from 'fastify';
import { MCPClient } from './lib/mcp-client.js';

const fastify = Fastify({ logger: true });
const client = new MCPClient({ debug: true });

// Initialize MCP
async function initializeMCP() {
  client.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
  await client.connect();
}

// Routes
fastify.get('/api/time', async (request, reply) => {
  try {
    const result = await client.callTool('basic-tools', 'get_current_time', {});
    return { time: result.content[0].text };
  } catch (error) {
    reply.code(500);
    return { error: error.message };
  }
});

// Graceful shutdown
fastify.addHook('onClose', async () => {
  client.disconnect();
});

// Start server
initializeMCP().then(() => {
  fastify.listen({ port: 3000 });
});
```

## 🛠️ Advanced Usage

### Custom Error Handling

```javascript
const client = new MCPClient({ debug: true });

client.on('error', (data) => {
  // Log to your logging service
  logger.error(`MCP Error: ${data.server} - ${data.error}`);
  
  // Send alert if critical
  if (data.error.includes('timeout')) {
    sendAlert(`MCP server ${data.server} is not responding`);
  }
});

client.on('serverUnhealthy', (data) => {
  // Attempt manual reconnection
  setTimeout(() => {
    client.connect().catch(err => {
      logger.error('Manual reconnection failed:', err);
    });
  }, 5000);
});
```

### Health Monitoring

```javascript
// Enable auto-reconnection and health monitoring
const client = new MCPClient({
  autoReconnect: true,
  maxReconnectAttempts: 5
});

// Monitor health status
client.on('serverUnhealthy', (data) => {
  console.log(`Server ${data.server} became unhealthy: ${data.error}`);
});

// Get health status
setInterval(() => {
  const status = client.getServerStatus();
  for (const [server, info] of Object.entries(status)) {
    if (!info.health?.healthy) {
      console.log(`Warning: ${server} is unhealthy`);
    }
  }
}, 60000); // Check every minute
```

### Performance Monitoring

```javascript
// Monitor performance metrics
client.on('requestCompleted', (data) => {
  if (data.responseTime > 5000) {
    console.warn(`Slow request: ${data.server}:${data.method} took ${data.responseTime}ms`);
  }
});

// Get metrics periodically
setInterval(() => {
  const metrics = client.getMetrics();
  console.log(`Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
  console.log(`Average response time: ${metrics.averageResponseTime.toFixed(0)}ms`);
}, 30000); // Every 30 seconds
```

## 🐛 Troubleshooting

### Common Issues

1. **Server Connection Failed**
   ```javascript
   // Check if server file exists
   const fs = require('fs');
   if (!fs.existsSync('./mcp-servers/basic-tools/server.js')) {
     console.error('Server file not found');
   }
   ```

2. **Tool Not Found**
   ```javascript
   // Check available tools
   const tools = client.getAllTools();
   const toolExists = tools.some(t => t.name === 'my_tool');
   if (!toolExists) {
     console.error('Tool not found');
   }
   ```

3. **Timeout Issues**
   ```javascript
   // Increase timeout for slow operations
   client.addServer('slow-server', 'server.js', './mcp-servers/slow-server', {
     timeout: 30000 // 30 seconds
   });
   ```

### Debug Mode

Enable debug mode to see detailed logs:

```javascript
const client = new MCPClient({ debug: true });
```

### Error Handling Best Practices

```javascript
try {
  const result = await client.callTool('server', 'tool', {});
  // Handle success
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout
  } else if (error.message.includes('not found')) {
    // Handle not found
  } else {
    // Handle other errors
  }
}
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the examples in `examples/simple-usage.js` 