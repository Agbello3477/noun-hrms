import { Type, FunctionDeclaration } from '@google/genai';

/**
 * Typed Gemini Tool Declarations for NOUN-Sentinel AI
 * Conforms to Google Gen AI SDK FunctionDeclaration schema.
 */

export const getMyApplicationStatusTool: FunctionDeclaration = {
  name: 'getMyApplicationStatus',
  description: 'Fetch the active status, current holder role, and latest remarks for institutional applications lodged by the logged-in staff.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      referenceNumber: {
        type: Type.STRING,
        description: 'Optional specific application folio reference number (e.g. NOUN/APP/2026/00142). If omitted, returns all recent applications.'
      }
    }
  }
};

export const getMyLeaveBalanceTool: FunctionDeclaration = {
  name: 'getMyLeaveBalance',
  description: 'Fetch current calendar year leave quota, days utilized, and remaining days for the logged-in staff.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      year: {
        type: Type.INTEGER,
        description: 'Calendar year for leave quota calculation (e.g. 2026). Defaults to current year.'
      }
    }
  }
};

export const checkPromotionReadinessTool: FunctionDeclaration = {
  name: 'checkPromotionReadiness',
  description: "Evaluates staff member's service waiting period, confirmation status, verified publication points, and APER score compliance against statutory thresholds.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetRank: {
        type: Type.STRING,
        description: 'Target promotion rank to evaluate against statutory criteria.',
        enum: [
          'LECTURER_II',
          'LECTURER_I',
          'SENIOR_LECTURER',
          'READER',
          'PROFESSOR',
          'SENIOR_ADMIN_OFFICER',
          'PRINCIPAL_ADMIN_OFFICER',
          'DEPUTY_REGISTRAR',
          'CONTISS_04',
          'CONTISS_05'
        ]
      }
    },
    required: ['targetRank']
  }
};

export const searchSystemManualTool: FunctionDeclaration = {
  name: 'searchSystemManual',
  description: 'Fetches step-by-step UI instructions and Maker-Checker procedures for HRMS modules.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      module: {
        type: Type.STRING,
        description: 'HRMS functional module name (e.g. Maker-Checker, Leave Management, File Requisition, Memos, Dossier).'
      },
      query: {
        type: Type.STRING,
        description: 'Specific workflow question or procedural inquiry.'
      }
    },
    required: ['module', 'query']
  }
};

export const SENTINEL_AI_TOOLS = [
  getMyApplicationStatusTool,
  getMyLeaveBalanceTool,
  checkPromotionReadinessTool,
  searchSystemManualTool
];
