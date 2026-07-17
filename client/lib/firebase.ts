import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import api from './api';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if Firebase config is fully loaded
const isFirebaseConfigured = 
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

let messaging: Messaging | null = null;

if (typeof window !== 'undefined' && isFirebaseConfigured) {
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        messaging = getMessaging(app);
    } catch (error) {
        console.error('[FIREBASE] Failed to initialize Firebase client SDK:', error);
    }
}

export const requestPushNotificationsPermission = async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    if (!isFirebaseConfigured) {
        console.log('[FIREBASE] Environment variables not configured. Skipping token registration.');
        return;
    }

    if (!messaging) {
        console.log('[FIREBASE] Messaging client not initialized.');
        return;
    }

    try {
        // Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[FIREBASE] Notification permission denied by user.');
            return;
        }

        // Register Service Worker manually for FCM in Next.js
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('[Service Worker] Registered successfully with scope:', registration.scope);

            // Fetch registration token from FCM gateway
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('[FIREBASE] FCM Registration Token generated successfully');
                // Send token to the backend
                await api.post('/api/notifications/fcm-token', { fcmToken: token });
            } else {
                console.warn('[FIREBASE] No registration token received from FCM gateway.');
            }
        } else {
            console.warn('[FIREBASE] Service worker is not supported in this browser.');
        }
    } catch (error) {
        console.error('[FIREBASE] Error requesting notification permission:', error);
    }
};
