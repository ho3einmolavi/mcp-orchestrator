import Anthropic from '@anthropic-ai/sdk';

/**
 * Enhanced Anthropic LLM Client for processing user requests and calling tools from multiple MCP servers
 */
class MultiAnthropicLLM {
  constructor(apiKey) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    this.conversationHistory = [];
  }

  /**
   * Generate a system prompt that includes available MCP tools from all servers
   */
  generateSystemPrompt(allTools, allResources) {
    let prompt = `You are a helpful AI assistant that can call tools from multiple MCP servers to help users with their requests.

Available Tools (organized by server):
`;

    // Group tools by server
    const toolsByServer = {};
    allTools.forEach(tool => {
      const server = tool.server;
      if (!toolsByServer[server]) {
        toolsByServer[server] = [];
      }
      toolsByServer[server].push(tool);
    });

    // List tools by server
    for (const [server, tools] of Object.entries(toolsByServer)) {
      prompt += `\n${server.toUpperCase()} SERVER:\n`;
      tools.forEach(tool => {
        prompt += `- ${tool.name}: ${tool.description}\n`;
        if (tool.inputSchema && tool.inputSchema.properties) {
          const props = Object.entries(tool.inputSchema.properties);
          if (props.length > 0) {
            prompt += `  Parameters: ${props.map(([key, value]) => `${key} (${value.type})`).join(', ')}\n`;
          }
        }
        prompt += '\n';
      });
    }

    if (allResources.length > 0) {
      prompt += `Available Resources (by server):\n`;
      const resourcesByServer = {};
      allResources.forEach(resource => {
        const server = resource.server;
        if (!resourcesByServer[server]) {
          resourcesByServer[server] = [];
        }
        resourcesByServer[server].push(resource);
      });

      for (const [server, resources] of Object.entries(resourcesByServer)) {
        prompt += `\n${server.toUpperCase()} SERVER:\n`;
        resources.forEach(resource => {
          prompt += `- ${resource.name}: ${resource.description} (${resource.uri})\n`;
        });
      }
      prompt += '\n';
    }

    prompt += `When a user asks for something that requires calling a tool, respond with ONLY a JSON object in this exact format:
{
  "action": "call_tool",
  "server": "server_name",
  "tool_name": "tool_name_here",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}

IMPORTANT: Do NOT include any explanatory text before or after the JSON. Respond with ONLY the JSON object.

For example, if someone asks "what time is it?", you would respond with ONLY:
{
  "action": "call_tool",
  "server": "basic-tools",
  "tool_name": "get_current_time",
  "arguments": {}
}

If someone asks "list files in the current directory", you would respond with ONLY:
{
  "action": "call_tool",
  "server": "file-operations",
  "tool_name": "list_files",
  "arguments": {}
}

If someone asks "what's the weather in London?", you would respond with ONLY:
{
  "action": "call_tool",
  "server": "web-services",
  "tool_name": "check_weather",
  "arguments": {
    "location": "London"
  }
}

For multi-step requests that include file operations (like "get time and write to file"), start with the information gathering tool first.

For multi-step requests, the system will iterate and ask you if more tools are needed. When the task is complete, respond with ONLY:
{
  "action": "final_answer",
  "content": "Your natural language summary of what was accomplished"
}

If the user's request requires multiple tools or can be done with different tools, choose the most appropriate one. If the user's request doesn't require calling a tool, respond normally with helpful information.

CRITICAL: Always respond with ONLY valid JSON when calling tools or providing final answers, and regular text for normal conversations. Never mix JSON with explanatory text.`;

    return prompt;
  }

  /**
   * Process user input and determine if a tool should be called
   */
  async processUserInput(userInput, allTools, allResources) {
    const systemPrompt = this.generateSystemPrompt(allTools, allResources);
    
    const messages = [
      {
        role: 'user',
        content: userInput
      }
    ];

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      });

      const responseText = response.content[0].text.trim();
      
      // Debug: Log the raw response for troubleshooting
      if (responseText.includes('{') && responseText.includes('}')) {
        console.log('🔍 Debug: LLM response contains JSON-like content');
        console.log('Raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
      }
      
      // Try to extract JSON from the response (handles mixed text + JSON)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action === 'call_tool') {
            return {
              type: 'tool_call',
              server: parsed.server,
              tool_name: parsed.tool_name,
              arguments: parsed.arguments
            };
          } else if (parsed.action === 'final_answer') {
            return {
              type: 'final_answer',
              content: parsed.content
            };
          }
        } catch (e) {
          // JSON parsing failed, continue to treat as regular response
          console.log('⚠️  Failed to parse JSON from response:', e.message);
        }
      }

      // Try to parse as pure JSON first (for backward compatibility)
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.action === 'call_tool') {
          return {
            type: 'tool_call',
            server: parsed.server,
            tool_name: parsed.tool_name,
            arguments: parsed.arguments
          };
        } else if (parsed.action === 'final_answer') {
          return {
            type: 'final_answer',
            content: parsed.content
          };
        }
      } catch (e) {
        // Not JSON, treat as regular response
      }

      return {
        type: 'text_response',
        content: responseText
      };

    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      return {
        type: 'error',
        content: 'Sorry, I encountered an error processing your request.'
      };
    }
  }

  /**
   * Generate a follow-up response based on tool results
   */
  async generateFollowUpResponse(originalRequest, toolResult, server, toolName, allTools, allResources) {
    const followUpPrompt = `The tool "${toolName}" from server "${server}" returned: ${toolResult.content[0].text}. 
    Please provide a natural, helpful response to the user's original request: "${originalRequest}"`;
    
    const systemPrompt = this.generateSystemPrompt(allTools, allResources);
    
    const messages = [
      {
        role: 'user',
        content: followUpPrompt
      }
    ];

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages
      });

      return response.content[0].text.trim();
    } catch (error) {
      console.error('Error generating follow-up response:', error);
      return `The ${toolName} tool returned: ${toolResult.content[0].text}`;
    }
  }

  /**
   * Add conversation context
   */
  addToHistory(role, content) {
    this.conversationHistory.push({ role, content });
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}

export { MultiAnthropicLLM }; 