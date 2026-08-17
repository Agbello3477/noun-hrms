import dotenv from 'dotenv';
dotenv.config();

export interface McpConfig {
  apiBaseUrl: string;
  readOnlyMode: boolean;
  jwtSecret: string;
  transport: 'stdio' | 'sse';
  ssePort: number;
}

const rawReadOnly = process.env.MCP_READ_ONLY_MODE;
const readOnlyMode = rawReadOnly === undefined ? true : rawReadOnly.toLowerCase() === 'true' || rawReadOnly === '1';

export const config: McpConfig = {
  apiBaseUrl: process.env.API_BASE_URL || process.env.MAIN_API_URL || 'http://localhost:5055',
  readOnlyMode,
  jwtSecret: process.env.JWT_SECRET || process.env.AI_AGENT_JWT_SECRET || 'production_jwt_secret_noun_hrms_secure_key',
  transport: (process.env.MCP_TRANSPORT as 'stdio' | 'sse') || 'stdio',
  ssePort: parseInt(process.env.MCP_PORT || process.env.MCP_SSE_PORT || '5056', 10)
};
