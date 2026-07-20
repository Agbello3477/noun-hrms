import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { 
    createProject, 
    getMyProjects, 
    getProjectDetails, 
    sendInvite, 
    acceptInvite,
    declineInvite,
    getMyInvites,
    uploadFile,
    upload,
    getDocument,
    saveDocument
} from '../controllers/research.controller';

const router = Router();

router.use(verifyToken as any);

// Invites (Registered BEFORE /:id to prevent route shadowing)
router.get('/invites/mine', getMyInvites);
router.post('/invite/:inviteId/accept', acceptInvite);
router.post('/invite/:inviteId/decline', declineInvite);

// Projects
router.post('/', createProject);
router.get('/', getMyProjects);
router.get('/:id', getProjectDetails);
router.post('/:id/invite', sendInvite);

// Files
router.post('/:id/files', upload.single('file'), uploadFile);

// Document (rich-text editor content via REST)
router.get('/:id/document', getDocument);
router.put('/:id/document', saveDocument);

export default router;
