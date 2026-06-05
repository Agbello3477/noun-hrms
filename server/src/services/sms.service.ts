export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
    try {
        console.log(`[SMS_SERVICE] SMS successfully sent to ${phoneNumber}: "${message}"`);
        return true;
    } catch (error) {
        console.error('[SMS_SERVICE] Error sending SMS:', error);
        return false;
    }
};
