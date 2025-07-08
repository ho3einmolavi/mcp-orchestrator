import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic LLM Client for processing user requests and calling MCP tools
 */
class AnthropicLLM {
  constructor(apiKey) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    this.conversationHistory = [];
  }

  /**
   * Generate a system prompt that includes available MCP tools
   */
  generateSystemPrompt(availableTools, availableResources) {
    let prompt = `You are a helpful AI assistant that can call tools to help users with their requests.

Available Tools:
`;

    availableTools.forEach(tool => {
      prompt += `- ${tool.name}: ${tool.description}\n`;
      if (tool.inputSchema && tool.inputSchema.properties) {
        const props = Object.entries(tool.inputSchema.properties);
        if (props.length > 0) {
          prompt += `  Parameters: ${props.map(([key, value]) => `${key} (${value.type})`).join(', ')}\n`;
        }
      }
      prompt += '\n';
    });

    if (availableResources.length > 0) {
      prompt += `Available Resources:
`;
      availableResources.forEach(resource => {
        prompt += `- ${resource.name}: ${resource.description} (${resource.uri})\n`;
      });
      prompt += '\n';
    }

    prompt += `When a user asks for something that requires calling a tool, respond with a JSON object in this exact format:
{
  "action": "call_tool",
  "tool_name": "tool_name_here",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}

For example, if someone asks "what time is it?", you would respond:
{
  "action": "call_tool",
  "tool_name": "get_current_time",
  "arguments": {}
}

If someone asks "calculate 5 + 3", you would respond:
{
  "action": "call_tool",
  "tool_name": "calculate",
  "arguments": {
    "expression": "5 + 3"
  }
}

If the user's request doesn't require calling a tool, respond normally with helpful information.

Always respond with valid JSON when calling tools, and regular text for normal conversations.`;

    return prompt;
  }

  /**
   * Process user input and determine if a tool should be called
   */
  async processUserInput(userInput, availableTools, availableResources) {
    const systemPrompt = this.generateSystemPrompt(availableTools, availableResources);
    
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
      
      // Try to parse as JSON to see if it's a tool call
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.action === 'call_tool') {
          return {
            type: 'tool_call',
            tool_name: parsed.tool_name,
            arguments: parsed.arguments
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

export { AnthropicLLM }; 