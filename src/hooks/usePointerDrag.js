import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Reusable Pointer Events drag primitive (NOT HTML5 drag-and-drop — that API
 * never fires on touch). Works with mouse, touch and pen via pointer capture.
 *
 * Usage:
 *   const { dragging, ghostRef, startDrag } = usePointerDrag({ onDragStart, onDragMove, onDragEnd, onDragCancel });
 *   <button onPointerDown={(e) => startDrag(e, id, 'grid')} ... />
 *   {dragging && <div ref={ghostRef} className="drag-ghost">...</div>}
 *
 * The ghost element's position is written imperatively inside
 * requestAnimationFrame (ghostRef.current.style.transform) — no React
 * re-render per pointermove.
 *
 * IMPORTANT: draggable elements need the following styles so the browser
 * doesn't hijack the gesture for scrolling / text selection / iOS callouts:
 *   touch-action: none; user-select: none; -webkit-touch-callout: none;
 *
 * @param {Object}   options
 * @param {Function} [options.onDragStart]  (id, source) — fired once when the threshold is crossed
 * @param {Function} [options.onDragMove]   ({ id, source, x, y }) — fired per pointermove while active
 * @param {Function} [options.onDragEnd]    ({ id, source, x, y }) — fired on pointerup of an active drag
 * @param {Function} [options.onDragCancel] () — fired on pointercancel (incoming call, browser gesture, ...)
 * @param {number}   [options.threshold=8]  px of movement below which the gesture is treated as a tap
 * @param {number}   [options.liftDelayMs=150] delay before the pressed element gets a "lift" affordance
 * @returns {{ dragging: ({id: string, source: string}|null), ghostRef: Object, startDrag: Function }}
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

    const startDrag = useCallback((e, id, source) => {
        if (sessionRef.current) return; // a drag is already in flight (multi-touch guard)
        if (e.button !== 0) return; // primary button / touch contact only

        const el = e.currentTarget;
        const session = {
            id,
            source,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            pointerId: e.pointerId,
            el,
            active: false,
            liftTimer: 0,
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
                if (Math.hypot(x - s.startX, y - s.startY) <= threshold) return;
                s.active = true;
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
                    if (!cur || !cur.active || !ghostRef.current) return;
                    ghostRef.current.style.transform =
                        'translate3d(' + (cur.lastX - 32) + 'px, ' + (cur.lastY - 36) + 'px, 0) scale(1.1)';
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
            const detail = { id: s.id, source: s.source, x: ev.clientX, y: ev.clientY };
            if (wasActive && callbacksRef.current.onDragEnd) {
                callbacksRef.current.onDragEnd(detail);
            }
            // below-threshold release = tap → no-op
            cleanup();
        };

        session.cancel = (ev) => {
            const s = sessionRef.current;
            if (!s || ev.pointerId !== s.pointerId) return;
            if (callbacksRef.current.onDragCancel) callbacksRef.current.onDragCancel();
            cleanup();
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

        // "Lift" affordance: after a short hold, hint that the element is grabbable.
        session.liftTimer = setTimeout(() => {
            const s = sessionRef.current;
            if (!s || s.active || !s.el) return;
            s.prevTransform = s.el.style.transform;
            s.prevBoxShadow = s.el.style.boxShadow;
            s.el.style.transform = 'scale(1.08)';
            s.el.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            s.liftApplied = true;
        }, liftDelayMs);
    }, [threshold, liftDelayMs, clearLift, cleanup]);

    return { dragging, ghostRef, startDrag };
}
