// System-wide Native Desktop Push Notification Service

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function showBrowserNotification(title: string, options: NotificationOptions = {}): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        icon: '/icon.png',
        badge: '/icon.png',
        ...options
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return notif;
    } catch (err) {
      console.warn('[Notification] Could not display browser notification:', err);
      return null;
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        showBrowserNotification(title, options);
      }
    });
  }

  return null;
}
