
import nodemailer from 'nodemailer';
import { sendSMS } from './sms.service';
import { Resend } from 'resend';
import path from 'path';
import fs from 'fs';

const SETTINGS_FILE = path.join(__dirname, '../../system_settings.json');

const getEmailSettings = (): any => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Error reading system settings file for email:", e);
    }
    return {};
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        console.log(`[EMAIL_SERVICE] Initiating dispatch to ${to} | Subject: "${subject}"`);

        const settings = getEmailSettings();
        const resendKey = (process.env.RESEND_API_KEY || settings.resendApiKey || '').trim();
        const resendFrom = (process.env.RESEND_FROM_EMAIL || settings.resendFromEmail || 'onboarding@resend.dev').trim();

        // If a real Resend API Key exists, dispatch via Resend immediately
        if (resendKey) {
            console.log(`[EMAIL_SERVICE] Dispatching via Resend API (${resendFrom}) to ${to}...`);
            const resendClient = new Resend(resendKey);
            const response = await resendClient.emails.send({
                from: resendFrom,
                to,
                subject,
                html
            });

            if (response.error) {
                console.error(`[EMAIL_SERVICE] Resend API Error:`, response.error);
                throw new Error(response.error.message);
            }
            console.log(`[EMAIL_SERVICE] Email sent via Resend API to ${to}. Message ID: ${response.data?.id}`);
            return true;
        }

        const mockMode = settings.mockEmailMode !== undefined ? settings.mockEmailMode : true;
        if (mockMode) {
            console.log(`[EMAIL_SERVICE] [MOCK MODE ACTIVE] Email simulated to ${to}:\nSubject: ${subject}\nHTML:\n${html}`);
            return true;
        }

        // 2. Custom SMTP Transporter
        const host = settings.smtpHost || process.env.SMTP_HOST;
        const port = Number(settings.smtpPort || process.env.SMTP_PORT || 587);
        const user = settings.smtpUser || process.env.SMTP_USER;
        const pass = settings.smtpPass || process.env.SMTP_PASS;

        const isPlaceholderUser = !user || user === 'your-email@example.com' || user === 'ethereal_user';

        if (!host || isPlaceholderUser) {
            console.log(`[EMAIL_SERVICE] [MOCK FALLBACK] Mock mode is OFF, but no real SMTP server or Resend API key configured in System Settings or .env. Logging email to console:\nSubject: ${subject}\nTo: ${to}\nHTML:\n${html}`);
            return true;
        }

        console.log(`[EMAIL_SERVICE] Dispatching via SMTP (${host}:${port}) to ${to}...`);
        const customTransporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass }
        });

        const info = await customTransporter.sendMail({
            from: settings.contactEmail ? `"NOUN HRMS" <${settings.contactEmail}>` : '"NOUN HRMS" <no-reply@noun.edu.ng>',
            to,
            subject,
            html,
        });

        console.log(`[EMAIL_SERVICE] Email sent successfully via SMTP to ${to}. Message ID: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error(`[EMAIL_SERVICE] Failed to send email to ${to}:`, error);
        console.log(`[EMAIL_SERVICE] [ERROR FALLBACK] Mock log for failed email dispatch:\nTo: ${to}\nSubject: ${subject}\nHTML:\n${html}`);
        return false;
    }
};

export const sendTransferNotification = async (
    staffEmail: string,
    staffName: string,
    fromCenter: string,
    toCenter: string,
    effectiveDate: Date
) => {
    const subject = 'Staff Transfer Notification';
    const html = `
        <h1>Official Transfer Notification</h1>
        <p>Dear <strong>${staffName}</strong>,</p>
        <p>This is to inform you that you have been transferred from <strong>${fromCenter}</strong> to <strong>${toCenter}</strong>.</p>
        <p><strong>Effective Date:</strong> ${effectiveDate.toDateString()}</p>
        <p>Please report to your new Duty Post immediately.</p>
        <br>
        <p>Regards,</p>
        <p>NOUN Registry</p>
    `;
    return sendEmail(staffEmail, subject, html);
};

export const sendAccountCreatedNotification = async (
    email: string,
    phone: string | null,
    name: string,
    staffId: string
) => {
    const subject = 'Your NOUN HRMS Account Has Been Created';
    const html = `
        <h1>Welcome to NOUN HRMS</h1>
        <p>Dear <strong>${name}</strong>,</p>
        <p>An official staff file and portal account has been created for you.</p>
        <p>You can now log in to the portal using the credentials below:</p>
        <ul>
            <li><strong>Login URL:</strong> <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">NOUN HRMS Portal</a></li>
            <li><strong>Username/Email:</strong> ${email}</li>
            <li><strong>Staff ID:</strong> ${staffId}</li>
            <li><strong>Default Password:</strong> 123456789</li>
        </ul>
        <p><em>Note: You will be prompted to change this default password upon your first login.</em></p>
        <br>
        <p>Regards,</p>
        <p>NOUN Registry / HR Department</p>
    `;

    // Send Email
    await sendEmail(email, subject, html);

    // Send SMS
    if (phone) {
        const smsMessage = `Welcome to NOUN HRMS. Your account has been created. Login with your Email (${email}) or Staff ID (${staffId}) and default password: 123456789. You must change your password on first login.`;
        await sendSMS(phone, smsMessage);
    }
};

export const sendLeaveNotification = async (
    email: string,
    name: string,
    leaveType: string,
    status: string,
    durationDays: number,
    comment?: string,
    phone?: string | null
) => {
    const subject = `Leave Request Notification: ${status}`;
    let statusText = status.toLowerCase();
    if (status === 'APPROVED') {
        statusText = `approved for ${durationDays} days`;
    } else if (status === 'RECOMMENDED') {
        statusText = 'recommended and forwarded for final approval';
    } else if (status === 'REJECTED') {
        statusText = 'rejected';
    }

    const html = `
        <h1>Leave Request Update</h1>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your request for <strong>${leaveType}</strong> leave has been <strong>${statusText}</strong>.</p>
        ${comment ? `<p><strong>Comments/Reason:</strong> ${comment}</p>` : ''}
        <br>
        <p>Regards,</p>
        <p>NOUN HR Department</p>
    `;

    // Send Email
    await sendEmail(email, subject, html);

    // Send SMS (optional)
    if (phone) {
        const smsMessage = `Your ${leaveType} leave request has been ${statusText}.${comment ? ` Reason: ${comment}` : ''}`;
        await sendSMS(phone, smsMessage);
    }
};

// ── Promotion Notification ───────────────────────────────────────────────────
export const sendPromotionNotificationEmail = async (
    staffEmail: string,
    staffName: string,
    staffId: string
): Promise<void> => {
    const subject = 'NOUN HRMS — Staff Promotion Notification';
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px;
                         border: 1px solid #e0e0e0; overflow: hidden; }
            .header { background: #006400; padding: 28px 32px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px; }
            .body { padding: 32px; color: #333333; line-height: 1.7; }
            .badge { display: inline-block; background: #fff3cd; color: #856404; border: 1px solid #ffc107;
                     border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; margin-bottom: 20px; }
            .cta-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px;
                       border-radius: 4px; margin: 24px 0; }
            .footer { background: #f5f5f5; padding: 18px 32px; font-size: 12px; color: #888888;
                      text-align: center; border-top: 1px solid #e0e0e0; }
            p { margin: 0 0 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 National Open University of Nigeria</h1>
            </div>
            <div class="body">
              <span class="badge">⭐ Promotion Eligibility Notice</span>
              <p>Dear <strong>${staffName}</strong> (Staff ID: ${staffId}),</p>
              <p>We are pleased to inform you that, based on your record in the NOUN Human Resource Management System, you have been identified as <strong>due for promotion</strong> in the current year.</p>
              <div class="cta-box">
                <p style="margin:0; font-weight:bold; color:#15803d;">
                  You are due for promotion this year. The Registry will communicate the official interview/review date to you in due course.
                </p>
              </div>
              <p>Please ensure your personal records, academic qualifications, and APER (Annual Performance Evaluation Report) are up to date on the HRMS portal, as they may be required during the review process.</p>
              <p>Do not hesitate to contact the Registry if you have any enquiries.</p>
              <br />
              <p>Yours faithfully,</p>
              <p><strong>NOUN Registry</strong><br />Human Resource Management System</p>
            </div>
            <div class="footer">
              This is an automatically generated notification. Please do not reply to this email.<br />
              National Open University of Nigeria &mdash; NOUN HRMS
            </div>
          </div>
        </body>
        </html>
    `;
    await sendEmail(staffEmail, subject, html);
};

// ─────────────────────────────────────────────────────────────────────────────
//  RETIREMENT ALERT EMAIL — Sent to HR Department
// ─────────────────────────────────────────────────────────────────────────────
export interface RetirementAlertPayload {
    staffName: string;
    staffId: string;
    retirementMonthYear: string;    // e.g. "July 2026"
    department: string;             // Unit / Center name
    reason: string;                 // "Age Limit Reached" | "Maximum Service Years Reached"
    monthsAway: number;
}

export const sendRetirementAlertEmail = async (
    hrEmail: string,
    alerts: RetirementAlertPayload[]
): Promise<void> => {
    const subject = `🔔 NOUN HRMS — ${alerts.length} Staff Approaching Retirement`;
    const rows = alerts.map(a => `
        <tr>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.staffName}</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; font-family:monospace;">${a.staffId}</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.retirementMonthYear}</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.department}</td>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">
                <span style="background:${a.monthsAway <= 2 ? '#fee2e2' : '#fef9c3'}; color:${a.monthsAway <= 2 ? '#991b1b' : '#854d0e'}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">
                    ${a.monthsAway} month${a.monthsAway !== 1 ? 's' : ''} away
                </span>
            </td>
            <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; font-size:13px; color:#6b7280;">${a.reason}</td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8" />
        <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
            .container { max-width: 800px; margin: 40px auto; background: #ffffff; border-radius: 8px; border: 1px solid #e0e0e0; overflow: hidden; }
            .header { background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 28px 32px; }
            .header h1 { color: #fff; margin: 0; font-size: 20px; }
            .header p { color: #bfdbfe; margin: 6px 0 0; font-size: 13px; }
            .body { padding: 32px; color: #1f2937; }
            .alert-badge { display:inline-block; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:20px; padding:4px 14px; font-size:13px; font-weight:bold; margin-bottom:20px; }
            table { width:100%; border-collapse:collapse; font-size:14px; }
            thead { background:#1e3a5f; color:#ffffff; }
            thead th { padding:12px 14px; text-align:left; font-weight:600; font-size:12px; letter-spacing:.5px; text-transform:uppercase; }
            tbody tr:hover { background:#f9fafb; }
            .footer { background:#f5f5f5; padding:16px 32px; font-size:12px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; }
        </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 National Open University of Nigeria</h1>
              <p>Human Resource Management System — Retirement Alert Report</p>
            </div>
            <div class="body">
              <span class="alert-badge">⚠️ HIGH PRIORITY — Retirement Alert</span>
              <p>Dear HR Administrator,</p>
              <p>The HRMS Retirement Monitoring System has identified <strong>${alerts.length} staff member(s)</strong> whose retirement dates are approaching within the next <strong>6 months</strong>. Please review the details below and initiate the appropriate exit procedures.</p>
              <table>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Employee ID</th>
                    <th>Retirement Date</th>
                    <th>Dept / Placement</th>
                    <th>Time Remaining</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <br />
              <p style="font-size:13px;color:#6b7280;">This report was automatically generated by the NOUN HRMS Retirement Cron Job. Log in to the portal to take action on any of these records.</p>
            </div>
            <div class="footer">
              This is an automatically generated notification. Do not reply to this email.<br />
              National Open University of Nigeria &mdash; NOUN HRMS
            </div>
          </div>
        </body>
        </html>
    `;
    await sendEmail(hrEmail, subject, html);
};

export const sendAperSessionNotification = async (
    email: string,
    name: string,
    sessionTitle: string,
    year: number,
    endDate: Date
) => {
    const subject = `Annual Performance Appraisal Session Opened: ${sessionTitle}`;
    const formattedDate = endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #006533; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 20px;">NOUN Performance Evaluation (APER)</h2>
            </div>
            <div style="padding: 20px; color: #334155; line-height: 1.6;">
                <p>Dear <strong>${name}</strong>,</p>
                <p>This is to notify you that the Annual Performance Evaluation Report (APER) session for the year <strong>${year}</strong> has been officially opened by the Registry.</p>
                <p style="background-color: #f8fafc; border-left: 4px solid #006533; padding: 12px; font-weight: 500; font-style: italic;">
                    "Please log in to your dashboard, select the 'Appraisal' menu, fill in your details, and submit your APER form for review."
                </p>
                <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 6px; font-size: 14px;">
                    <p style="margin: 0 0 8px 0;"><strong>Appraisal Details:</strong></p>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Session:</strong> ${sessionTitle}</li>
                        <li><strong>Target Year:</strong> ${year}</li>
                        <li><strong>Submission Deadline:</strong> ${formattedDate}</li>
                    </ul>
                </div>
                <div style="text-align: center; margin-top: 25px;">
                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/staff/aper" style="background-color: #006533; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Access APER Appraisal
                    </a>
                </div>
            </div>
            <div style="text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px;">
                This is an automatically generated system notification. Do not reply to this email.<br>
                <strong>National Open University of Nigeria &mdash; Registry Division</strong>
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

