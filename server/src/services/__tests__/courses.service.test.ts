/**
 * Unit tests for the Courses/LMS pure core — quiz grading, learner-safe
 * serialization (answer-key leak regression), and entitlement logic.
 */

import { describe, it, expect } from 'vitest';
import {
    gradeQuiz,
    sanitizeLessonForLearner,
    serializeLessonMeta,
    canAccessLesson,
    QuizContent,
    QuizAnswerKey,
} from '../courses.service';

const QUIZ_CONTENT: QuizContent = {
    passPct: 70,
    questions: [
        { id: 'q0', prompt: 'What is 2+2?', options: ['3', '4', '5'] },
        { id: 'q1', prompt: 'Capital of ES?', options: ['San Salvador', 'Santa Ana'] },
        { id: 'q2', prompt: 'Sats per BTC?', options: ['100', '100000000'] },
    ],
};

const ANSWER_KEY: QuizAnswerKey = { q0: 1, q1: 0, q2: 1 };

describe('gradeQuiz', () => {
    it('passes at exactly the threshold', () => {
        // 2/3 correct = 67% < 70 → fail; 3/3 = 100% → pass
        const partial = gradeQuiz(QUIZ_CONTENT, ANSWER_KEY, { q0: 1, q1: 0, q2: 0 });
        expect(partial.scorePct).toBe(67);
        expect(partial.passed).toBe(false);

        const full = gradeQuiz(QUIZ_CONTENT, ANSWER_KEY, { q0: 1, q1: 0, q2: 1 });
        expect(full.scorePct).toBe(100);
        expect(full.passed).toBe(true);
    });

    it('counts unanswered questions as wrong', () => {
        const grade = gradeQuiz(QUIZ_CONTENT, ANSWER_KEY, { q0: 1 });
        expect(grade.correctCount).toBe(1);
        expect(grade.results).toEqual({ q0: true, q1: false, q2: false });
        expect(grade.passed).toBe(false);
    });

    it('ignores unknown question ids in the submission', () => {
        const grade = gradeQuiz(QUIZ_CONTENT, ANSWER_KEY, {
            q0: 1,
            q1: 0,
            q2: 1,
            hacked: 0,
        });
        expect(grade.total).toBe(3);
        expect(grade.passed).toBe(true);
        expect(grade.results).not.toHaveProperty('hacked');
    });

    it('never reveals correct indices — only booleans', () => {
        const grade = gradeQuiz(QUIZ_CONTENT, ANSWER_KEY, { q0: 0, q1: 1, q2: 0 });
        const serialized = JSON.stringify(grade);
        for (const value of Object.values(grade.results)) {
            expect(typeof value).toBe('boolean');
        }
        expect(serialized).not.toContain('correctIndex');
        expect(serialized).not.toContain('answerKey');
    });

    it('handles an empty quiz without dividing by zero', () => {
        const grade = gradeQuiz({ passPct: 70, questions: [] }, {}, {});
        expect(grade.scorePct).toBe(0);
        expect(grade.passed).toBe(false);
    });

    it('defaults a missing passPct to 100', () => {
        const content = { questions: QUIZ_CONTENT.questions } as unknown as QuizContent;
        const almost = gradeQuiz(content, ANSWER_KEY, { q0: 1, q1: 0, q2: 0 });
        expect(almost.passed).toBe(false);
        const perfect = gradeQuiz(content, ANSWER_KEY, { q0: 1, q1: 0, q2: 1 });
        expect(perfect.passed).toBe(true);
    });
});

describe('sanitizeLessonForLearner — leak regression', () => {
    const quizLessonRow = {
        id: 'lsn1',
        courseId: 'crs1',
        title: 'Final quiz',
        type: 'QUIZ',
        position: 2,
        content: JSON.stringify(QUIZ_CONTENT),
        quizAnswerKey: JSON.stringify(ANSWER_KEY),
        durationSec: null,
        isFreePreview: false,
        nostrEventId: null,
    };

    it('never includes the answer key in any serialized shape', () => {
        const payload = sanitizeLessonForLearner(quizLessonRow);
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain('quizAnswerKey');
        expect(serialized).not.toContain('answerKey');
        expect(serialized).not.toContain('correctIndex');
        // The literal key mapping must not appear either
        expect(serialized).not.toContain('"q0":1');
    });

    it('serves learner-safe quiz content (questions without answers)', () => {
        const payload = sanitizeLessonForLearner(quizLessonRow) as any;
        expect(payload.content.passPct).toBe(70);
        expect(payload.content.questions).toHaveLength(3);
        expect(payload.content.questions[0]).toEqual({
            id: 'q0',
            prompt: 'What is 2+2?',
            options: ['3', '4', '5'],
        });
    });

    it('metadata serializer exposes no content at all', () => {
        const meta = serializeLessonMeta(quizLessonRow);
        const serialized = JSON.stringify(meta);
        expect(serialized).not.toContain('content');
        expect(serialized).not.toContain('quizAnswerKey');
        expect(serialized).not.toContain('What is 2+2');
    });

    it('tolerates malformed content JSON', () => {
        const payload = sanitizeLessonForLearner({
            ...quizLessonRow,
            content: 'not-json{{{',
        }) as any;
        expect(payload.content).toEqual({});
    });
});

describe('canAccessLesson', () => {
    const paidCourse = { id: 'c1', authorId: 'author', priceSats: 5000, status: 'active' };
    const freeCourse = { id: 'c2', authorId: 'author', priceSats: 0, status: 'active' };
    const lesson = { isFreePreview: false };
    const preview = { isFreePreview: true };

    const base = { lesson, isAdmin: false, enrolled: false, purchased: false };

    it('denies anonymous viewers', () => {
        expect(canAccessLesson({ ...base, course: freeCourse, userId: null })).toBe(false);
    });

    it('always allows the author and staff', () => {
        expect(canAccessLesson({ ...base, course: paidCourse, userId: 'author' })).toBe(true);
        expect(
            canAccessLesson({ ...base, course: paidCourse, userId: 'mod', isAdmin: true })
        ).toBe(true);
    });

    it('denies everyone else on non-active courses', () => {
        const draft = { ...paidCourse, status: 'draft' };
        expect(
            canAccessLesson({ ...base, course: draft, userId: 'u1', purchased: true })
        ).toBe(false);
    });

    it('free-preview lessons are open to any member', () => {
        expect(
            canAccessLesson({ ...base, course: paidCourse, lesson: preview, userId: 'u1' })
        ).toBe(true);
    });

    it('paid course requires purchase — enrollment alone is not enough', () => {
        expect(
            canAccessLesson({ ...base, course: paidCourse, userId: 'u1', enrolled: true })
        ).toBe(false);
        expect(
            canAccessLesson({ ...base, course: paidCourse, userId: 'u1', purchased: true })
        ).toBe(true);
    });

    it('free course requires enrollment', () => {
        expect(canAccessLesson({ ...base, course: freeCourse, userId: 'u1' })).toBe(false);
        expect(
            canAccessLesson({ ...base, course: freeCourse, userId: 'u1', enrolled: true })
        ).toBe(true);
    });
});
