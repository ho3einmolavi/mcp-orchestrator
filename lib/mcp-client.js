import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Production-ready MCP Client Library
 * 
 * A robust, feature-rich client for connecting to multiple MCP servers
 * with production-level error handling, monitoring, and configuration.
 * 
 * @example
 * ```javascript
 * import { MCPClient } from './lib/mcp-client.js';
 * 
 * const client = new MCPClient({
 *   debug: true,
 *   timeout: 15000,
 *   autoReconnect: true,
 *   maxReconnectAttempts: 3
 * });
 * 
 * client.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
 * await client.connect();
 * 
 * const result = await client.callTool('basic-tools', 'get_current_time', {});
 * console.log(result.content[0].text);
 * 
 * client.disconnect();
 * ```
 */
class MCPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.servers = new Map();
    this.allTools = [];
    this.allResources = [];
    this.messageId = 1;
    this.isConnected = false;
    this.connectionPromise = null;
    
    // Configuration with defaults
    this.config = {
      timeout: options.timeout || 10000,
      debug: options.debug || false,
      autoReconnect: options.autoReconnect || false,
      maxReconnectAttempts: options.maxReconnectAttempts || 3,
      reconnectDelay: options.reconnectDelay || 1000,
      startupDelay: options.startupDelay || 1000,
      ...options
    };
    
    // Health monitoring
    this.healthStatus = new Map();
    this.healthCheckInterval = null;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
    
    this.log('MCPClient initialized with config:', this.config);
  }

  /**
   * Add an MCP server to the client
   * @param {string} name - Unique name for the server
   * @param {string} serverPath - Path to the server file
   * @param {string} workingDir - Working directory for the server process
   * @param {object} options - Server-specific options
   */
  addServer(name, serverPath, workingDir, options = {}) {
    if (this.servers.has(name)) {
      throw new Error(`Server with name '${name}' already exists`);
    }

    const serverConfig = {
      path: serverPath,
      workingDir: workingDir,
      process: null,
      pendingRequests: new Map(),
      tools: [],
      resources: [],
      connected: false,
      reconnectAttempts: 0,
      lastHealthCheck: null,
      options: {
        timeout: this.config.timeout,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        ...options
      }
    };

    this.servers.set(name, serverConfig);
    this.healthStatus.set(name, { healthy: false, lastCheck: null, error: null });
    
    this.log(`Added server: ${name} (${serverPath})`);
    this.emit('serverAdded', { name, path: serverPath, workingDir });
  }

  /**
   * Connect to all registered MCP servers
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) {
      this.log('Already connected');
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  /**
   * Internal connect method
   * @private
   */
  async _connect() {
    this.log('Connecting to MCP servers...');
    
    const connectionPromises = [];
    
    for (const [name, server] of this.servers) {
      connectionPromises.push(this.connectToServer(name, server));
    }

    try {
      await Promise.all(connectionPromises);
      
      // Aggregate all tools and resources
      this.aggregateToolsAndResources();
      
      this.isConnected = true;
      this.log(`Connected to ${this.servers.size} servers`);
      this.emit('connected', { serverCount: this.servers.size });
      
      // Start health monitoring if enabled
      if (this.config.autoReconnect) {
        this.startHealthMonitoring();
      }
      
    } catch (error) {
      this.log('Connection failed:', error.message);
      this.emit('connectionFailed', { error: error.message });
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Connect to a specific MCP server
   * @param {string} name - Server name
   * @param {object} server - Server configuration
   * @returns {Promise<void>}
   */
  async connectToServer(name, server) {
    return new Promise((resolve, reject) => {
      try {
        server.process = spawn('node', [server.path], {
          cwd: server.workingDir,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        server.process.stderr.on('data', (data) => {
          const message = data.toString().trim();
          this.log(`[${name}] ${message}`);
          this.emit('serverLog', { server: name, level: 'stderr', message });
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
            this.log(`[${name}] Failed to parse server response:`, error.message);
            this.emit('error', { server: name, error: error.message });
          }
        });

        server.process.on('error', (error) => {
          this.log(`[${name}] Process error:`, error.message);
          this.emit('error', { server: name, error: error.message });
          reject(error);
        });

        server.process.on('exit', (code, signal) => {
          this.log(`[${name}] Process exited with code ${code}, signal ${signal}`);
          server.connected = false;
          this.healthStatus.set(name, { healthy: false, lastCheck: new Date(), error: `Exited with code ${code}` });
          this.emit('serverDisconnected', { server: name, code, signal });
          
          if (this.config.autoReconnect && server.reconnectAttempts < server.options.maxReconnectAttempts) {
            this.log(`[${name}] Attempting to reconnect... (${server.reconnectAttempts + 1}/${server.options.maxReconnectAttempts})`);
            server.reconnectAttempts++;
            setTimeout(() => {
              this.connectToServer(name, server).catch(err => {
                this.log(`[${name}] Reconnection failed:`, err.message);
              });
            }, this.config.reconnectDelay * server.reconnectAttempts);
          }
        });

        // Wait for server to start and initialize
        setTimeout(async () => {
          try {
            await this.initializeServer(name, server);
            server.connected = true;
            server.reconnectAttempts = 0;
            this.healthStatus.set(name, { healthy: true, lastCheck: new Date(), error: null });
            resolve();
          } catch (error) {
            reject(error);
          }
        }, this.config.startupDelay);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Initialize a server by fetching its tools and resources
   * @param {string} name - Server name
   * @param {object} server - Server configuration
   * @returns {Promise<void>}
   */
  async initializeServer(name, server) {
    try {
      // Get available tools (skip connection check during initialization)
      const toolsResponse = await this.sendRequestToServer(name, 'tools/list', {}, true);
      server.tools = toolsResponse.result.tools;
      this.log(`[${name}] Found ${server.tools.length} tools`);

      // Get available resources (skip connection check during initialization)
      const resourcesResponse = await this.sendRequestToServer(name, 'resources/list', {}, true);
      server.resources = resourcesResponse.result.resources;
      this.log(`[${name}] Found ${server.resources.length} resources`);
      
      this.emit('serverInitialized', { 
        server: name, 
        toolCount: server.tools.length, 
        resourceCount: server.resources.length 
      });
    } catch (error) {
      throw new Error(`Failed to initialize server ${name}: ${error.message}`);
    }
  }

  /**
   * Send a request to a specific server
   * @param {string} serverName - Server name
   * @param {string} method - RPC method
   * @param {object} params - Request parameters
   * @param {boolean} skipConnectionCheck - Skip connection check (for initialization)
   * @returns {Promise<object>}
   */
  async sendRequestToServer(serverName, method, params = {}, skipConnectionCheck = false) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (!skipConnectionCheck && !server.connected) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    if (!server.process) {
      throw new Error(`Server ${serverName} process not started`);
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

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
          const error = new Error(`Request timeout after ${server.options.timeout}ms`);
          this.metrics.failedRequests++;
          reject(error);
        }
      }, server.options.timeout);
    }).then(response => {
      const responseTime = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.metrics.responseTimes.push(responseTime);
      this.metrics.averageResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
      
      this.emit('requestCompleted', { 
        server: serverName, 
        method, 
        responseTime,
        success: true 
      });
      
      return response;
    }).catch(error => {
      this.metrics.failedRequests++;
      this.emit('requestCompleted', { 
        server: serverName, 
        method, 
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message 
      });
      throw error;
    });
  }

  /**
   * Call a tool on a specific server
   * @param {string} serverName - Server name
   * @param {string} toolName - Tool name
   * @param {object} arguments_ - Tool arguments
   * @returns {Promise<object>}
   */
  async callTool(serverName, toolName, arguments_ = {}) {
    this.log(`Calling tool: ${serverName}:${toolName}`, arguments_);
    
    const response = await this.sendRequestToServer(serverName, 'tools/call', {
      name: toolName,
      arguments: arguments_
    });
    
    this.emit('toolCalled', { 
      server: serverName, 
      tool: toolName, 
      arguments: arguments_,
      result: response.result 
    });
    
    return response.result;
  }

  /**
   * Read a resource from a specific server
   * @param {string} serverName - Server name
   * @param {string} uri - Resource URI
   * @returns {Promise<object>}
   */
  async readResource(serverName, uri) {
    this.log(`Reading resource: ${serverName}:${uri}`);
    
    const response = await this.sendRequestToServer(serverName, 'resources/read', { uri });
    
    this.emit('resourceRead', { 
      server: serverName, 
      uri: uri,
      result: response.result 
    });
    
    return response.result;
  }

  /**
   * Get all available tools from all servers
   * @returns {Array<object>}
   */
  getAllTools() {
    return this.allTools;
  }

  /**
   * Get all available resources from all servers
   * @returns {Array<object>}
   */
  getAllResources() {
    return this.allResources;
  }

  /**
   * Get tools for a specific server
   * @param {string} serverName - Server name
   * @returns {Array<object>}
   */
  getServerTools(serverName) {
    const server = this.servers.get(serverName);
    return server ? server.tools : [];
  }

  /**
   * Get resources for a specific server
   * @param {string} serverName - Server name
   * @returns {Array<object>}
   */
  getServerResources(serverName) {
    const server = this.servers.get(serverName);
    return server ? server.resources : [];
  }

  /**
   * Find which server has a specific tool
   * @param {string} toolName - Tool name
   * @returns {string|null}
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
   * @param {string} uri - Resource URI
   * @returns {string|null}
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
   * Check if a server is connected
   * @param {string} serverName - Server name
   * @returns {boolean}
   */
  isServerConnected(serverName) {
    const server = this.servers.get(serverName);
    return server ? server.connected : false;
  }

  /**
   * Get server status information
   * @returns {object}
   */
  getServerStatus() {
    const status = {};
    for (const [name, server] of this.servers) {
      status[name] = {
        connected: server.connected,
        toolCount: server.tools.length,
        resourceCount: server.resources.length,
        reconnectAttempts: server.reconnectAttempts,
        health: this.healthStatus.get(name)
      };
    }
    return status;
  }

  /**
   * Get performance metrics
   * @returns {object}
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Start health monitoring
   * @private
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [name, server] of this.servers) {
        try {
          if (server.connected) {
            // Try a simple tool call to check health
            await this.callTool(name, 'get_current_time', {});
            this.healthStatus.set(name, { healthy: true, lastCheck: new Date(), error: null });
          }
        } catch (error) {
          this.healthStatus.set(name, { healthy: false, lastCheck: new Date(), error: error.message });
          this.emit('serverUnhealthy', { server: name, error: error.message });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Aggregate tools and resources from all servers
   * @private
   */
  aggregateToolsAndResources() {
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
   * Disconnect from all servers
   */
  disconnect() {
    this.log('Disconnecting from all servers...');
    
    this.stopHealthMonitoring();
    
    for (const [name, server] of this.servers) {
      if (server.process) {
        server.process.kill();
        server.connected = false;
      }
    }
    
    this.isConnected = false;
    this.emit('disconnected');
  }

  /**
   * Log message if debug is enabled
   * @param {...any} args - Log arguments
   * @private
   */
  log(...args) {
    if (this.config.debug) {
      console.log('[MCPClient]', ...args);
    }
  }
}

export { MCPClient }; 