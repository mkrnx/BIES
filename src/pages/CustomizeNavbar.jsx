import React, { useState, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBottomNav } from '../context/BottomNavContext';
import usePointerDrag from '../hooks/usePointerDrag';
import { NAV_PAGES, NAV_PAGES_BY_ID, MAX_TABS, MIN_TABS } from '../config/navPages';

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * Phone-homescreen style customizer for the mobile bottom navbar
 * (route: /settings/navbar). Drag page icons from the grid into the
 * 5-slot dock; drag dock icons out to remove them. Auto-saves on every
 * committed change via BottomNavContext.
 */
const CustomizeNavbar = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { tabs, updateTabs, resetTabs } = useBottomNav();

    const dockRef = useRef(null);
    const gridRef = useRef(null);
    const flipRef = useRef(null); // { id, fromRect } of an evicted dock icon awaiting its FLIP
    const hoverIndexRef = useRef(null); // mirrors hoverIndex for synchronous reads on drop
    const [hoverIndex, setHoverIndex] = useState(null);

    const dockPages = tabs.map((id) => NAV_PAGES_BY_ID[id]).filter(Boolean);
    const gridPages = NAV_PAGES.filter((p) => !tabs.includes(p.id));

    const setHover = (idx) => {
        if (idx !== hoverIndexRef.current) {
            hoverIndexRef.current = idx;
            setHoverIndex(idx);
        }
    };

    const handleDragMove = ({ id, source, x, y }) => {
        const dock = dockRef.current;
        if (!dock) return;
        const r = dock.getBoundingClientRect();
        const over = y >= r.top - 16 && y <= r.bottom + 8 && x >= r.left && x <= r.right;
        if (!over) {
            setHover(null);
            return;
        }
        const visible = source === 'dock' ? tabs.filter((tid) => tid !== id) : tabs;
        const raw = Math.round(((x - r.left) / r.width) * Math.max(visible.length, 1));
        setHover(clamp(raw, 0, visible.length));
    };

    const handleDragEnd = ({ id, source }) => {
        const idx = hoverIndexRef.current;
        if (idx !== null) {
            // Dropped onto the dock: insert at idx, evicting the rightmost icon if full.
            const base = source === 'dock' ? tabs.filter((tid) => tid !== id) : [...tabs];
            let evicted = null;
            if (base.length >= MAX_TABS) evicted = base.pop();
            base.splice(Math.min(idx, base.length), 0, id);
            if (evicted) {
                const node = dockRef.current
                    ? dockRef.current.querySelector('[data-page-id="' + evicted + '"]')
                    : null;
                flipRef.current = { id: evicted, fromRect: node ? node.getBoundingClientRect() : null };
            }
            updateTabs(base);
        } else if (source === 'dock' && tabs.length > MIN_TABS) {
            // Dragged out of the dock: remove (no-op snap-back when it's the last tab).
            updateTabs(tabs.filter((tid) => tid !== id));
        }
        setHover(null);
    };

    const handleDragCancel = () => {
        setHover(null);
    };

    const { dragging, ghostRef, startDrag } = usePointerDrag({
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
    });

    // Eviction FLIP: the evicted dock icon animates from its old dock slot to its new grid tile.
    useLayoutEffect(() => {
        const flip = flipRef.current;
        if (!flip) return;
        flipRef.current = null;
        if (!flip.fromRect || !gridRef.current) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const node = gridRef.current.querySelector('[data-page-id="' + flip.id + '"]');
        if (!node) return;
        const to = node.getBoundingClientRect();
        const dx = flip.fromRect.left - to.left;
        const dy = flip.fromRect.top - to.top;
        if (!dx && !dy) return;
        node.style.transition = 'none';
        node.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
        node.getBoundingClientRect(); // force reflow so the inverse position is committed
        node.style.transition = 'transform 0.25s ease';
        node.style.transform = '';
        const onEnd = () => {
            node.style.transition = '';
            node.removeEventListener('transitionend', onEnd);
        };
        node.addEventListener('transitionend', onEnd);
    }, [tabs]);

    const draggedDockId = dragging && dragging.source === 'dock' ? dragging.id : null;
    const visibleDockIds = draggedDockId ? tabs.filter((tid) => tid !== draggedDockId) : tabs;

    const ghostPage = dragging ? NAV_PAGES_BY_ID[dragging.id] : null;
    const GhostIcon = ghostPage ? ghostPage.icon : null;

    return (
        <div className="container customize-page" style={{ paddingTop: '1.5rem' }}>
            <div className="customize-header">
                <button type="button" className="back-btn" aria-label={t('common.back')} onClick={() => navigate(-1)}>
                    <ChevronLeft size={22} />
                </button>
                <h1>{t('customNav.title')}</h1>
                <button type="button" className="reset-btn" data-testid="nav-reset" onClick={resetTabs}>
                    <RotateCcw size={15} />
                    <span>{t('customNav.reset')}</span>
                </button>
            </div>
            <p className="subtitle">{t('customNav.subtitle')}</p>
            <p className="desktop-note">{t('customNav.desktopNote')}</p>

            <div className="phone-frame">
                <div className="icon-grid" ref={gridRef}>
                    {gridPages.map((p) => {
                        const Icon = p.icon;
                        const isDragged = dragging !== null && dragging.id === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                className="grid-icon"
                                data-testid={'grid-icon-' + p.id}
                                data-page-id={p.id}
                                onPointerDown={(e) => startDrag(e, p.id, 'grid')}
                                style={isDragged ? { opacity: 0.35 } : undefined}
                            >
                                <span className="grid-tile"><Icon size={26} strokeWidth={1.8} /></span>
                                <span className="grid-label">{t(p.labelKey)}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="dock" ref={dockRef} data-testid="nav-dock">
                    {Array.from({ length: MAX_TABS }, (_, i) => {
                        const page = dockPages[i];
                        if (!page) {
                            return (
                                <div key={'empty-' + i} className="dock-slot">
                                    <span className="dock-placeholder" />
                                </div>
                            );
                        }
                        const Icon = page.icon;
                        const isDragged = page.id === draggedDockId;
                        const vIdx = visibleDockIds.indexOf(page.id);
                        const transform = hoverIndex === null || isDragged
                            ? 'none'
                            : (vIdx < hoverIndex ? 'translateX(-14px)' : 'translateX(14px)');
                        return (
                            <div key={page.id} className="dock-slot">
                                <button
                                    type="button"
                                    className="dock-icon"
                                    data-testid={'dock-icon-' + page.id}
                                    data-page-id={page.id}
                                    onPointerDown={(e) => startDrag(e, page.id, 'dock')}
                                    // Use opacity (not visibility:hidden) while dragging: the drag
                                    // hook keeps its listeners + pointer capture on this element, and
                                    // a non-hit-testable element releases capture and aborts the drag.
                                    style={{ transform, opacity: isDragged ? 0 : 1 }}
                                >
                                    <span className="dock-icon-wrap"><Icon size={22} strokeWidth={1.8} /></span>
                                    <span className="dock-label">{t(page.labelKey)}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {ghostPage && (
                <div ref={ghostRef} className="drag-ghost" data-testid="drag-ghost">
                    <span className="ghost-tile">{GhostIcon && <GhostIcon size={26} strokeWidth={1.8} />}</span>
                    <span className="ghost-label">{t(ghostPage.labelKey)}</span>
                </div>
            )}

            <style jsx>{`
                .customize-page { max-width: 48rem; padding-bottom: 3rem; }

                .customize-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
                .customize-header h1 { flex: 1; font-size: 1.5rem; margin: 0; }
                .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-full); border: 1px solid var(--color-gray-200); background: var(--color-surface); color: var(--color-gray-700); cursor: pointer; flex-shrink: 0; }
                .back-btn:hover { background: var(--color-gray-100); }
                .reset-btn { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.9rem; border-radius: var(--radius-full); border: 1px solid var(--color-gray-300); background: var(--color-surface); color: var(--color-gray-600); font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
                .reset-btn:hover { border-color: var(--color-secondary); color: var(--color-secondary); }

                .subtitle { color: var(--color-gray-500); font-size: 0.9rem; margin-bottom: 0.25rem; }
                .desktop-note { display: none; }
                @media (min-width: 769px) {
                    .desktop-note { display: block; color: var(--color-gray-400); font-size: 0.8rem; margin-bottom: 0.25rem; }
                }

                .phone-frame {
                    position: relative;
                    max-width: 390px;
                    margin: 1rem auto 0;
                    border: 8px solid var(--color-gray-800);
                    border-radius: 40px;
                    min-height: 640px;
                    background: var(--color-surface);
                    overflow: hidden;
                    padding: 1.5rem 0.75rem calc(110px + env(safe-area-inset-bottom, 0px));
                    box-shadow: var(--shadow-lg);
                }
                @media (max-width: 768px) {
                    .phone-frame {
                        border: none;
                        border-radius: 0;
                        max-width: none;
                        margin: 0.5rem 0 0;
                        box-shadow: none;
                        /* Size to content and place the dock in normal flow so it is
                           always on-screen and draggable — a fixed 640px frame with an
                           absolutely-pinned dock pushes the dock below the viewport. */
                        min-height: 0;
                        padding-bottom: 1rem;
                    }
                    /* Higher specificity than the later base dock rule, so the dock
                       renders in-flow below the grid instead of overlapping it. */
                    .phone-frame .dock {
                        position: static;
                        /* full-bleed to the frame edges (frame has 0.75rem side padding) */
                        margin: 1.25rem -0.75rem 0;
                    }
                }

                .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem 0.5rem; }

                .grid-icon,
                .dock-icon {
                    touch-action: none;
                    user-select: none;
                    -webkit-user-select: none;
                    -webkit-touch-callout: none;
                    cursor: grab;
                    background: none;
                    border: none;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    font-family: inherit;
                }
                .grid-icon:active,
                .dock-icon:active { cursor: grabbing; }

                .grid-icon { gap: 4px; color: var(--color-gray-700); }
                .grid-tile {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 56px;
                    height: 56px;
                    border-radius: var(--radius-lg);
                    background: var(--color-gray-100);
                    color: var(--color-primary);
                    box-shadow: var(--shadow-sm);
                }
                .grid-label { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.03em; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .dock {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-around;
                    background: var(--color-primary-nav, var(--color-primary));
                    border-top: 3px solid #FF5B00;
                    padding-top: 10px;
                    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
                }
                .dock-slot { flex: 1; display: flex; align-items: flex-start; justify-content: center; min-width: 0; }
                .dock-icon { gap: 3px; color: white; font-size: 0.68rem; font-weight: 500; letter-spacing: 0.03em; transition: transform 0.2s ease; }
                .dock-icon-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 32px;
                    border-radius: 16px;
                }
                .dock-icon:hover .dock-icon-wrap { color: #FF5B00; background: rgba(255, 91, 0, 0.15); }
                .dock-label { max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .dock-placeholder { display: block; width: 40px; height: 32px; border-radius: 16px; border: 2px dashed rgba(255, 255, 255, 0.4); }

                .drag-ghost {
                    position: fixed;
                    left: 0;
                    top: 0;
                    z-index: 10001;
                    pointer-events: none;
                    will-change: transform;
                    transform: translate3d(-1000px, -1000px, 0);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .ghost-tile {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 56px;
                    height: 56px;
                    border-radius: var(--radius-lg);
                    background: var(--color-surface);
                    color: var(--color-primary);
                    border: 2px solid var(--color-secondary);
                    box-shadow: var(--shadow-lg);
                }
                .ghost-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--color-gray-700);
                    background: var(--color-surface);
                    padding: 1px 6px;
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-sm);
                }

                @media (prefers-reduced-motion: reduce) {
                    .dock-icon { transition: none; }
                }
            `}</style>
        </div>
    );
};

export default CustomizeNavbar;
