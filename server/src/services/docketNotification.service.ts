import { Server as SocketIOServer } from 'socket.io';
import prisma from '../prisma';
import { notifyUser } from '../controllers/notification.controller';
import { sendEmail } from './email.service';

let socketIO: SocketIOServer | null = null;

export const setDocketSocketIO = (io: SocketIOServer) => {
  socketIO = io;
};

export interface DocketStatusEventPayload {
  applicationId: string;
  refNo: string;
  oldStatus: string;
  newStatus: string;
  actorName: string;
  remarks?: string;
  actionUrl: string;
}

/**
 * Emit real-time WebSocket event for instantaneous UI updates without page refresh
 */
export const emitApplicationStatusChanged = (payload: DocketStatusEventPayload) => {
  try {
    if (socketIO) {
      socketIO.emit('APPLICATION_STATUS_CHANGED', payload);
      // Also emit targeted event per application
      socketIO.emit(`APPLICATION_STATUS_${payload.applicationId}`, payload);
    }
  } catch (err) {
    console.error('[Docket Socket] Error emitting status changed event:', err);
  }
};

/**
 * Email Template 1: Director Notification Email
 */
export const sendDirectorNotificationEmail = async (
  directorEmail: string,
  directorName: string,
  applicantName: string,
  subject: string,
  refNo: string,
  category: string
) => {
  const emailSubject = `[ACTION REQUIRED] New Staff Institutional Application: ${refNo}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: #047857; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">National Open University of Nigeria</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Multi-Tier Institutional Routing & Application Docket</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${directorName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          A new official staff application has been submitted by <strong>${applicantName}</strong> and routed to your Directorate for preliminary vetting, recommendation, or critique.
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #047857; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 4px 0; font-size: 13px;"><strong>Reference Number:</strong> ${refNo}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Applicant:</strong> ${applicantName}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Category:</strong> ${category.replace(/_/g, ' ')}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Subject:</strong> ${subject}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> AWAITING DIRECTOR VETTING</p>
        </div>

        <p style="font-size: 14px; color: #334155;">
          Please log in to your Directorate Cockpit to review the dossier, add recommendation minutes, or request revisions.
        </p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.CLIENT_URL || 'https://nounhrms.web.app'}/director/applications/pending" 
             style="background-color: #047857; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Open Directorate Vetting Cockpit
          </a>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">Automated Dispatch from NOUN-HRMS Institutional Routing Subsystem</p>
      </div>
    </div>
  `;

  return sendEmail(directorEmail, emailSubject, html).catch((err) => {
    console.warn('[Docket Email] Error dispatching director notification email:', err);
  });
};

/**
 * Email Template 2: Applicant Progress Email
 */
export const sendApplicantProgressEmail = async (
  applicantEmail: string,
  applicantName: string,
  refNo: string,
  status: string,
  remarks?: string
) => {
  let statusTitle = 'Application Progress Update';
  let statusBannerColor = '#0284c7'; // Blue
  let statusExplanation = 'Your application status has been updated.';

  if (status === 'RECOMMENDED_TO_REGISTRY') {
    statusTitle = 'Application Recommended by Director';
    statusBannerColor = '#059669'; // Green
    statusExplanation = 'Your application has been positively recommended by your Director and forwarded to the Central Registry Inward Desk for formal docketing.';
  } else if (status === 'RETURNED_FOR_REWRITE') {
    statusTitle = 'Application Returned for Revision';
    statusBannerColor = '#d97706'; // Amber
    statusExplanation = 'Your Director has returned your application with instructions for rewrite. Please view the feedback and submit revisions.';
  } else if (status === 'REJECTED_BY_DIRECTOR') {
    statusTitle = 'Application Declined by Directorate';
    statusBannerColor = '#dc2626'; // Red
    statusExplanation = 'Your application was not endorsed by the Directorate. The record has been filed into the Registry Archive.';
  }

  const emailSubject = `[NOUN HRMS] ${statusTitle} (${refNo})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: ${statusBannerColor}; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">${statusTitle}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Ref: ${refNo}</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${applicantName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">${statusExplanation}</p>

        ${
          remarks
            ? `
          <div style="background-color: #f8fafc; border-left: 4px solid ${statusBannerColor}; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Director's Endorsement / Minute:</strong></p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #1e293b; font-style: italic;">"${remarks}"</p>
          </div>
        `
            : ''
        }

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.CLIENT_URL || 'https://nounhrms.web.app'}/portal/applications/my-applications" 
             style="background-color: ${statusBannerColor}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            View Application Workspace
          </a>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">Automated Progress Notice · National Open University of Nigeria</p>
      </div>
    </div>
  `;

  return sendEmail(applicantEmail, emailSubject, html).catch((err) => {
    console.warn('[Docket Email] Error dispatching applicant progress email:', err);
  });
};

/**
 * Email Template 3: Registry Acknowledgment Receipt Email (Dual-Dispatched)
 */
export const sendRegistryAcknowledgmentReceiptEmail = async (
  recipientEmail: string,
  recipientName: string,
  applicantName: string,
  refNo: string,
  folioNumber: string,
  subject: string
) => {
  const emailSubject = `[OFFICIAL DOCKET FOLIO] Acknowledgment Receipt: ${folioNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: #1e3a8a; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Central Registry Inward Desk</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Official Institutional Docketing Folio Receipt</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${recipientName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          This is an official confirmation that application <strong>${refNo}</strong> (Subject: <em>${subject}</em>) from <strong>${applicantName}</strong> has been officially acknowledged, stamped, and entered into the University Registry Master Docket.
        </p>

        <div style="background-color: #eff6ff; border: 2px dashed #1e3a8a; padding: 16px; margin: 20px 0; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #3b82f6; font-weight: bold; letter-spacing: 1px;">Official Registry Docket Folio Number</p>
          <p style="margin: 6px 0; font-size: 22px; font-weight: 800; color: #1e3a8a; font-family: monospace;">${folioNumber}</p>
          <p style="margin: 0; font-size: 13px; color: #475569;">Stage: <strong>DOCKETED & FORWARDED TO REGISTRAR</strong></p>
        </div>

        <p style="font-size: 14px; color: #334155;">
          The application dossier is now queued on the Registrar's Executive Cockpit for final administrative determination.
        </p>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">Office of the Registrar · Central Registry Division · NOUN</p>
      </div>
    </div>
  `;

  return sendEmail(recipientEmail, emailSubject, html).catch((err) => {
    console.warn('[Docket Email] Error dispatching registry acknowledgment email:', err);
  });
};

/**
 * Email Template 4: Registrar Final Determination Email
 */
export const sendRegistrarFinalDeterminationEmail = async (
  recipientEmail: string,
  recipientName: string,
  applicantName: string,
  refNo: string,
  folioNumber: string,
  decision: 'APPROVED' | 'DECLINED',
  registrarRemarks?: string
) => {
  const isApproved = decision === 'APPROVED';
  const bannerColor = isApproved ? '#047857' : '#991b1b';
  const decisionText = isApproved ? 'OFFICIALLY APPROVED' : 'DECLINED';
  const emailSubject = `[EXECUTIVE ORDER] Registrar's Decision: ${refNo} (${decisionText})`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: ${bannerColor}; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Office of the University Registrar</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Executive Determination & Final Order</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${recipientName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          Please be notified that the University Registrar has issued an executive determination regarding institutional application <strong>${refNo}</strong> (Folio: <strong>${folioNumber}</strong>) submitted by <strong>${applicantName}</strong>.
        </p>

        <div style="background-color: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border: 2px solid ${bannerColor}; padding: 16px; margin: 20px 0; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: ${bannerColor}; font-weight: bold; letter-spacing: 1px;">Registrar's Determination</p>
          <p style="margin: 6px 0; font-size: 24px; font-weight: 800; color: ${bannerColor};">${decisionText}</p>
        </div>

        ${
          registrarRemarks
            ? `
          <div style="background-color: #f8fafc; border-left: 4px solid ${bannerColor}; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Registrar's Minute & Directive:</strong></p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #1e293b; font-style: italic;">"${registrarRemarks}"</p>
          </div>
        `
            : ''
        }

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          An immutable audit copy of this decision and all associated minutes have been permanently deposited in the University Registry Master Archive.
        </p>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">Registrar's Secretariat · National Open University of Nigeria</p>
      </div>
    </div>
  `;

  return sendEmail(recipientEmail, emailSubject, html).catch((err) => {
    console.warn('[Docket Email] Error dispatching registrar determination email:', err);
  });
};

/**
 * Email Template 5: Registry & HR Inward Docket Desk Notification Email
 */
export const sendRegistryInwardDeskNotificationEmail = async (
  recipientEmail: string,
  recipientName: string,
  directorName: string,
  applicantName: string,
  subject: string,
  refNo: string,
  category: string,
  directorRemarks?: string
) => {
  const emailSubject = `[ACTION REQUIRED - INWARD DOCKET] Endorsed Staff Application: ${refNo}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="background-color: #047857; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Central Registry &amp; HR Inward Desk</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Directorate Endorsement Notification</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${recipientName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          An institutional staff application has been reviewed, endorsed, and recommended by <strong>Director ${directorName}</strong>. It is now awaiting intake, folio stamping, and docketing by the Registry / HR desk to be forwarded to the University Registrar.
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #047857; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 4px 0; font-size: 13px;"><strong>Reference Number:</strong> ${refNo}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Applicant:</strong> ${applicantName}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Category:</strong> ${category.replace(/_/g, ' ')}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Subject:</strong> ${subject}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> ENDORSED BY DIRECTOR · AWAITING REGISTRY DOCKETING</p>
        </div>

        ${
          directorRemarks
            ? `
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>Director's Recommendation Minute:</strong></p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #78350f; font-style: italic;">"${directorRemarks}"</p>
          </div>
        `
            : ''
        }

        <p style="font-size: 14px; color: #334155;">
          Please open your Registry Inward Desk to assign the official Registry Folio Number and forward the dossier to the Registrar's Executive Cockpit.
        </p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.CLIENT_URL || 'https://nounhrms.web.app'}/dashboard/registry/inward-docket" 
             style="background-color: #047857; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Open Registry Inward Docket Desk
          </a>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">Central Registry Operations · National Open University of Nigeria</p>
      </div>
    </div>
  `;

  return sendEmail(recipientEmail, emailSubject, html).catch((err) => {
    console.warn('[Docket Email] Error dispatching registry inward desk notification email:', err);
  });
};
