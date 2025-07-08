import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create MCP server instance for web services
const server = new Server(
  {
    name: 'web-services-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define web service tools
const tools = [
  {
    name: 'http_get',
    description: 'Make an HTTP GET request to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to make the GET request to',
        },
        headers: {
          type: 'object',
          description: 'Optional headers to include in the request',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'http_post',
    description: 'Make an HTTP POST request to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to make the POST request to',
        },
        data: {
          type: 'object',
          description: 'Data to send in the POST request body',
        },
        headers: {
          type: 'object',
          description: 'Optional headers to include in the request',
        },
      },
      required: ['url', 'data'],
    },
  },
  {
    name: 'check_weather',
    description: 'Get weather information for a location (mock data)',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or location to get weather for',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'translate_text',
    description: 'Translate text between languages (mock service)',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to translate',
        },
        from: {
          type: 'string',
          description: 'Source language code (e.g., "en", "es", "fr")',
        },
        to: {
          type: 'string',
          description: 'Target language code (e.g., "en", "es", "fr")',
        },
      },
      required: ['text', 'from', 'to'],
    },
  },
  {
    name: 'currency_convert',
    description: 'Convert between currencies (mock service)',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount to convert',
        },
        from: {
          type: 'string',
          description: 'Source currency code (e.g., "USD", "EUR", "GBP")',
        },
        to: {
          type: 'string',
          description: 'Target currency code (e.g., "USD", "EUR", "GBP")',
        },
      },
      required: ['amount', 'from', 'to'],
    },
  },
];

// Define web service resources
const resources = [
  {
    uri: 'web:///api-status',
    name: 'API Status',
    description: 'Status of available web services',
    mimeType: 'application/json',
  },
];

// Mock data for demo purposes
const mockWeatherData = {
  'New York': { temp: 22, condition: 'Sunny', humidity: 65 },
  'London': { temp: 15, condition: 'Cloudy', humidity: 80 },
  'Tokyo': { temp: 28, condition: 'Rainy', humidity: 75 },
  'Sydney': { temp: 25, condition: 'Clear', humidity: 60 },
};

const mockTranslations = {
  'hello': { es: 'hola', fr: 'bonjour', de: 'hallo' },
  'goodbye': { es: 'adiós', fr: 'au revoir', de: 'auf wiedersehen' },
  'thank you': { es: 'gracias', fr: 'merci', de: 'danke' },
};

const mockExchangeRates = {
  'USD': { EUR: 0.85, GBP: 0.73, JPY: 110.5 },
  'EUR': { USD: 1.18, GBP: 0.86, JPY: 130.0 },
  'GBP': { USD: 1.37, EUR: 1.16, JPY: 151.4 },
};

// Handle tool calls
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'http_get':
      try {
        // In a real implementation, you would use fetch or axios
        // For demo purposes, we'll return mock data
        const mockResponse = {
          url: args.url,
          status: 200,
          headers: args.headers || {},
          data: `Mock GET response for ${args.url}`,
          timestamp: new Date().toISOString(),
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `HTTP GET Response:\n${JSON.stringify(mockResponse, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error making HTTP GET request: ${error.message}`,
            },
          ],
        };
      }

    case 'http_post':
      try {
        const mockResponse = {
          url: args.url,
          method: 'POST',
          status: 200,
          headers: args.headers || {},
          sentData: args.data,
          response: `Mock POST response for ${args.url}`,
          timestamp: new Date().toISOString(),
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `HTTP POST Response:\n${JSON.stringify(mockResponse, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error making HTTP POST request: ${error.message}`,
            },
          ],
        };
      }

    case 'check_weather':
      try {
        const location = args.location;
        const weather = mockWeatherData[location] || {
          temp: Math.floor(Math.random() * 30) + 10,
          condition: ['Sunny', 'Cloudy', 'Rainy', 'Clear'][Math.floor(Math.random() * 4)],
          humidity: Math.floor(Math.random() * 40) + 50,
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `Weather in ${location}:\n- Temperature: ${weather.temp}°C\n- Condition: ${weather.condition}\n- Humidity: ${weather.humidity}%`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting weather: ${error.message}`,
            },
          ],
        };
      }

    case 'translate_text':
      try {
        const { text, from, to } = args;
        let translation = text; // Default to original text
        
        if (from !== to) {
          const lowerText = text.toLowerCase();
          if (mockTranslations[lowerText] && mockTranslations[lowerText][to]) {
            translation = mockTranslations[lowerText][to];
          } else {
            // Mock translation by adding language prefix
            translation = `[${to.toUpperCase()}] ${text}`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Translation (${from} → ${to}):\nOriginal: ${text}\nTranslated: ${translation}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error translating text: ${error.message}`,
            },
          ],
        };
      }

    case 'currency_convert':
      try {
        const { amount, from, to } = args;
        let convertedAmount = amount;
        
        if (from !== to) {
          const rates = mockExchangeRates[from];
          if (rates && rates[to]) {
            convertedAmount = amount * rates[to];
          } else {
            // Mock conversion with random factor
            convertedAmount = amount * (0.5 + Math.random());
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Currency Conversion:\n${amount} ${from} = ${convertedAmount.toFixed(2)} ${to}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error converting currency: ${error.message}`,
            },
          ],
        };
      }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Handle resource requests
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'web:///api-status':
      return {
        contents: [
          {
            uri: 'web:///api-status',
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'operational',
              services: [
                'HTTP GET/POST requests',
                'Weather information',
                'Text translation',
                'Currency conversion'
              ],
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Web Services MCP Server started and listening on stdio');
}

main().catch((error) => {
  console.error('Failed to start Web Services MCP server:', error);
  process.exit(1);
}); 