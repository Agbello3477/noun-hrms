// Native Web Push Service Worker for Firebase Cloud Messaging (FCM)
// This avoids hardcoding Firebase API keys in a static public file.

self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
    
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = {
                notification: {
                    title: 'NOUN HRMS Notification',
                    body: event.data.text()
                }
            };
        }
    }

    // FCM sends standard notification payloads inside payload.notification
    // Custom data (like redirection links) is placed inside payload.data
    const title = payload.notification?.title || 'NOUN HRMS Update';
    const body = payload.notification?.body || 'You have a new update in the portal.';
    const clickAction = payload.data?.link || payload.data?.click_action || '/dashboard';

    const options = {
        body: body,
        icon: '/noun_logo.png',
        badge: '/noun_logo.png',
        data: {
            link: clickAction
        },
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'Open Portal' }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    
    const targetLink = event.notification.data?.link || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // If a window is already open, focus it and redirect
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) {
                    client.postMessage({ type: 'REDIRECT', url: targetLink });
                    return client.focus();
                }
            }
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(targetLink);
            }
        })
    );
});
