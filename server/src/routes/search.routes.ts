import { Router } from 'express';
import { search, getSuggestions } from '../controllers/search.controller';

const router = Router();

router.get('/', search);
router.get('/suggestions', getSuggestions);

export default router;
