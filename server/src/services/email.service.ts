
import nodemailer from 'nodemailer';

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
        console.error('Error sending email:', error);
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
