import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
    try {
        if (client && fromPhone) {
            await client.messages.create({
                body: message,
                from: fromPhone,
                to: phoneNumber
            });
            console.log(`[SMS_SERVICE] SMS successfully sent via Twilio to ${phoneNumber}`);
            return true;
        } else {
            console.log(`[SMS_SERVICE] [MOCK] SMS would be sent to ${phoneNumber} (Twilio credentials not configured): "${message}"`);
            return true;
        }
    } catch (error) {
        console.error('[SMS_SERVICE] Error sending SMS via Twilio:', error);
        return false;
    }
};
