import { Request, Response } from 'express';
import { PrismaClient, AccessLevel, DocumentType, Department, Role } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { AuditService } from '../services/audit.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Upload a document to a staff member's dossier
export const uploadDocument = async (req: AuthRequest, res: Response) => {
    try {
        const uploaderId = req.user?.id;
        const uploaderRole = req.user?.role;
        const { staffId, title, type, accessLevel } = req.body;
        const file = req.file;

        if (!uploaderId || !file) return res.status(400).json({ message: 'Missing file or authentication' });

        // 1. Permission Check
        // Only Admin, Registry Staff, or Center Manager (for their own staff) can upload.
        // Simplified check here, strict check requires fetching staff profile vs uploader center.

        // Find Uploader Profile
        const uploaderProfile = await prisma.staffProfile.findUnique({ where: { userId: uploaderId } });
        // Find Target Staff Profile
        const targetProfile = await prisma.staffProfile.findUnique({ where: { id: staffId } });

        if (!targetProfile) return res.status(404).json({ message: 'Target staff profile not found' });

        if (uploaderRole === Role.STUDY_CENTER_MANAGER) {
            if (targetProfile.centerId !== uploaderProfile?.centerId) {
                return res.status(403).json({ message: 'Unauthorized: Cannot upload for staff in another center' });
            }
        }
        // Registry Logic: Ideally check if uploader.department starts with REGISTRY

        // 2. Upload File
        const url = await StorageService.uploadFile(file);

        // 3. Create Database Record
        const doc = await prisma.document.create({
            data: {
                title,
                type: type as DocumentType,
                url,
                ownerId: staffId,
                uploadedById: uploaderProfile!.id, // Assuming profile exists if auth user
                accessLevel: accessLevel as AccessLevel || AccessLevel.CONFIDENTIAL,
                currentLocation: Department.REGISTRY_MAIN // Default to HQ Registry
            }
        });

        // 4. Audit Log
        await AuditService.log(uploaderId, AuditService.ACTIONS.CREATE, 'DOCUMENT', `Uploaded ${type}: ${title} for staff ${staffId}`);

        res.status(201).json(doc);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// List documents for a staff member (Dossier View)
export const getStaffDossier = async (req: AuthRequest, res: Response) => {
    try {
        const viewerId = req.user?.id;
        const viewerRole = req.user?.role;
        const { staffId } = req.params;

        if (!viewerId) return res.status(401).json({ message: 'Unauthorized' });

        // Permission Logic
        const viewerProfile = await prisma.staffProfile.findUnique({ where: { userId: viewerId } });
        const targetProfile = await prisma.staffProfile.findUnique({ where: { id: staffId } });

        if (!targetProfile) return res.status(404).json({ message: 'Staff profile not found' });

        // Rule: Center Manager only sees own staff
        if (viewerRole === Role.STUDY_CENTER_MANAGER) {
            if (targetProfile.centerId !== viewerProfile?.centerId) {
                return res.status(403).json({ message: 'Unauthorized Access to Dossier' });
            }
        }

        // Rule: Staff can see own dossier? (Usually yes)
        if (viewerRole === Role.STAFF && viewerId !== targetProfile.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const docs = await prisma.document.findMany({
            where: { ownerId: staffId },
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { user: { select: { name: true } } } } }
        });

        // Audit View
        await AuditService.log(viewerId, AuditService.ACTIONS.VIEW, 'DOSSIER', `Viewed dossier of staff ${staffId}`);

        res.json(docs);

    } catch (error) {
        console.error('Get Dossier Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Update Document Metadata
export const updateDocument = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, type, accessLevel } = req.body;
        const updaterId = req.user?.id;

        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        await prisma.document.update({
            where: { id },
            data: {
                title: title || doc.title,
                type: type ? (type as DocumentType) : doc.type,
                accessLevel: accessLevel ? (accessLevel as AccessLevel) : doc.accessLevel
            }
        });

        await AuditService.log(updaterId!, AuditService.ACTIONS.UPDATE, 'DOCUMENT', `Updated document metadata: ${id}`);

        res.json({ message: 'Document updated successfully' });
    } catch (error) {
        console.error('Update Document Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Delete Document (Secure)
export const deleteDocument = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const deleterId = req.user?.id;

        // Note: Strict RBAC Role check is already done by middleware in routes.
        // Additional Logic: Ensure doc exists.

        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // Perform Delete
        await prisma.document.delete({ where: { id } });

        // Audit Log
        await AuditService.log(deleterId!, AuditService.ACTIONS.DELETE, 'DOCUMENT', `Deleted document: ${doc.title} (ID: ${id})`);

        res.json({ message: 'Document deleted successfully' });

    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get My Documents (Authenticated User)
export const getMyDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId } });
        if (!staffProfile) return res.json([]);

        const docs = await prisma.document.findMany({
            where: { ownerId: staffProfile.id },
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { user: { select: { name: true } } } } }
        });

        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching documents' });
    }
};
