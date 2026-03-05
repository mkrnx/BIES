import { Router } from 'express';
import { nostrJson } from '../controllers/nip05.controller';

const router = Router();

router.get('/nostr.json', nostrJson);

export default router;
