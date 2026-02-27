import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listArticles, getArticle, createArticle, createArticleSchema,
    updateArticle, updateArticleSchema,
    listVideos, createVideo, createVideoSchema,
    listResources, downloadResource, createResource, createResourceSchema,
} from '../controllers/content.controller';

const router = Router();

// Public article routes
router.get('/articles', listArticles);
router.get('/articles/:id', getArticle);

// Public video routes
router.get('/videos', listVideos);

// Public legal resource routes
router.get('/resources', listResources);
router.get('/resources/:id/download', downloadResource);

// Admin CRUD
router.post('/articles', authenticate, requireRole('ADMIN'), validate(createArticleSchema), createArticle);
router.put('/articles/:id', authenticate, requireRole('ADMIN'), validate(updateArticleSchema), updateArticle);
router.post('/videos', authenticate, requireRole('ADMIN'), validate(createVideoSchema), createVideo);
router.post('/resources', authenticate, requireRole('ADMIN'), validate(createResourceSchema), createResource);

export default router;
