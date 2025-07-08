import 'dotenv/config';
import readline from 'readline';
import { MCPClient } from './mcp-client.js';
import { AnthropicLLM } from './anthropic-llm.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Main application that combines MCP client and Anthropic LLM
 */
class MCPAnthropicApp {
  constructor() {
    this.mcpClient = new MCPClient('server.js');
    this.llm = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log('🚀 Initializing MCP Anthropic Client...\n');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required.');
      console.log('Please set your Anthropic API key in the .env file:');
      console.log('ANTHROPIC_API_KEY=your_api_key_here');
      process.exit(1);
    }

    try {
      // Initialize LLM
      this.llm = new AnthropicLLM(apiKey);
      console.log('✅ Anthropic LLM initialized');

      // Connect to MCP server
      console.log('🔌 Connecting to MCP server...');
      await this.mcpClient.connect();
      console.log('✅ Connected to MCP server');

      // Display available tools
      const tools = this.mcpClient.getAvailableTools();
      const resources = this.mcpClient.getAvailableResources();
      
      console.log('\n📋 Available Tools:');
      tools.forEach(tool => {
        console.log(`  • ${tool.name}: ${tool.description}`);
      });

      if (resources.length > 0) {
        console.log('\n📁 Available Resources:');
        resources.forEach(resource => {
          console.log(`  • ${resource.name}: ${resource.description}`);
        });
      }

      console.log('\n💬 You can now chat with me! I can help you with:');
      console.log('  • Getting current time');
      console.log('  • Mathematical calculations');
      console.log('  • System information');
      console.log('  • Echoing messages');
      console.log('  • Reading resources');
      console.log('  • General questions and conversations');
      console.log('\nType "quit" to exit.\n');

    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      process.exit(1);
    }
  }

  async processUserInput(userInput) {
    try {
      const tools = this.mcpClient.getAvailableTools();
      const resources = this.mcpClient.getAvailableResources();

      // Process with LLM
      const result = await this.llm.processUserInput(userInput, tools, resources);

      if (result.type === 'tool_call') {
        console.log(`🔧 Calling tool: ${result.tool_name}`);
        
        // Call the MCP tool
        const toolResult = await this.mcpClient.callTool(result.tool_name, result.arguments);
        
        console.log('📊 Tool Result:');
        toolResult.content.forEach(content => {
          console.log(`  ${content.text}`);
        });

        // Let LLM provide a natural language response based on the tool result
        const followUpPrompt = `The tool "${result.tool_name}" returned: ${toolResult.content[0].text}. 
        Please provide a natural, helpful response to the user's original request: "${userInput}"`;
        
        const followUpResult = await this.llm.processUserInput(followUpPrompt, tools, resources);
        if (followUpResult.type === 'text_response') {
          console.log(`\n🤖 ${followUpResult.content}`);
        }

      } else if (result.type === 'text_response') {
        console.log(`\n🤖 ${result.content}`);
      } else if (result.type === 'error') {
        console.log(`\n❌ ${result.content}`);
      }

    } catch (error) {
      console.error('❌ Error processing request:', error.message);
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
const app = new MCPAnthropicApp();
app.start().catch(error => {
  console.error('❌ Application error:', error);
  process.exit(1);
}); 