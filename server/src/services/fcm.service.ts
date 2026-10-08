import admin from 'firebase-admin';
import prisma from '../prisma';

const projectId = process.env.FCM_PROJECT_ID;
const clientEmail = process.env.FCM_CLIENT_EMAIL;
// Handle newlines in private key if it comes from env
const privateKey = process.env.FCM_PRIVATE_KEY ? process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '') : undefined;

let isFcmInitialized = false;

try {
    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey
            })
        });
        isFcmInitialized = true;
        console.log('[FCM_SERVICE] Firebase Admin initialized successfully');
    } else {
        console.log('[FCM_SERVICE] Firebase credentials not fully configured. Using mock console logger.');
    }
} catch (error) {
    console.error('[FCM_SERVICE] Failed to initialize Firebase Admin:', error);
}

export const sendPushNotification = async (
    userIds: string[],
    title: string,
    body: string,
    link?: string
): Promise<void> => {
    try {
        // Exclude sender or handle multiple recipients
        if (userIds.length === 0) return;

        // Fetch tokens for the specified users
        const tokenRecords = await prisma.fcmToken.findMany({
            where: { userId: { in: userIds } },
            select: { token: true, userId: true }
        });

        if (tokenRecords.length === 0) {
            console.log(`[FCM_SERVICE] No device tokens found for users: [${userIds.join(', ')}]`);
            return;
        }

        const tokens = tokenRecords.map(r => r.token);

        if (isFcmInitialized) {
            const message = {
                notification: { title, body },
                data: {
                    ...(link ? { click_action: link, link } : {})
                },
                tokens: tokens
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[FCM_SERVICE] Sent push. Success: ${response.successCount}, Failures: ${response.failureCount}`);

            // Handle invalid tokens
            if (response.failureCount > 0) {
                const tokensToRemove: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errorCode = resp.error.code;
                        if (
                            errorCode === 'messaging/registration-token-not-registered' ||
                            errorCode === 'messaging/invalid-argument'
                        ) {
                            tokensToRemove.push(tokens[idx]);
                        }
                    }
                });

                if (tokensToRemove.length > 0) {
                    await prisma.fcmToken.deleteMany({
                        where: { token: { in: tokensToRemove } }
                    });
                    console.log(`[FCM_SERVICE] Cleaned up ${tokensToRemove.length} inactive/invalid device tokens`);
                }
            }
        } else {
            console.log(`[FCM_SERVICE] [MOCK] Sending push to ${tokens.length} devices (FCM not configured)`);
            console.log(`[FCM_SERVICE] [MOCK] Title: "${title}", Body: "${body}", Link: "${link || 'N/A'}"`);
        }
    } catch (error) {
        console.error('[FCM_SERVICE] Error sending push notification:', error);
    }
};
