import 'dotenv/config';
import readline from 'readline';
import { MultiMCPClient } from './multi-mcp-client.js';
import { MultiAnthropicLLM } from './multi-anthropic-llm.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Main application that combines multiple MCP servers with Anthropic LLM
 */
class MultiMCPApp {
  constructor() {
    this.mcpClient = new MultiMCPClient();
    this.llm = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log('🚀 Initializing Multi-MCP Anthropic Client...\n');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log('⚠️  No ANTHROPIC_API_KEY found. Running in offline mode with basic tools only.');
      console.log('To enable full AI features, set your Anthropic API key in the .env file:');
      console.log('ANTHROPIC_API_KEY=your_api_key_here\n');
      this.offlineMode = true;
    } else {
      this.offlineMode = false;
    }

    try {
      // Initialize LLM only if API key is available
      if (!this.offlineMode) {
        this.llm = new MultiAnthropicLLM(apiKey);
        console.log('✅ Anthropic LLM initialized');
      } else {
        console.log('✅ Running in offline mode');
      }

      // Add MCP servers
      console.log('🔌 Adding MCP servers...');
      this.mcpClient.addServer('basic-tools', 'server.js', './mcp-servers/basic-tools');
      this.mcpClient.addServer('file-operations', 'server.js', './mcp-servers/file-operations');
      this.mcpClient.addServer('web-services', 'server.js', './mcp-servers/web-services');
      console.log('✅ Added 3 MCP servers');

      // Connect to all MCP servers
      console.log('🔌 Connecting to MCP servers...');
      await this.mcpClient.connect();
      console.log('✅ Connected to all MCP servers');

      // Display available tools and resources
      const allTools = this.mcpClient.getAllTools();
      const allResources = this.mcpClient.getAllResources();
      
      console.log('\n📋 Available Tools by Server:');
      const toolsByServer = {};
      allTools.forEach(tool => {
        const server = tool.server;
        if (!toolsByServer[server]) {
          toolsByServer[server] = [];
        }
        toolsByServer[server].push(tool);
      });

      for (const [server, tools] of Object.entries(toolsByServer)) {
        console.log(`\n  ${server.toUpperCase()} SERVER:`);
        tools.forEach(tool => {
          console.log(`    • ${tool.name}: ${tool.description}`);
        });
      }

      if (allResources.length > 0) {
        console.log('\n📁 Available Resources by Server:');
        const resourcesByServer = {};
        allResources.forEach(resource => {
          const server = resource.server;
          if (!resourcesByServer[server]) {
            resourcesByServer[server] = [];
          }
          resourcesByServer[server].push(resource);
        });

        for (const [server, resources] of Object.entries(resourcesByServer)) {
          console.log(`\n  ${server.toUpperCase()} SERVER:`);
          resources.forEach(resource => {
            console.log(`    • ${resource.name}: ${resource.description}`);
          });
        }
      }

      console.log('\n💬 You can now chat with me! I can help you with:');
      console.log('  • Basic operations (time, calculations, system info, echo)');
      console.log('  • File operations (list, read, write, create directories)');
      console.log('  • Web services (HTTP requests, weather, translation, currency)');
      console.log('  • General questions and conversations');
      console.log('\nThe LLM will automatically choose the most appropriate server and tool for your request.');
      console.log('\nType "quit" to exit.\n');

    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      process.exit(1);
    }
  }

  /**
   * Simple fallback command parser for when API is overloaded
   */
  async processFallbackCommand(userInput) {
    const input = userInput.toLowerCase().trim();
    
    // Check for multi-step requests first
    if (this.isMultiStepRequest(input)) {
      await this.executeFallbackMultiStep(input);
      return;
    }
    
    // Single-step commands
    if (input.includes('time') || input.includes('what time') || input.includes('current time')) {
      const toolResult = await this.mcpClient.callTool('basic-tools', 'get_current_time', {});
      console.log('📊 Tool Result:');
      toolResult.content.forEach(content => {
        console.log(`  ${content.text}`);
      });
      return;
    }
    
    // Calculation commands
    if (input.includes('calculate') || input.includes('math') || input.includes('compute')) {
      // Extract mathematical expression
      const match = userInput.match(/(?:calculate|compute|math)\s+(.+)/i);
      if (match) {
        const expression = match[1].trim();
        const toolResult = await this.mcpClient.callTool('basic-tools', 'calculate', { expression });
        console.log('📊 Tool Result:');
        toolResult.content.forEach(content => {
          console.log(`  ${content.text}`);
        });
        return;
      }
    }
    
    // System info commands
    if (input.includes('system') || input.includes('info') || input.includes('platform')) {
      const toolResult = await this.mcpClient.callTool('basic-tools', 'get_system_info', {});
      console.log('📊 Tool Result:');
      toolResult.content.forEach(content => {
        console.log(`  ${content.text}`);
      });
      return;
    }
    
    // Echo commands
    if (input.includes('echo') || input.includes('repeat')) {
      const match = userInput.match(/(?:echo|repeat)\s+(.+)/i);
      if (match) {
        const message = match[1].trim();
        const toolResult = await this.mcpClient.callTool('basic-tools', 'echo', { message });
        console.log('📊 Tool Result:');
        toolResult.content.forEach(content => {
          console.log(`  ${content.text}`);
        });
        return;
      }
    }
    
    // File listing commands
    if (input.includes('list files') || input.includes('show files') || input.includes('directory')) {
      const toolResult = await this.mcpClient.callTool('file-operations', 'list_files', {});
      console.log('📊 Tool Result:');
      toolResult.content.forEach(content => {
        console.log(`  ${content.text}`);
      });
      return;
    }
    
    console.log('\n🤖 I\'m currently in fallback mode due to API overload. I can help with:');
    console.log('  • "what time is it" - Get current time');
    console.log('  • "calculate 2 + 2" - Perform calculations');
    console.log('  • "system info" - Get system information');
    console.log('  • "echo hello" - Echo a message');
    console.log('  • "list files" - List files in current directory');
    console.log('  • "get system info and write to file" - Multi-step operation');
    console.log('  • "get time and write to file" - Multi-step operation');
  }

  /**
   * Check if a request is multi-step
   */
  isMultiStepRequest(input) {
    const multiStepKeywords = ['and', 'then', 'after', 'next', 'also'];
    const actionKeywords = ['get', 'write', 'create', 'read', 'list', 'calculate', 'check'];
    
    // Check if input contains multiple actions
    const actionCount = actionKeywords.filter(keyword => input.includes(keyword)).length;
    const hasConnector = multiStepKeywords.some(keyword => input.includes(keyword));
    
    return actionCount > 1 || hasConnector;
  }

  /**
   * Execute multi-step requests in fallback mode
   */
  async executeFallbackMultiStep(input) {
    console.log('🔄 Fallback mode: Multi-step requests require AI assistance.');
    console.log('Please try again when the API is available, or use single-step commands:');
    console.log('  • "what time is it" - Get current time');
    console.log('  • "system info" - Get system information');
    console.log('  • "list files" - List files in directory');
    console.log('  • "calculate 2 + 2" - Perform calculations');
  }

  async processUserInput(userInput) {
    try {
      // If in offline mode, use fallback command parser
      if (this.offlineMode) {
        await this.processFallbackCommand(userInput);
        return;
      }

      const allTools = this.mcpClient.getAllTools();
      const allResources = this.mcpClient.getAllResources();

      // Process with LLM
      const result = await this.llm.processUserInput(userInput, allTools, allResources);

      if (result.type === 'tool_call') {
        // Iterate through tool calls until task is complete
        await this.executeMultiStepRequest(userInput, result, allTools, allResources);
      } else if (result.type === 'text_response') {
        console.log(`\n🤖 ${result.content}`);
      } else if (result.type === 'error') {
        console.log(`\n❌ ${result.content}`);
        console.log('🔄 Switching to fallback mode...');
        await this.processFallbackCommand(userInput);
      }

    } catch (error) {
      console.error('❌ Error processing request:', error.message);
      console.log('🔄 Switching to fallback mode...');
      await this.processFallbackCommand(userInput);
    }
  }

  async executeMultiStepRequest(originalRequest, firstResult, allTools, allResources) {
    let currentResult = firstResult;
    let stepCount = 0;
    const maxSteps = 10; // Prevent infinite loops

    while (stepCount < maxSteps) {
      stepCount++;
      
      if (currentResult.type === 'tool_call') {
        console.log(`🔧 Step ${stepCount}: Calling tool: ${currentResult.tool_name} on server: ${currentResult.server}`);
        
        // Call the MCP tool
        const toolResult = await this.mcpClient.callTool(currentResult.server, currentResult.tool_name, currentResult.arguments);
        
        console.log('📊 Tool Result:');
        toolResult.content.forEach(content => {
          console.log(`  ${content.text}`);
        });

        // Check if we need to continue with more steps
        const toolResultText = toolResult.content[0].text;
        const followUpPrompt = `The tool "${currentResult.tool_name}" returned: ${toolResultText}. 
        
        Original user request: "${originalRequest}"
        
        CRITICAL: You MUST analyze if the user's request is complete or if another tool call is needed.
        
        If the task requires another step, respond with JSON format:
        {
          "action": "call_tool",
          "server": "server_name",
          "tool_name": "tool_name",
          "arguments": {
            "param1": "value1"
          }
        }
        
        If the task is complete, respond with:
        {
          "action": "final_answer",
          "content": "Your natural language summary of what was accomplished"
        }
        
        IMPORTANT: Keep iterating with tool calls until the user's request is fully satisfied, then use final_answer.`;

        currentResult = await this.llm.processUserInput(followUpPrompt, allTools, allResources);
      } else if (currentResult.type === 'final_answer') {
        console.log(`\n🤖 ${currentResult.content}`);
        break;
      } else if (currentResult.type === 'text_response') {
        console.log(`\n🤖 ${currentResult.content}`);
        break;
      } else if (currentResult.type === 'error') {
        console.log(`\n❌ ${currentResult.content}`);
        break;
      }
    }

    if (stepCount >= maxSteps) {
      console.log(`\n⚠️  Reached maximum number of steps (${maxSteps}). Stopping execution.`);
    }
  }

  async start() {
    await this.initialize();

    this.rl.on('line', async (input) => {
      const userInput = input.trim();
      
      if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        this.cleanup();
        process.exit(0);
      }

      if (userInput) {
        console.log(`\n👤 You: ${userInput}`);
        await this.processUserInput(userInput);
        console.log('\n' + '─'.repeat(50) + '\n');
      }
    });

    this.rl.on('close', () => {
      this.cleanup();
    });
  }

  cleanup() {
    if (this.mcpClient) {
      this.mcpClient.disconnect();
    }
    if (this.rl) {
      this.rl.close();
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

// Start the application
const app = new MultiMCPApp();
app.start().catch(error => {
  console.error('❌ Application error:', error);
  process.exit(1);
}); 