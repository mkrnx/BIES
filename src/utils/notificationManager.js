/**
 * Notification manager — handles sound alerts and browser notifications
 * for incoming messages. Works in both browser tabs and standalone PWA.
 */

let audioCtx = null;
const recentlyNotified = new Set();

// ─── Audio context (lazy, unlocked on first user gesture) ────────────────────

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Pre-warm audio context on first user interaction (required by mobile browsers)
if (typeof document !== 'undefined') {
    const unlock = () => {
        try { getAudioContext(); } catch { /* noop */ }
    };
    ['click', 'touchstart', 'keydown'].forEach(evt =>
        document.addEventListener(evt, unlock, { once: true, passive: true })
    );
}

// ─── Sound synthesis ─────────────────────────────────────────────────────────

/**
 * Play a short two-tone notification chime via Web Audio API.
 */
export function playMessageSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Tone 1 — C6 (1046 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 1046.5;
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Tone 2 — E6 (1318 Hz), slightly delayed for a pleasant chime
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1318.5;
        gain2.gain.setValueAtTime(0, now + 0.08);
        gain2.gain.linearRampToValueAtTime(0.18, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.35);
    } catch {
        // Audio not available or not yet unlocked
    }
}

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
            silent: true, // we handle our own sound
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
 * - Plays the notification chime
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

    playMessageSound();
    vibrate();

    // Only show browser notification when page is not focused
    if (document.visibilityState !== 'visible') {
        showBrowserNotification(senderName, content, onClick);
    }
}
