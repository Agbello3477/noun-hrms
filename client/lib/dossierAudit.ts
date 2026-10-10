import api from './api';

export interface DossierSecurityActionParams {
  action: 'DOSSIER_DOWNLOADED' | 'DOSSIER_PRINTED' | 'DOCUMENT_DOWNLOADED' | 'DOCUMENT_PRINTED';
  documentTitle?: string;
  staffProfileId?: string;
  staffName?: string;
  staffId?: string;
  fileNumber?: string;
  requisitionId?: string;
}

/**
 * Log when any user downloads or prints a staff dossier or document.
 * This alerts Central Registry & Registrar and records the officer's name, ID, IP and action.
 */
export async function logDossierSecurityAction(params: DossierSecurityActionParams): Promise<void> {
  try {
    await api.post('/api/v1/registry/file-requests/dossier-action', {
      action: params.action,
      documentTitle: params.documentTitle || 'Confidential Personnel Dossier',
      staffProfileId: params.staffProfileId,
      staffName: params.staffName,
      staffId: params.staffId,
      fileNumber: params.fileNumber,
      requisitionId: params.requisitionId,
    });
  } catch (error) {
    // Non-blocking security telemetry
    console.warn('[DossierAudit] Failed to log security action:', error);
  }
}
