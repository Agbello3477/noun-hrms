
import { Router } from 'express';
import { getOrganizationStructure, getProgrammes } from '../controllers/org.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();

router.get('/structure', cacheMiddleware(60), getOrganizationStructure);
router.get('/programmes', cacheMiddleware(60), getProgrammes);

export default router;
