import { Router } from 'express';
import { getFaculties, getCadres, getProgrammesCatalog } from '../controllers/meta.controller';
import { cacheMiddleware } from '../middleware/cacheMiddleware';

const router = Router();

// Public shared catalog endpoints with Layer 2 caching and Edge Cache-Control headers
router.get('/faculties', cacheMiddleware(3600, { isPublic: true, tags: ['tag:meta_faculties'] }), getFaculties);
router.get('/cadres', cacheMiddleware(3600, { isPublic: true, tags: ['tag:meta_cadres'] }), getCadres);
router.get('/programmes', cacheMiddleware(3600, { isPublic: true, tags: ['tag:meta_programmes'] }), getProgrammesCatalog);

export default router;
