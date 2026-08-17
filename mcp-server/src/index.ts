import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import cors from 'cors';
import { createMcpServer } from './server';
import { config } from './config';

async function main() {
  const mcpServer = createMcpServer();

  if (config.transport === 'sse') {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.json({
        status: 'UP',
        service: 'noun-hrms-mcp-gateway',
        readOnlyMode: config.readOnlyMode,
        timestamp: new Date().toISOString()
      });
    });

    app.listen(config.ssePort, () => {
      console.log(`[MCP Gateway] Server-Sent Events (SSE) transport running on port ${config.ssePort}`);
      console.log(`[MCP Gateway] Read-Only Mode: ${config.readOnlyMode}`);
    });
  } else {
    // Default Stdio transport
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[MCP Gateway] Stdio transport connected and ready.');
  }
}

main().catch((error) => {
  console.error('[MCP Gateway] Fatal initialization error:', error);
  process.exit(1);
});
