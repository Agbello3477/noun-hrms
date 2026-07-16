import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { 
    createProject, 
    getMyProjects, 
    getProjectDetails, 
    sendInvite, 
    acceptInvite, 
    uploadFile,
    upload
} from '../controllers/research.controller';

const router = Router();

router.use(verifyToken as any);

// Projects
router.post('/', createProject);
router.get('/', getMyProjects);
router.get('/:id', getProjectDetails);

// Invites
router.post('/:id/invite', sendInvite);
router.post('/invite/:inviteId/accept', acceptInvite);

// Files
router.post('/:id/files', upload.single('file'), uploadFile);

export default router;
