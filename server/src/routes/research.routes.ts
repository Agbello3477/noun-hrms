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
    exportDocument,
    getGrants,
    createGrant,
    updateGrant,
    getIpRegistry,
    createIpRecord,
    updateIpRecord,
    getResearchImpactReport
} from '../controllers/research.controller';

const router = Router();

router.use(verifyToken as any);

// Reports & Aggregations (Registered BEFORE /:id to prevent route shadowing)
router.get('/reports/impact', getResearchImpactReport);

// Invites & Peers (Registered BEFORE /:id to prevent route shadowing)
router.get('/invites/mine', getMyInvites);
router.get('/peers', getAcademicPeers);
router.post('/invite/:inviteId/accept', acceptInvite);
router.post('/invite/:inviteId/decline', declineInvite);
router.delete('/invite/:inviteId', cancelInvite);

// Projects
router.post('/', createProject);
router.get('/', getMyProjects);

// Project specific Grants & IP sub-routes
router.get('/:id/grants', getGrants);
router.post('/:id/grants', createGrant);
router.put('/:id/grants/:grantId', updateGrant);

router.get('/:id/ip', getIpRegistry);
router.post('/:id/ip', createIpRecord);
router.put('/:id/ip/:ipId', updateIpRecord);

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
