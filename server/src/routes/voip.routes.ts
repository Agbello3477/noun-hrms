import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { getVoipDirectory, lookupExtension, getIceServers, getMyExtension } from '../controllers/voip.controller';

const router = Router();

router.use(verifyToken);

router.get('/my-extension', getMyExtension);
router.get('/directory', getVoipDirectory);
router.get('/lookup/:extension', lookupExtension);
router.get('/ice-servers', getIceServers);

export default router;
