/**
 * Courses/LMS core — quiz grading, learner-safe serialization, entitlement
 * checks, and course-completion orchestration (points + certificate badge).
 *
 * The serializers here are the single choke point between Lesson rows and
 * client payloads: `quizAnswerKey` must never appear in any shape returned
 * to a learner, and paid lesson `content` is only released through
 * `canAccessLesson`-gated endpoints.
 */

import prisma from '../lib/prisma';
import { applyPoints, isUniqueViolation, monthOf } from './points.service';
import { publishBadgeAward } from './badges.publisher';
import { createNotification } from './notification.service';

// ─── Constants ───────────────────────────────────────────────────────────────

export const POINTS_COURSE_COMPLETED = 25;

export const LESSON_TYPES = ['VIDEO', 'TEXT', 'QUIZ'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizQuestion {
    id: string;
    prompt: string;
    options: string[];
}

/** Learner-safe quiz content (no answers). */
export interface QuizContent {
    passPct: number;
    questions: QuizQuestion[];
}

/** questionId → index of the correct option. Server-only. */
export type QuizAnswerKey = Record<string, number>;

/** questionId → index the learner selected. */
export type QuizAnswers = Record<string, number>;

export interface QuizGrade {
    scorePct: number;
    passed: boolean;
    correctCount: number;
    total: number;
    /** questionId → whether the submitted answer was correct. */
    results: Record<string, boolean>;
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * Grade a quiz submission against the server-only answer key. Unknown
 * question ids in the submission are ignored; unanswered questions count
 * as wrong. Never reveals correct indices — only per-question booleans.
 */
export function gradeQuiz(
    content: QuizContent,
    answerKey: QuizAnswerKey,
    answers: QuizAnswers
): QuizGrade {
    const questions = Array.isArray(content.questions) ? content.questions : [];
    const total = questions.length;
    const results: Record<string, boolean> = {};
    let correctCount = 0;

    for (const question of questions) {
        const correct =
            answerKey[question.id] !== undefined &&
            answers[question.id] === answerKey[question.id];
        results[question.id] = correct;
        if (correct) correctCount += 1;
    }

    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passPct = Number.isFinite(content.passPct) ? content.passPct : 100;
    return { scorePct, passed: scorePct >= passPct, correctCount, total, results };
}

/**
 * Lesson metadata only — safe for any viewer (catalog/detail curriculum).
 * No content, no answer key.
 */
export function serializeLessonMeta(lesson: {
    id: string;
    title: string;
    type: string;
    position: number;
    durationSec: number | null;
    isFreePreview: boolean;
    nostrEventId?: string | null;
}): Record<string, unknown> {
    return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        position: lesson.position,
        durationSec: lesson.durationSec,
        isFreePreview: lesson.isFreePreview,
        nostrEventId: lesson.nostrEventId ?? null,
    };
}

/**
 * Full lesson payload for an ENTITLED learner. Parses `content` JSON;
 * structurally cannot leak the answer key (separate column, never read here).
 */
export function sanitizeLessonForLearner(lesson: {
    id: string;
    courseId: string;
    title: string;
    type: string;
    position: number;
    content: string;
    durationSec: number | null;
    isFreePreview: boolean;
    nostrEventId?: string | null;
}): Record<string, unknown> {
    return {
        ...serializeLessonMeta(lesson),
        courseId: lesson.courseId,
        content: parseJson<Record<string, unknown>>(lesson.content, {}),
    };
}

/** Parse a Course row's JSON string fields for client responses. */
export function serializeCourse<T extends { tags: string }>(course: T): T & { tags: string[] } {
    return { ...course, tags: parseJson<string[]>(course.tags, []) };
}

// ─── Entitlement ─────────────────────────────────────────────────────────────

export interface AccessContext {
    course: { id: string; authorId: string; priceSats: number; status: string };
    lesson: { isFreePreview: boolean };
    userId: string | null;
    isAdmin: boolean;
    enrolled: boolean;
    purchased: boolean;
}

/**
 * Whether full lesson content may be served. Free-preview lessons are open
 * to any authenticated member; otherwise author/admin, enrolled (free
 * course), or purchased (paid course).
 */
export function canAccessLesson(ctx: AccessContext): boolean {
    if (!ctx.userId) return false;
    if (ctx.userId === ctx.course.authorId || ctx.isAdmin) return true;
    if (ctx.course.status !== 'active') return false;
    if (ctx.lesson.isFreePreview) return true;
    if (ctx.course.priceSats > 0) return ctx.purchased;
    return ctx.enrolled;
}

// ─── Completion orchestration ────────────────────────────────────────────────

/**
 * Check whether every lesson of the enrollment's course is complete; on the
 * first full completion, stamp `completedAt`, award points and the course
 * certificate badge, and notify the learner.
 *
 * Race-safe: the `updateMany({ completedAt: null })` count acts as the
 * first-completion gate, and the PointEvent unique constraint (synthetic
 * event id `course:<courseId>`) absorbs replays. Authors completing their
 * own course get no points/badge.
 *
 * Returns `{ completed, certificateEventId }` for the caller's response.
 */
export async function checkCourseCompletion(
    enrollmentId: string
): Promise<{ completed: boolean; justCompleted: boolean }> {
    const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: {
            id: true,
            userId: true,
            completedAt: true,
            course: { select: { id: true, authorId: true, title: true } },
        },
    });
    if (!enrollment) return { completed: false, justCompleted: false };
    if (enrollment.completedAt) return { completed: true, justCompleted: false };

    const [lessonCount, progressCount] = await Promise.all([
        prisma.lesson.count({ where: { courseId: enrollment.course.id } }),
        prisma.lessonProgress.count({ where: { enrollmentId } }),
    ]);
    if (lessonCount === 0 || progressCount < lessonCount) {
        return { completed: false, justCompleted: false };
    }

    const now = new Date();
    // First-completion gate: only one concurrent caller wins this update.
    const updated = await prisma.enrollment.updateMany({
        where: { id: enrollmentId, completedAt: null },
        data: { completedAt: now },
    });
    if (updated.count === 0) return { completed: true, justCompleted: false };

    const isAuthor = enrollment.userId === enrollment.course.authorId;
    if (!isAuthor) {
        await awardCompletion(enrollment.userId, enrollment.course, enrollmentId, now);
    }

    return { completed: true, justCompleted: true };
}

async function awardCompletion(
    userId: string,
    course: { id: string; title: string },
    enrollmentId: string,
    completedAt: Date
): Promise<void> {
    // Points — deterministic synthetic event id makes the
    // (nostrEventId, userId, reason) unique constraint absorb replays.
    try {
        await applyPoints(userId, {
            nostrEventId: `course:${course.id}`,
            kind: null,
            reason: 'COURSE_COMPLETED',
            points: POINTS_COURSE_COMPLETED,
            month: monthOf(completedAt),
            eventCreatedAt: completedAt,
        });
    } catch (error) {
        console.error('[Courses] Completion points failed:', error);
    }

    // Certificate badge — platform-issued NIP-58 award (never author-signed).
    try {
        let badge;
        try {
            badge = await prisma.userBadge.create({
                data: { userId, badgeId: `course-${course.id}`, month: '' },
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
        if (badge) {
            const awardEventId = await publishBadgeAward(badge);
            if (awardEventId) {
                await prisma.enrollment.update({
                    where: { id: enrollmentId },
                    data: { certificateEventId: awardEventId },
                });
            }
        }
    } catch (error) {
        console.error('[Courses] Certificate badge failed:', error);
    }

    createNotification({
        userId,
        type: 'SYSTEM',
        title: 'Course complete!',
        body: `You completed "${course.title}". Your certificate is available on your profile.`,
        data: { courseId: course.id },
    }).catch(() => {});
}
