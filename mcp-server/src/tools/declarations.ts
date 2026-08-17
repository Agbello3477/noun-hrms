import { apiClient } from '../apiClient';
import { authorizeToolAccess } from '../auth';
import { config } from '../config';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  allowedRoles: string[];
  isReadOnly: boolean;
  execute: (params: any, callerRole?: string) => Promise<any>;
}

export const toolsRegistry: Record<string, McpToolDefinition> = {
  get_staff_promotion_eligibility: {
    name: 'get_staff_promotion_eligibility',
    description: 'Queries staff profiles eligible/due for promotion in the registry database',
    allowedRoles: ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number for pagination (Default: 1)' },
        limit: { type: 'number', description: 'Number of records per page (Default: 20)' },
        cadre: { type: 'string', description: 'Filter by cadre (ACADEMIC, ADMINISTRATIVE, TECHNICAL)' },
        department: { type: 'string', description: 'Filter by department' }
      }
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      // 1. RBAC check
      const auth = authorizeToolAccess('get_staff_promotion_eligibility', callerRole, ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      // 2. Query upstream REST API
      const primaryUrl = '/api/v1/registry/due-for-promotion';
      const fallbackUrls = ['/api/staff/promotions/due'];

      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 20,
        cadre: params.cadre,
        department: params.department
      };

      const result = await apiClient.get(primaryUrl, queryParams, {
        userRole: callerRole,
        fallbackUrls
      });

      return result;
    }
  },

  get_security_threat_summary: {
    name: 'get_security_threat_summary',
    description: 'Queries command center security incidents and threat reports',
    allowedRoles: ['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter incident status (OPEN, INVESTIGATING, RESOLVED)' },
        severity: { type: 'string', description: 'Filter threat severity (LOW, MEDIUM, HIGH, CRITICAL)' },
        limit: { type: 'number', description: 'Maximum items to retrieve (Default: 50)' }
      }
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      // 1. RBAC check
      const auth = authorizeToolAccess('get_security_threat_summary', callerRole, ['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      // 2. Query upstream REST API
      const primaryUrl = '/api/v1/security/incidents';
      const fallbackUrls = ['/api/security/incidents', '/api/security/reports'];

      const queryParams = {
        status: params.status,
        severity: params.severity,
        limit: params.limit || 50
      };

      const result = await apiClient.get(primaryUrl, queryParams, {
        userRole: callerRole,
        fallbackUrls
      });

      return result;
    }
  },

  get_research_grant_metrics: {
    name: 'get_research_grant_metrics',
    description: 'Queries institutional research grants and impact aggregation metrics',
    allowedRoles: ['SUPER_USER', 'ADMIN', 'HR_ADMIN', 'STAFF', 'VICE_CHANCELLOR'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Specific project UUID' },
        status: { type: 'string', description: 'Grant status (ACTIVE, SUBMITTED, AWARDED)' }
      }
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      // 1. RBAC check
      const auth = authorizeToolAccess('get_research_grant_metrics', callerRole, ['SUPER_USER', 'ADMIN', 'HR_ADMIN', 'STAFF', 'VICE_CHANCELLOR']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      // 2. Query upstream REST API
      const primaryUrl = params.projectId 
        ? `/api/v1/research/grants?projectId=${params.projectId}` 
        : '/api/v1/research/grants';
      const fallbackUrls = params.projectId
        ? [`/api/research/${params.projectId}/grants`]
        : ['/api/research/reports/impact'];

      const result = await apiClient.get(primaryUrl, params, {
        userRole: callerRole,
        fallbackUrls
      });

      return result;
    }
  },

  update_staff_status: {
    name: 'update_staff_status',
    description: 'State-altering tool: Updates staff active/duty status in database',
    allowedRoles: ['HR_ADMIN', 'SUPER_USER', 'ADMIN'],
    isReadOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        staffId: { type: 'string', description: 'Staff profile UUID' },
        status: { type: 'string', description: 'Target status (ACTIVE, ON_LEAVE, RETIRED, SUSPENDED)' }
      },
      required: ['staffId', 'status']
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      // 1. Dry-run / Read-Only safety enforcement check
      if (config.readOnlyMode) {
        return {
          error: true,
          code: 'READ_ONLY_MODE_BLOCKED',
          message: 'Execution blocked: MCP_READ_ONLY_MODE is enabled. State-altering operations are forbidden.'
        };
      }

      // 2. RBAC check
      const auth = authorizeToolAccess('update_staff_status', callerRole, ['HR_ADMIN', 'SUPER_USER', 'ADMIN']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      // 3. Forward state change to main API
      const primaryUrl = `/api/v1/staff/${params.staffId}/status`;
      const fallbackUrls = [`/api/staff/${params.staffId}`];

      const result = await apiClient.put(primaryUrl, { status: params.status }, {
        userRole: callerRole
      });

      return result;
    }
  },

  get_staff_dossier: {
    name: 'get_staff_dossier',
    description: 'Retrieves complete staff member dossier and service file details',
    allowedRoles: ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN', 'BURSAR'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        staffId: { type: 'string', description: 'Staff profile ID or UUID' }
      },
      required: ['staffId']
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      const auth = authorizeToolAccess('get_staff_dossier', callerRole, ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN', 'BURSAR']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      const primaryUrl = `/api/v1/registry/dossier/${params.staffId}`;
      const fallbackUrls = [`/api/staff/${params.staffId}`];

      return await apiClient.get(primaryUrl, {}, { userRole: callerRole, fallbackUrls });
    }
  },

  get_payroll_summary_metrics: {
    name: 'get_payroll_summary_metrics',
    description: 'Queries aggregate institutional payroll totals, PAYE taxes, and pension deductions',
    allowedRoles: ['BURSAR', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Target month (1-12)' },
        year: { type: 'number', description: 'Target year (e.g. 2026)' }
      }
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      const auth = authorizeToolAccess('get_payroll_summary_metrics', callerRole, ['BURSAR', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      const primaryUrl = '/api/v1/payroll/summary';
      const fallbackUrls = ['/api/payroll', '/api/payroll/run'];

      return await apiClient.get(primaryUrl, params, { userRole: callerRole, fallbackUrls });
    }
  },

  get_active_leave_balances: {
    name: 'get_active_leave_balances',
    description: 'Queries active leave requests and staff leave balance metrics across departments',
    allowedRoles: ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN', 'STUDY_CENTER_MANAGER'],
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Leave status filter (PENDING, APPROVED, ON_LEAVE)' }
      }
    },
    execute: async (params, callerRole = 'SUPER_USER') => {
      const auth = authorizeToolAccess('get_active_leave_balances', callerRole, ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN', 'STUDY_CENTER_MANAGER']);
      if (!auth.authorized) {
        return { error: true, code: 'FORBIDDEN', message: auth.reason };
      }

      const primaryUrl = '/api/v1/leaves/summary';
      const fallbackUrls = ['/api/leaves'];

      return await apiClient.get(primaryUrl, params, { userRole: callerRole, fallbackUrls });
    }
  }
};
