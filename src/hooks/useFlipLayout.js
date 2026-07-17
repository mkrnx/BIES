import { useRef, useCallback, useEffect } from 'react';

/**
 * Generalized FLIP (First → Last → Invert → Play) layout animator for the
 * navbar customizer. Every element carrying a [data-page-id] attribute under
 * the given container refs is tracked by its page id, so icons animate
 * smoothly even when they remount in a different container (grid ↔ dock).
 *
 * Usage:
 *   const { capture, play } = useFlipLayout([gridRef, dockRef]);
 *   // synchronously BEFORE the state commit that re-lays-out the icons:
 *   capture({ [movedId]: ghostRect }); // overrides are optional
 *   updateTabs(next);
 *   // AFTER the commit:
 *   useLayoutEffect(() => { play(); }, [tabs, play]);
 *
 * capture() batch-reads the First rects; play() batch-reads the Last rects,
 * batch-writes the inverted transforms (with a scale component when the
 * element changed size, e.g. ghost tile → dock icon), forces a single reflow
 * and releases the transforms with a transition. Cleanup runs on BOTH
 * 'transitionend' and 'transitioncancel', and an interrupted animation can be
 * re-captured mid-flight (rects are read from the live, transformed position).
 * Respects prefers-reduced-motion.
 *
 * @param {Array<{current: (HTMLElement|null)}>} containerRefs refs of the containers to scan
 * @param {Object} [options]
 * @param {number} [options.duration=250] transition duration in ms
 * @param {string} [options.easing='cubic-bezier(0.2, 0, 0, 1)'] transition timing function
 * @returns {{ capture: Function, play: Function }}
 */
export default function useFlipLayout(containerRefs, {
    duration = 250,
    easing = 'cubic-bezier(0.2, 0, 0, 1)',
} = {}) {
    // Keep the (stable) refs reachable without forcing callback identity churn.
    const refsRef = useRef(containerRefs);
    refsRef.current = containerRefs;

    const firstRectsRef = useRef(null); // Map<pageId, DOMRect> | null — pending First snapshot
    const activeRef = useRef(new Map()); // node → detach() for in-flight animations

    const collectNodes = useCallback(() => {
        const nodes = new Map();
        for (const ref of refsRef.current) {
            const root = ref ? ref.current : null;
            if (!root) continue;
            root.querySelectorAll('[data-page-id]').forEach((node) => {
                nodes.set(node.getAttribute('data-page-id'), node);
            });
        }
        return nodes;
    }, []);

    /**
     * Snapshot the First rects. Call synchronously right before the state
     * commit. `overrides` maps a page id to a rect that should be used instead
     * of the element's own (e.g. the drag ghost's rect for the dropped icon).
     * @param {Object<string, DOMRect>} [overrides]
     */
    const capture = useCallback((overrides) => {
        const rects = new Map();
        collectNodes().forEach((node, id) => {
            rects.set(id, node.getBoundingClientRect());
        });
        if (overrides) {
            for (const id of Object.keys(overrides)) {
                if (overrides[id]) rects.set(id, overrides[id]);
            }
        }
        firstRectsRef.current = rects;
    }, [collectNodes]);

    /**
     * Invert + play the pending snapshot. Call from a useLayoutEffect keyed to
     * the committed state so it runs after the DOM re-layout but before paint.
     * No-op when capture() was not called for this commit.
     */
    const play = useCallback(() => {
        const first = firstRectsRef.current;
        firstRectsRef.current = null;
        if (!first) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const nodes = collectNodes();

        // Interrupted animations: clear any leftover in-flight transform
        // BEFORE measuring, otherwise the Last rect includes the stale offset
        // (the First rect was captured at the live, transformed position, so
        // the offset would cancel out of dx and the node would visibly snap
        // backward when the inverted transform is written).
        nodes.forEach((node) => {
            if (activeRef.current.has(node)) {
                node.style.transition = 'none';
                node.style.transform = '';
            }
        });

        // Batch-read every Last rect before touching any further style.
        const moves = [];
        nodes.forEach((node, id) => {
            const from = first.get(id);
            if (!from) return;
            const to = node.getBoundingClientRect();
            const dx = from.left - to.left;
            const dy = from.top - to.top;
            const sx = to.width > 0 ? from.width / to.width : 1;
            const sy = to.height > 0 ? from.height / to.height : 1;
            const scales = Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !scales) return;
            moves.push({ node, dx, dy, sx, sy, scales });
        });
        if (!moves.length) return;

        // Batch-write the inverted transforms.
        for (const m of moves) {
            const detach = activeRef.current.get(m.node);
            if (detach) detach(); // interrupted animation: drop its listeners, keep going
            m.node.style.transition = 'none';
            m.node.style.transformOrigin = 'top left';
            m.node.style.transform = 'translate(' + m.dx + 'px, ' + m.dy + 'px)'
                + (m.scales ? ' scale(' + m.sx + ', ' + m.sy + ')' : '');
        }

        // A single forced reflow commits every inverted position at once.
        void moves[0].node.getBoundingClientRect();

        // Play: release every transform under one transition.
        for (const m of moves) {
            const node = m.node;
            node.style.transition = 'transform ' + duration + 'ms ' + easing;
            node.style.transform = '';

            const detach = () => {
                node.removeEventListener('transitionend', done);
                node.removeEventListener('transitioncancel', done);
                activeRef.current.delete(node);
            };
            const done = (ev) => {
                if (ev.target !== node || (ev.propertyName && ev.propertyName !== 'transform')) return;
                detach();
                node.style.transition = '';
                node.style.transformOrigin = '';
            };
            activeRef.current.set(node, detach);
            node.addEventListener('transitionend', done);
            node.addEventListener('transitioncancel', done);
        }
    }, [collectNodes, duration, easing]);

    // Drop any in-flight listeners if the component unmounts mid-animation.
    useEffect(() => {
        const active = activeRef.current;
        return () => {
            active.forEach((detach) => detach());
        };
    }, []);

    return { capture, play };
}
