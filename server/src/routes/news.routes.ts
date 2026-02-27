import { Router } from 'express';
import { getNewsStories, getBiesUpdates } from '../controllers/news.controller';

const router = Router();

router.get('/stories', getNewsStories);
router.get('/bies-updates', getBiesUpdates);

export default router;
