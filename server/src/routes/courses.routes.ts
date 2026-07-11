import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listCourses,
    listMyCourses,
    listEnrolledCourses,
    getCourse,
    getCourseOG,
    createCourse,
    createCourseSchema,
    updateCourse,
    updateCourseSchema,
    deleteCourse,
    submitCourse,
    setNostrRefs,
    nostrRefsSchema,
    createLesson,
    createLessonSchema,
    updateLesson,
    updateLessonSchema,
    reorderLessons,
    reorderLessonsSchema,
    deleteLesson,
    getLesson,
    enrollCourse,
    unenrollCourse,
    getProgress,
    upsertProgress,
    progressSchema,
    submitQuiz,
    quizSubmitSchema,
    getPurchaseStatus,
    claimPurchase,
} from '../controllers/courses.controller';

const router = Router();

// Authoring: 20 creations / hour per IP (moderation-queue flood protection)
const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Course creation limit reached, please try again later' },
});

// Quiz submissions: 30 / 10 min per IP (MCQ brute-force resistance —
// per-(user,quiz) attempt caps are enforced in the controller too)
const quizLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { error: 'Too many quiz submissions, please slow down' },
});

// Purchase claims trigger live relay queries — keep the polling sane
const claimLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 40,
    message: { error: 'Too many claim attempts, please wait a moment' },
});

// Public catalog
router.get('/', optionalAuth, listCourses);

// Protected lists (must come before /:id to avoid shadowing)
router.get('/my', authenticate, listMyCourses);
router.get('/enrolled', authenticate, listEnrolledCourses);

// Public single course
router.get('/:id/og', getCourseOG);
router.get('/:id', optionalAuth, getCourse);

// Authoring
router.post('/', authenticate, createLimiter, validate(createCourseSchema), createCourse);
router.put('/:id', authenticate, validate(updateCourseSchema), updateCourse);
router.delete('/:id', authenticate, deleteCourse);
router.post('/:id/submit', authenticate, submitCourse);
router.post('/:id/nostr-refs', authenticate, validate(nostrRefsSchema), setNostrRefs);

// Lessons (reorder before /:lessonId param routes)
router.put('/:id/lessons/reorder', authenticate, validate(reorderLessonsSchema), reorderLessons);
router.post('/:id/lessons', authenticate, createLimiter, validate(createLessonSchema), createLesson);
router.get('/:id/lessons/:lessonId', optionalAuth, getLesson);
router.put('/:id/lessons/:lessonId', authenticate, validate(updateLessonSchema), updateLesson);
router.delete('/:id/lessons/:lessonId', authenticate, deleteLesson);

// Learning
router.post('/:id/enroll', authenticate, enrollCourse);
router.delete('/:id/enroll', authenticate, unenrollCourse);
router.get('/:id/progress', authenticate, getProgress);
router.put('/:id/lessons/:lessonId/progress', authenticate, validate(progressSchema), upsertProgress);
router.post('/:id/lessons/:lessonId/quiz', authenticate, quizLimiter, validate(quizSubmitSchema), submitQuiz);

// Purchase
router.get('/:id/purchase', authenticate, getPurchaseStatus);
router.post('/:id/purchase/claim', authenticate, claimLimiter, claimPurchase);

export default router;
