import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Eye } from 'lucide-react';
import MarkdownView from './MarkdownView';

const tabButtonStyle = (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.4rem 0.875rem',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    background: 'none',
    color: active ? 'var(--color-primary)' : 'var(--color-gray-500)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
});

/**
 * Markdown editor with Write/Preview tabs.
 * onChange receives the textarea change event (read e.target.value),
 * matching the native form-field handleChange pattern used across the codebase.
 */
const MarkdownEditor = ({ value, onChange, placeholder, rows = 12 }) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('write');

    return (
        <div style={{ width: '100%' }}>
            {/* Write / Preview tabs */}
            <div style={{
                display: 'flex',
                gap: '0.25rem',
                borderBottom: '1px solid var(--color-gray-200)',
                marginBottom: '0.75rem',
            }}>
                <button
                    type="button"
                    onClick={() => setTab('write')}
                    style={tabButtonStyle(tab === 'write')}
                >
                    <Pencil size={14} /> {t('courses.builder.write')}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('preview')}
                    style={tabButtonStyle(tab === 'preview')}
                >
                    <Eye size={14} /> {t('courses.builder.preview')}
                </button>
            </div>

            {tab === 'write' ? (
                <textarea
                    value={value || ''}
                    onChange={onChange}
                    placeholder={placeholder}
                    rows={rows}
                    style={{
                        width: '100%',
                        padding: '0.65rem 0.875rem',
                        border: '1px solid var(--color-gray-300)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: 1.6,
                        background: 'var(--color-surface)',
                        color: 'var(--color-gray-800)',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-gray-300)'; }}
                />
            ) : (
                <div style={{
                    border: '1px solid var(--color-gray-200)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    padding: '1rem 1.25rem',
                    minHeight: `${rows * 1.5}em`,
                    boxSizing: 'border-box',
                    overflowX: 'auto',
                }}>
                    <MarkdownView markdown={value} />
                </div>
            )}

            {/* Markdown hint */}
            <p style={{
                margin: '0.35rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--color-gray-400)',
                fontFamily: 'var(--font-mono)',
            }}>
                Markdown · **bold** · _italic_ · `code` · [link](url)
            </p>
        </div>
    );
};

export default MarkdownEditor;
