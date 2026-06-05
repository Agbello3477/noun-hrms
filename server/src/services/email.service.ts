
import nodemailer from 'nodemailer';
import { sendSMS } from './sms.service';

// Configure transporter (Mock for Dev, can use Gmail/SMTP)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || 'ethereal_user',
        pass: process.env.SMTP_PASS || 'ethereal_pass',
    },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        console.log(`[EMAIL_SERVICE] Sending email to ${to}: Subject "${subject}"`);
        // If placeholders are present, we log full contents to console and return true
        if (process.env.SMTP_USER === 'your-email@example.com' || !process.env.SMTP_USER) {
            console.log(`[EMAIL_SERVICE] [MOCK] Email HTML contents:\n${html}`);
            return true;
        }

        const info = await transporter.sendMail({
            from: '"NOUN HRMS" <no-reply@noun.edu.ng>',
            to,
            subject,
            html,
        });

        console.log('Message sent: %s', info.messageId);
        // Preview only available when sending through an Ethereal account
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return true;
    } catch (error) {
        console.error('Error sending email via SMTP:', error);
        console.log(`[EMAIL_SERVICE] [FALLBACK MOCK] Email successfully logged to console for ${to}:\nSubject: ${subject}\nHTML: ${html}`);
        return true;
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

