import jwt from 'jsonwebtoken';
import { config } from './config';

export interface AgentIdentity {
  id: string;
  email: string;
  role: string;
  name: string;
}

export const defaultAgentIdentity: AgentIdentity = {
  id: 'mcp-agent-service-account-id',
  email: 'ai-agent-gateway@noun.edu.ng',
  role: 'SUPER_USER', // High-privilege agent account capable of proxying RBAC queries
  name: 'AI Agent MCP Gateway'
};

export const generateAgentJwt = (identity: AgentIdentity = defaultAgentIdentity): string => {
  const payload = {
    id: identity.id,
    userId: identity.id,
    email: identity.email,
    role: identity.role,
    name: identity.name,
    isAgent: true
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
};

// Check tool role authorization before forwarding request upstream
export const authorizeToolAccess = (
  toolName: string,
  userRole: string,
  allowedRoles: string[]
): { authorized: boolean; reason?: string } => {
  if (allowedRoles.length === 0) {
    return { authorized: true };
  }

  const isAllowed = allowedRoles.includes(userRole) || userRole === 'SUPER_USER';
  if (!isAllowed) {
    return {
      authorized: false,
      reason: `RBAC Authorization Failure: Role '${userRole}' is not permitted to execute tool '${toolName}'. Allowed roles: [${allowedRoles.join(', ')}]`
    };
  }

  return { authorized: true };
};
