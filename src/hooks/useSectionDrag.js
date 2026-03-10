import { useState, useRef, useCallback } from 'react';

/**
 * Hook for drag-and-drop reordering of custom sections.
 * Reorders items live as you drag over them for smooth animation.
 *
 * @param {Function} onReorder - Called with (fromIndex, toIndex) to reorder immediately
 * @returns {Object} Drag state and handlers to spread onto section elements
 */
export const useSectionDrag = (onReorder) => {
    const dragItemIdx = useRef(null);
    const [draggingIdx, setDraggingIdx] = useState(null);

    const handleDragStart = useCallback((e, idx) => {
        dragItemIdx.current = idx;
        setDraggingIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
    }, []);

    const handleDragOver = useCallback((e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const from = dragItemIdx.current;
        if (from !== null && from !== idx) {
            onReorder(from, idx);
            dragItemIdx.current = idx;
            setDraggingIdx(idx);
        }
    }, [onReorder]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
    }, []);

    const handleDragEnd = useCallback(() => {
        dragItemIdx.current = null;
        setDraggingIdx(null);
    }, []);

    const getSectionDragProps = useCallback((idx) => ({
        draggable: true,
        onDragStart: (e) => handleDragStart(e, idx),
        onDragOver: (e) => handleDragOver(e, idx),
        onDrop: handleDrop,
        onDragEnd: handleDragEnd,
    }), [handleDragStart, handleDragOver, handleDrop, handleDragEnd]);

    return {
        draggingIdx,
        getSectionDragProps,
    };
};

/** Reorder helper: moves item from `fromIdx` to `toIdx` in an array */
export const reorderArray = (arr, fromIdx, toIdx) => {
    const result = [...arr];
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    return result;
};
