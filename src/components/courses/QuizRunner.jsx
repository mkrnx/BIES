import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Loader2, RotateCcw, Target } from 'lucide-react';
import { coursesApi } from '../../services/api';

/**
 * Interactive quiz runner. The server grades answers (option payloads never
 * include the answer key), so we only render pass/fail per question — never
 * which option was correct.
 *
 * Props: { courseId, lessonId, quiz: {passPct, questions:[{id, prompt, options:[]}]}, onResult? }
 */
const QuizRunner = ({ courseId, lessonId, quiz, onResult }) => {
    const { t } = useTranslation();

    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const questions = quiz?.questions || [];
    const allAnswered = questions.length > 0
        && questions.every((q) => answers[q.id] !== undefined);

    const handleSelect = (questionId, optionIndex) => {
        if (result) return;
        setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        if (!allAnswered || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await coursesApi.submitQuiz(courseId, lessonId, answers);
            setResult(res);
            if (onResult) onResult(res);
        } catch (err) {
            if (err?.status === 429) {
                setError(t('courses.quiz.tooManyAttempts'));
            } else {
                setError(err?.data?.error || err?.message || 'Error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = () => {
        setAnswers({});
        setResult(null);
        setError(null);
    };

    return (
        <div className="quiz-runner">
            {/* Pass threshold note */}
            {typeof quiz?.passPct === 'number' && (
                <div className="quiz-threshold">
                    <Target size={15} />
                    {t('courses.quiz.passThreshold', { n: quiz.passPct })}
                </div>
            )}

            {/* Result summary */}
            {result && (
                <div className={`quiz-result ${result.passed ? 'passed' : 'failed'}`}>
                    <div className="result-score">
                        {t('courses.quiz.score', { score: result.scorePct })}
                    </div>
                    <div className="result-verdict">
                        {result.passed ? (
                            <><CheckCircle size={18} /> {t('courses.quiz.passed')}</>
                        ) : (
                            <><XCircle size={18} /> {t('courses.quiz.failed')}</>
                        )}
                    </div>
                </div>
            )}

            {/* Questions */}
            <div className="quiz-questions">
                {questions.map((q, i) => {
                    const marker = result?.results ? result.results[q.id] : undefined;
                    const locked = !!result || submitting;
                    return (
                        <div key={q.id} className={`quiz-question ${locked ? 'locked' : ''}`}>
                            <div className="question-header">
                                <span className="question-count">
                                    {t('courses.quiz.question', { current: i + 1, total: questions.length })}
                                </span>
                                {marker !== undefined && (
                                    marker ? (
                                        <CheckCircle size={17} className="marker-correct" />
                                    ) : (
                                        <XCircle size={17} className="marker-wrong" />
                                    )
                                )}
                            </div>
                            <div className="question-prompt">{q.prompt}</div>
                            <div className="question-options" role="radiogroup">
                                {(q.options || []).map((option, oi) => (
                                    <label
                                        key={oi}
                                        className={`option-row ${answers[q.id] === oi ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name={`quiz-q-${q.id}`}
                                            checked={answers[q.id] === oi}
                                            disabled={locked}
                                            onChange={() => handleSelect(q.id, oi)}
                                        />
                                        <span className="option-text">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && <p className="quiz-error">{error}</p>}

            {/* Actions */}
            <div className="quiz-actions">
                {result ? (
                    !result.passed && (
                        <button className="quiz-btn secondary" onClick={handleRetry}>
                            <RotateCcw size={15} /> {t('courses.quiz.retry')}
                        </button>
                    )
                ) : (
                    <button
                        className="quiz-btn"
                        onClick={handleSubmit}
                        disabled={!allAnswered || submitting}
                    >
                        {submitting
                            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                            : t('courses.quiz.submit')}
                    </button>
                )}
            </div>

            <style jsx>{`
                .quiz-runner {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .quiz-threshold {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    align-self: flex-start;
                    padding: 0.4rem 0.9rem;
                    border-radius: 9999px;
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .quiz-result {
                    border-radius: 12px;
                    padding: 1rem 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }
                .quiz-result.passed {
                    background: var(--color-green-tint, rgba(16, 185, 129, 0.12));
                    color: var(--color-success, #10b981);
                }
                .quiz-result.failed {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--color-error, #ef4444);
                }
                .result-score {
                    font-size: 1.15rem;
                    font-weight: 800;
                }
                .result-verdict {
                    display: flex;
                    align-items: center;
                    gap: 0.45rem;
                    font-size: 0.9rem;
                    font-weight: 700;
                }

                .quiz-questions {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .quiz-question {
                    border: 1px solid var(--color-gray-200);
                    border-radius: 12px;
                    padding: 1rem 1.25rem 1.25rem;
                    margin: 0;
                    background: var(--color-surface);
                }
                .quiz-question.locked .option-row {
                    cursor: default;
                }
                .quiz-question.locked .option-row:hover {
                    border-color: var(--color-gray-200);
                }
                .quiz-question.locked .option-row.selected,
                .quiz-question.locked .option-row.selected:hover {
                    border-color: var(--color-primary);
                }
                .question-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.35rem;
                }
                .question-count {
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--color-gray-400);
                }
                .quiz-question :global(.marker-correct) {
                    color: var(--color-success, #10b981);
                }
                .quiz-question :global(.marker-wrong) {
                    color: var(--color-error, #ef4444);
                }
                .question-prompt {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--color-gray-900);
                    padding: 0;
                    margin-bottom: 0.75rem;
                }
                .question-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .option-row {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    padding: 0.6rem 0.8rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 9px;
                    cursor: pointer;
                    font-size: 0.88rem;
                    color: var(--color-gray-700);
                    transition: all 0.15s;
                    margin: 0;
                    font-weight: normal;
                }
                .option-row:hover {
                    border-color: var(--color-primary);
                }
                .option-row.selected {
                    border-color: var(--color-primary);
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    font-weight: 600;
                }
                .option-row input[type='radio'] {
                    width: 16px;
                    height: 16px;
                    margin: 0;
                    accent-color: var(--color-primary);
                    cursor: pointer;
                    flex-shrink: 0;
                }
                .quiz-error {
                    color: var(--color-error, #ef4444);
                    font-size: 0.85rem;
                    font-weight: 600;
                    margin: 0;
                }

                .quiz-actions {
                    display: flex;
                    justify-content: flex-end;
                }
                .quiz-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    padding: 0.65rem 1.5rem;
                    border-radius: 10px;
                    border: none;
                    background: var(--color-primary);
                    color: white;
                    font-size: 0.9rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: opacity 0.15s;
                }
                .quiz-btn:hover:not(:disabled) { opacity: 0.9; }
                .quiz-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .quiz-btn.secondary {
                    background: var(--color-surface);
                    color: var(--color-primary);
                    border: 1px solid var(--color-gray-300);
                }
                .quiz-btn.secondary:hover {
                    border-color: var(--color-primary);
                    opacity: 1;
                    background: var(--color-blue-tint);
                }

                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default QuizRunner;
