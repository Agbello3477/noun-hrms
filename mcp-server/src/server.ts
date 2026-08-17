import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toolsRegistry } from './tools/declarations';
import { config } from './config';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'noun-hrms-mcp-gateway',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // 1. Tool Listing Request Handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.values(toolsRegistry).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return { tools };
  });

  // 2. Tool Execution Request Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolsRegistry[name];

    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: 'TOOL_NOT_FOUND',
              message: `Unknown MCP tool: '${name}'`
            }, null, 2)
          }
        ],
        isError: true
      };
    }

    // Read-only mode enforcement for write operations
    if (!tool.isReadOnly && config.readOnlyMode) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: 'READ_ONLY_MODE_BLOCKED',
              message: `Execution blocked: MCP_READ_ONLY_MODE is enabled. State-altering operation '${name}' is forbidden.`
            }, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      const result = await tool.execute(args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: 'TOOL_EXECUTION_ERROR',
              message: err.message || 'Internal tool execution error'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  return server;
}
