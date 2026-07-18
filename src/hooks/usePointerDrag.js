import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Reusable Pointer Events drag primitive (NOT HTML5 drag-and-drop — that API
 * never fires on touch). Works with mouse, touch and pen via pointer capture.
 *
 * Usage:
 *   const { dragging, ghostRef, startDrag, consumeDrag } = usePointerDrag({ onDragStart, onDragMove, onDragEnd, onDragCancel });
 *   <button onPointerDown={(e) => startDrag(e, id, 'grid')} onClick={() => { if (!consumeDrag()) tapAction(); }} ... />
 *   {dragging && <div ref={ghostRef} className="drag-ghost">...</div>}
 *
 * The ghost element's position is written imperatively inside
 * requestAnimationFrame (ghostRef.current.style.transform) — no React
 * re-render per pointermove. The ghost is anchored at the exact point the
 * element was grabbed (grab offset) and scaled so its box matches the source
 * element's rect, so nothing jumps under the finger on lift. Give the ghost
 * `transform-origin: top left` for the scale to line up.
 *
 * Activation model:
 *   - mouse/pen: crossing the movement threshold (default 8px) starts the drag.
 *   - touch: the press must first survive the lift hold (liftDelayMs); moving
 *     past the threshold BEFORE the hold abandons the gesture so the browser
 *     can scroll. Once the hold has fired, touchmove is preventDefault'ed and
 *     crossing the threshold starts the drag (vertical drags included).
 *
 * IMPORTANT: draggable elements need the following styles so the browser
 * doesn't hijack the gesture for text selection / iOS callouts while still
 * allowing vertical scrolling before the touch hold:
 *   touch-action: pan-y; user-select: none; -webkit-touch-callout: none;
 *
 * @param {Object}   options
 * @param {Function} [options.onDragStart]  (id, source) — fired once when the threshold is crossed
 * @param {Function} [options.onDragMove]   ({ id, source, x, y }) — fired per pointermove while active
 * @param {Function} [options.onDragEnd]    ({ id, source, x, y }) — fired on pointerup of an active drag
 * @param {Function} [options.onDragCancel] ({ id, source }) — fired on pointercancel (incoming call, browser gesture, ...)
 * @param {number}   [options.threshold=8]  px of movement below which the gesture is treated as a tap
 * @param {number}   [options.liftDelayMs=150] hold delay before the pressed element gets a "lift" affordance
 *                                             (and, on touch, before a drag may activate at all)
 * @returns {{ dragging: ({id: string, source: string}|null), ghostRef: Object, startDrag: Function, consumeDrag: Function }}
 */
export default function usePointerDrag({
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    threshold = 8,
    liftDelayMs = 150,
} = {}) {
    const [dragging, setDragging] = useState(null); // { id, source } | null
    const ghostRef = useRef(null);
    const sessionRef = useRef(null); // active pointer session (also the multi-touch guard)
    const rafRef = useRef(0);
    const draggedRef = useRef(false); // the most recent gesture became a drag (suppresses its trailing click)

    // Always call the latest callbacks, even though listeners are bound once per drag.
    const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onDragCancel });
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onDragCancel };

    const clearLift = useCallback((session) => {
        if (!session) return;
        if (session.liftTimer) {
            clearTimeout(session.liftTimer);
            session.liftTimer = 0;
        }
        if (session.liftApplied && session.el) {
            session.el.style.transform = session.prevTransform || '';
            session.el.style.boxShadow = session.prevBoxShadow || '';
            session.liftApplied = false;
        }
    }, []);

    const cleanup = useCallback(() => {
        const session = sessionRef.current;
        if (!session) return;
        clearLift(session);
        session.el.removeEventListener('pointermove', session.move);
        session.el.removeEventListener('pointerup', session.up);
        session.el.removeEventListener('pointercancel', session.cancel);
        session.el.removeEventListener('touchmove', session.touchMove);
        try {
            session.el.releasePointerCapture(session.pointerId);
        } catch {
            // capture may already be released — ignore
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
        }
        sessionRef.current = null;
        setDragging(null);
    }, [clearLift]);

    // Abort cleanly if the component unmounts mid-drag.
    useEffect(() => cleanup, [cleanup]);

    /**
     * Tap/click fallback helper: returns true (and resets) when the gesture
     * that just ended was an actual drag, so the click it produces can be
     * swallowed. Keyboard-initiated clicks never had a drag → returns false.
     */
    const consumeDrag = useCallback(() => {
        const was = draggedRef.current;
        draggedRef.current = false;
        return was;
    }, []);

    const startDrag = useCallback((e, id, source) => {
        if (sessionRef.current) return; // a drag is already in flight (multi-touch guard)
        if (e.button !== 0) return; // primary button / touch contact only

        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        draggedRef.current = false;
        const session = {
            id,
            source,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
            // Grab offset: keep the ghost anchored to the exact grab point so
            // nothing jumps under the finger when the drag activates.
            grabX: e.clientX - rect.left,
            grabY: e.clientY - rect.top,
            srcWidth: rect.width,
            ghostScale: 0, // computed lazily once the ghost is mounted
            el,
            active: false,
            liftTimer: 0,
            holdElapsed: false, // the liftDelayMs hold has passed (touch drag-activation gate)
            liftApplied: false,
            prevTransform: '',
            prevBoxShadow: '',
        };

        session.move = (ev) => {
            const s = sessionRef.current;
            if (!s || ev.pointerId !== s.pointerId) return;
            const x = ev.clientX;
            const y = ev.clientY;
            if (!s.active) {
                if (s.pointerType === 'touch' && !s.holdElapsed) {
                    // Touch before the hold: movement past the threshold means
                    // the user is scrolling (touch-action: pan-y) — abandon the
                    // pending drag so the browser keeps the gesture.
                    if (Math.hypot(x - s.startX, y - s.startY) > threshold) cleanup();
                    return;
                }
                if (Math.hypot(x - s.startX, y - s.startY) <= threshold) return;
                s.active = true;
                draggedRef.current = true;
                clearLift(s);
                setDragging({ id: s.id, source: s.source });
                if (callbacksRef.current.onDragStart) callbacksRef.current.onDragStart(s.id, s.source);
                ev.preventDefault();
            }
            s.lastX = x;
            s.lastY = y;
            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = 0;
                    const cur = sessionRef.current;
                    const ghost = ghostRef.current;
                    if (!cur || !cur.active || !ghost) return;
                    if (!cur.ghostScale) {
                        // Scale the ghost so its box matches the source element's rect.
                        const w = ghost.offsetWidth;
                        cur.ghostScale = w > 0 && cur.srcWidth > 0 ? cur.srcWidth / w : 1;
                    }
                    ghost.style.transform =
                        'translate3d(' + (cur.lastX - cur.grabX) + 'px, ' + (cur.lastY - cur.grabY) + 'px, 0)'
                        + ' scale(' + cur.ghostScale + ')';
                });
            }
            if (callbacksRef.current.onDragMove) {
                callbacksRef.current.onDragMove({ id: s.id, source: s.source, x, y });
            }
        };

        session.up = (ev) => {
            const s = sessionRef.current;
            if (!s || ev.pointerId !== s.pointerId) return;
            const wasActive = s.active;
            draggedRef.current = wasActive; // an active drag's trailing click must be swallowed
            if (wasActive) {
                // A drag's trailing click (if any) is synthesized right after
                // pointerup, in the same task. Touch drags produce no click at
                // all (preventDefault'ed touchmoves suppress synthesis), so
                // auto-clear the flag — otherwise it would leak into the next
                // click without a pointerdown (e.g. keyboard Enter/Space).
                setTimeout(() => { draggedRef.current = false; }, 0);
            }
            const detail = { id: s.id, source: s.source, x: ev.clientX, y: ev.clientY };
            if (wasActive && callbacksRef.current.onDragEnd) {
                callbacksRef.current.onDragEnd(detail);
            }
            // below-threshold release = tap → the trailing click handles it
            cleanup();
        };

        session.cancel = (ev) => {
            const s = sessionRef.current;
            if (!s || ev.pointerId !== s.pointerId) return;
            draggedRef.current = false; // pointercancel produces no click — nothing to swallow
            if (callbacksRef.current.onDragCancel) {
                callbacksRef.current.onDragCancel({ id: s.id, source: s.source });
            }
            cleanup();
        };

        // Once the hold has fired (or a drag is active) cancel native touch
        // scrolling so post-hold vertical drags aren't hijacked by pan-y.
        session.touchMove = (ev) => {
            const s = sessionRef.current;
            if (s && (s.holdElapsed || s.active) && ev.cancelable) ev.preventDefault();
        };

        sessionRef.current = session;

        try {
            el.setPointerCapture(e.pointerId);
        } catch {
            // capture can fail for stale pointer ids — the drag still works via bubbling on the element
        }
        el.addEventListener('pointermove', session.move);
        el.addEventListener('pointerup', session.up);
        el.addEventListener('pointercancel', session.cancel);
        if (session.pointerType === 'touch') {
            el.addEventListener('touchmove', session.touchMove, { passive: false });
        }

        // "Lift" affordance: after a short hold, hint that the element is
        // grabbable. On touch this is also the drag-activation gate.
        session.liftTimer = setTimeout(() => {
            const s = sessionRef.current;
            if (!s || s.active || !s.el) return;
            s.holdElapsed = true;
            const cur = s.el.style.transform;
            // Mid-animation (e.g. a FLIP still settling on this element): skip
            // the visual lift so we never capture — and later restore — a
            // transient transform. The hold gate above still opens.
            if (cur && cur !== 'none') return;
            s.prevTransform = s.el.style.transform;
            s.prevBoxShadow = s.el.style.boxShadow;
            s.el.style.transform = 'scale(1.08)';
            s.el.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            s.liftApplied = true;
        }, liftDelayMs);
    }, [threshold, liftDelayMs, clearLift, cleanup]);

    return { dragging, ghostRef, startDrag, consumeDrag };
}
