import { Router } from 'express';
import { validate } from '../middleware/validate';
import { submitContact, contactSchema } from '../controllers/contact.controller';

const router = Router();

router.post('/', validate(contactSchema), submitContact);

export default router;
