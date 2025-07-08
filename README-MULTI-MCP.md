# Multi-MCP Server with Anthropic LLM Integration

A comprehensive Model Context Protocol (MCP) system with multiple specialized servers and intelligent LLM routing.

## 🏗️ Architecture

```
User Input → Anthropic LLM → Tool Decision → Multi-MCP Client → Specific MCP Server
                ↓
            Natural Response ← Tool Result ← MCP Server
```

## 📁 Project Structure

```
test-mcp-server/
├── mcp-servers/
│   ├── basic-tools/
│   │   └── server.js          # Basic operations (time, calc, system info, echo)
│   ├── file-operations/
│   │   └── server.js          # File manipulation tools
│   └── web-services/
│       └── server.js          # Web services and external APIs
├── multi-mcp-client.js        # Client for multiple MCP servers
├── multi-anthropic-llm.js     # Enhanced LLM with multi-server support
├── multi-mcp-app.js           # Main application
├── server.js                  # Original single MCP server
├── index.js                   # Original single client
└── package.json
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your Anthropic API key:**
   ```bash
   # Windows
   set ANTHROPIC_API_KEY=your_api_key_here
   
   # Linux/Mac
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Run the multi-MCP application:**
   ```bash
   npm run multi-client
   ```

## 🛠️ Available MCP Servers

### 1. Basic Tools Server (`basic-tools`)
**Tools:**
- `get_current_time` - Get current date and time
- `calculate` - Perform mathematical calculations
- `get_system_info` - Get system information
- `echo` - Echo back input message

**Resources:**
- `file:///example.txt` - Example text file
- `file:///config.json` - Configuration information

### 2. File Operations Server (`file-operations`)
**Tools:**
- `list_files` - List files in a directory
- `read_file` - Read file contents
- `write_file` - Write content to a file
- `create_directory` - Create a new directory
- `file_info` - Get file/directory information

**Resources:**
- `file:///workspace/` - Workspace directory information

### 3. Web Services Server (`web-services`)
**Tools:**
- `http_get` - Make HTTP GET requests
- `http_post` - Make HTTP POST requests
- `check_weather` - Get weather information (mock)
- `translate_text` - Translate text between languages (mock)
- `currency_convert` - Convert between currencies (mock)

**Resources:**
- `web:///api-status` - API status information

## 💬 Example Interactions

### Basic Operations
```
User: "What time is it?"
LLM: Calls get_current_time on basic-tools server
Response: "The current time is 2025-07-08T22:45:30.123Z"

User: "Calculate 15 * 3 + 7"
LLM: Calls calculate on basic-tools server
Response: "15 * 3 + 7 = 52"
```

### File Operations
```
User: "List files in the current directory"
LLM: Calls list_files on file-operations server
Response: "Files in current directory: package.json (file), mcp-servers/ (directory)..."

User: "Create a new file called test.txt with content 'Hello World'"
LLM: Calls write_file on file-operations server
Response: "Successfully created test.txt with the content 'Hello World'"
```

### Web Services
```
User: "What's the weather in London?"
LLM: Calls check_weather on web-services server
Response: "Weather in London: Temperature: 15°C, Condition: Cloudy, Humidity: 80%"

User: "Translate 'hello' from English to Spanish"
LLM: Calls translate_text on web-services server
Response: "Translation (en → es): Original: hello, Translated: hola"
```

## 🔧 Usage

### Running Individual Servers
```bash
# Test basic tools server
npm run test-basic

# Test file operations server
npm run test-file

# Test web services server
npm run test-web
```

### Running Different Clients
```bash
# Original single MCP client
npm run client

# Multi-MCP client (recommended)
npm run multi-client
```

## 🧠 How the LLM Decides

The LLM analyzes user requests and automatically chooses the most appropriate server and tool:

1. **Request Analysis**: LLM understands the user's intent
2. **Tool Selection**: Chooses the best tool from available options
3. **Server Routing**: Determines which server has the required tool
4. **Tool Execution**: Calls the tool on the specific server
5. **Response Generation**: Provides natural language response based on results

### Example Decision Process
```
User: "Show me the files in my project"
1. LLM recognizes this is a file listing request
2. Identifies list_files tool as appropriate
3. Finds list_files is available on file-operations server
4. Calls list_files on file-operations server
5. Provides natural response based on file list
```

## 🔄 Adding New MCP Servers

1. **Create a new server directory:**
   ```bash
   mkdir mcp-servers/my-new-server
   ```

2. **Create the server file:**
   ```javascript
   // mcp-servers/my-new-server/server.js
   import { Server } from '@modelcontextprotocol/sdk/server/index.js';
   // ... implement your server
   ```

3. **Add to the multi-client:**
   ```javascript
   // In multi-mcp-app.js
   this.mcpClient.addServer('my-new-server', 'server.js', './mcp-servers/my-new-server');
   ```

4. **Update the LLM prompt** to include your new tools (automatic in this implementation)

## 🛡️ Security Considerations

- **API Keys**: Keep your Anthropic API key secure
- **File Operations**: File operations are limited to the project directory
- **Web Requests**: Web services use mock data for safety
- **Input Validation**: All inputs are validated before processing

## 🐛 Troubleshooting

### Common Issues

1. **API Key Error**
   - Ensure `ANTHROPIC_API_KEY` is set correctly
   - Check that the key is valid and has sufficient credits

2. **Server Connection Issues**
   - Verify all server files exist in the correct locations
   - Check that Node.js dependencies are installed

3. **Tool Not Found**
   - Ensure the tool exists on the specified server
   - Check that the server is running and connected

### Debug Mode
```bash
# Run with verbose logging
DEBUG=* npm run multi-client
```

## 📈 Extending the System

### Adding New Tools
1. Add the tool to the appropriate MCP server
2. The LLM will automatically discover and use it
3. No changes needed to the client or LLM code

### Customizing LLM Behavior
Modify the system prompt in `multi-anthropic-llm.js` to change how the LLM interprets requests and chooses tools.

### Adding Real Web Services
Replace mock implementations in `web-services/server.js` with real API calls using libraries like `axios` or `node-fetch`.

## 📄 License

MIT License - feel free to use and modify for your projects.

## 🤝 Contributing

Feel free to submit issues and enhancement requests! 