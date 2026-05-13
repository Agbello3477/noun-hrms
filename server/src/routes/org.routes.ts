
import { Router } from 'express';
import { getOrganizationStructure, getProgrammes } from '../controllers/org.controller';

const router = Router();

router.get('/structure', getOrganizationStructure);
router.get('/programmes', getProgrammes);

export default router;
