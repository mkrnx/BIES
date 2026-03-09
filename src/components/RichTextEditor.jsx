import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder, minHeight = '120px' }) => {
    const editorRef = useRef(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handlePaste = (e) => {
        // Optional: you can strip formatting if you want, or just let it pass
        // e.preventDefault();
        // const text = e.clipboardData.getData('text/plain');
        // document.execCommand('insertText', false, text);
    };

    const execCmd = (cmd, arg = null) => {
        document.execCommand(cmd, false, arg);
        editorRef.current.focus();
        handleInput();
    };

    return (
        <div className="rich-text-editor">
            <div className="rte-toolbar">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }} title="Bold">
                    <Bold size={16} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }} title="Italic">
                    <Italic size={16} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }} title="Underline">
                    <Underline size={16} />
                </button>
                <div className="rte-divider" />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft'); }} title="Align Left">
                    <AlignLeft size={16} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter'); }} title="Align Center">
                    <AlignCenter size={16} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight'); }} title="Align Right">
                    <AlignRight size={16} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyFull'); }} title="Justify">
                    <AlignJustify size={16} />
                </button>
            </div>

            <div
                ref={editorRef}
                className="rte-content input-field"
                contentEditable
                onInput={handleInput}
                onBlur={handleInput}
                onPaste={handlePaste}
                style={{
                    minHeight,
                    outline: 'none',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderTop: 'none',
                    borderLeft: '1px solid var(--color-gray-300)',
                    borderRight: '1px solid var(--color-gray-300)',
                    borderBottom: '1px solid var(--color-gray-300)',
                }}
            />

            {!value && (
                <div className="rte-placeholder" style={{ pointerEvents: 'none' }}>
                    {placeholder}
                </div>
            )}

            <style jsx>{`
                .rich-text-editor {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    position: relative;
                }
                .rte-toolbar {
                    display: flex;
                    gap: 0.25rem;
                    padding: 0.5rem;
                    background: var(--color-gray-50, #f9fafb);
                    border: 1px solid var(--color-gray-300);
                    border-top-left-radius: var(--radius-md, 8px);
                    border-top-right-radius: var(--radius-md, 8px);
                    border-bottom: 1px solid var(--color-gray-200);
                }
                .rte-toolbar button {
                    background: transparent;
                    border: none;
                    border-radius: 4px;
                    padding: 0.4rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-gray-700);
                    transition: background 0.1s;
                }
                .rte-toolbar button:hover {
                    background: var(--color-gray-200);
                }
                .rte-divider {
                    width: 1px;
                    background: var(--color-gray-300);
                    margin: 0 0.25rem;
                }
                .rte-content {
                    padding: 0.75rem 1rem;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    border-bottom-left-radius: var(--radius-md, 8px);
                    border-bottom-right-radius: var(--radius-md, 8px);
                    background: white;
                }
                .rte-content:empty:before {
                    content: attr(placeholder);
                    color: var(--color-gray-400);
                    pointer-events: none;
                    display: block; // For Firefox
                }
                .rte-placeholder {
                    position: absolute;
                    top: 3.5rem; /* Adjust based on toolbar height */
                    left: 1rem;
                    color: var(--color-gray-400);
                    font-size: 0.95rem;
                }
            `}</style>
        </div>
    );
};

export default RichTextEditor;
