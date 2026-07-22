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
    getAcademicPeers,
    uploadFile,
    upload,
    getDocument,
    saveDocument,
    updateProject,
    updateProjectStatus,
    deleteProject,
    removeMember,
    cancelInvite,
    exportDocument
} from '../controllers/research.controller';

const router = Router();

router.use(verifyToken as any);

// Invites & Peers (Registered BEFORE /:id to prevent route shadowing)
router.get('/invites/mine', getMyInvites);
router.get('/peers', getAcademicPeers);
router.post('/invite/:inviteId/accept', acceptInvite);
router.post('/invite/:inviteId/decline', declineInvite);
router.delete('/invite/:inviteId', cancelInvite);

// Projects
router.post('/', createProject);
router.get('/', getMyProjects);
router.get('/:id', getProjectDetails);
router.put('/:id', updateProject);
router.put('/:id/status', updateProjectStatus);
router.delete('/:id', deleteProject);
router.post('/:id/invite', sendInvite);
router.delete('/:id/member/:memberId', removeMember);

// Files
router.post('/:id/files', upload.single('file'), uploadFile);

// Document (rich-text editor content via REST)
router.get('/:id/document', getDocument);
router.put('/:id/document', saveDocument);
router.get('/:id/export', exportDocument);

export default router;
