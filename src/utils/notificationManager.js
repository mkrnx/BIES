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

// ─── Web Push subscription ──────────────────────────────────────────────────

/**
 * Convert a base64url-encoded VAPID key to the Uint8Array format
 * required by PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Subscribe to web push notifications.
 * Requires: service worker registered, Notification permission 'granted',
 * and a valid VAPID public key from the backend.
 * Returns the PushSubscription, or null if subscription failed.
 */
export async function subscribeToPush(vapidPublicKey) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription first
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) return subscription;

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        return subscription;
    } catch (error) {
        console.error('[Push] Subscription failed:', error);
        return null;
    }
}

/**
 * Unsubscribe from web push notifications.
 * Returns the endpoint string for backend cleanup, or null.
 */
export async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return null;

        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        return endpoint;
    } catch (error) {
        console.error('[Push] Unsubscribe failed:', error);
        return null;
    }
}

/**
 * Check if the user currently has an active push subscription.
 */
export async function getPushSubscriptionState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { supported: false, subscribed: false };
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return { supported: true, subscribed: !!subscription };
    } catch {
        return { supported: true, subscribed: false };
    }
}
