/**
 * Notification manager — handles browser notifications
 * for incoming messages. Works in both browser tabs and standalone PWA.
 */

const recentlyNotified = new Set();

// ─── Vibration (mobile haptic feedback) ──────────────────────────────────────

function vibrate() {
    try {
        navigator.vibrate?.([80, 40, 80]);
    } catch { /* noop */ }
}

// ─── Browser Notification API ────────────────────────────────────────────────

/**
 * Show a browser/PWA notification for a new message.
 * Only shows when the page is not visible (background tab or minimised PWA).
 */
export function showBrowserNotification(senderName, content, onClick) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        const notification = new Notification(senderName || 'New message', {
            body: content?.substring(0, 120) || 'You have a new message',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'bies-dm-' + senderName, // groups per sender
            renotify: true,
            silent: true,
        });

        notification.onclick = () => {
            window.focus();
            onClick?.();
            notification.close();
        };

        // Auto-dismiss after 6 seconds
        setTimeout(() => notification.close(), 6000);
    } catch {
        // Notification construction can throw in some contexts
    }
}

// ─── Permission ──────────────────────────────────────────────────────────────

/**
 * Request notification permission. Returns the permission state.
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    return Notification.requestPermission();
}

export function getNotificationPermission() {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
}

// ─── Unified notify (with dedup) ─────────────────────────────────────────────

/**
 * Notify the user of a new incoming message.
 *
 * - Vibrates on mobile
 * - Shows a browser notification if the page is hidden
 * - Deduplicates by messageId so the same message doesn't trigger twice
 *   (covers the case where both Nostr subscription and WebSocket fire)
 *
 * @param {string}   messageId   Unique message/event ID
 * @param {string}   senderName  Display name of the sender
 * @param {string}   content     Message text (truncated in notification)
 * @param {function} [onClick]   Called when the browser notification is clicked
 */
export function notifyIncomingMessage(messageId, senderName, content, onClick) {
    if (recentlyNotified.has(messageId)) return;
    recentlyNotified.add(messageId);

    // Clean old IDs periodically (keep set from growing)
    if (recentlyNotified.size > 200) {
        const iter = recentlyNotified.values();
        for (let i = 0; i < 100; i++) {
            recentlyNotified.delete(iter.next().value);
        }
    }

    vibrate();

    // Only show browser notification when page is not focused
    if (document.visibilityState !== 'visible') {
        showBrowserNotification(senderName, content, onClick);
    }
}
