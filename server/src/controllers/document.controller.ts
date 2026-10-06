import { Request, Response } from 'express';
import { AccessLevel, DocumentType, LegacyDepartment, Role, RequestStatus } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { AuditService } from '../services/audit.service';
import prisma from '../prisma';

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

        // Find Uploader Profile
        const uploaderProfile = await prisma.staffProfile.findUnique({ where: { userId: uploaderId } });

        // Fallback target staff ID to the uploader's own staff profile if not provided
        let targetStaffId = staffId;
        if (!targetStaffId && uploaderProfile) {
            targetStaffId = uploaderProfile.id;
        }

        if (!targetStaffId) {
            return res.status(400).json({ message: 'Staff profile identifier is missing' });
        }

        // Find Target Staff Profile
        let targetProfile = await prisma.staffProfile.findUnique({ where: { id: targetStaffId } });
        if (!targetProfile) {
            targetProfile = await prisma.staffProfile.findFirst({
                where: {
                    OR: [
                        { staffId: targetStaffId },
                        { userId: targetStaffId }
                    ]
                }
            });
        }

        if (!targetProfile) return res.status(404).json({ message: 'Target staff profile not found' });
        targetStaffId = targetProfile.id;

        // 1. Permission Check
        if (uploaderId !== targetProfile.userId) {
            const isManagerOrAdmin = [
                Role.HR_ADMIN,
                Role.REGISTRY_ADMIN,
                Role.REGISTRAR,
                Role.SUPER_USER,
                Role.ADMIN,
                Role.STUDY_CENTER_MANAGER,
                Role.UNIT_HEAD,
                Role.UNIT_ADMIN,
                Role.VICE_CHANCELLOR
            ].includes(uploaderRole as any);

            if (!isManagerOrAdmin) {
                return res.status(403).json({ message: 'Unauthorized: You can only upload files to your own dossier' });
            }

            if (uploaderRole === Role.STUDY_CENTER_MANAGER) {
                if (targetProfile.centerId !== uploaderProfile?.centerId) {
                    return res.status(403).json({ message: 'Unauthorized: Cannot upload for staff in another center' });
                }
            } else if ([Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(uploaderRole as any)) {
                if (targetProfile.unitId !== uploaderProfile?.unitId) {
                    return res.status(403).json({ message: 'Unauthorized: Cannot upload for staff in another unit' });
                }
            }
        }

        // 2. Upload File
        const url = await StorageService.uploadFile(file);

        // 3. Create Database Record
        const doc = await prisma.document.create({
            data: {
                title,
                type: type as DocumentType,
                url,
                ownerId: targetStaffId,
                uploadedById: uploaderProfile ? uploaderProfile.id : targetStaffId, // Fallback to staff's own profile if Admin lacks one
                accessLevel: accessLevel as AccessLevel || AccessLevel.CONFIDENTIAL,
                currentLocation: LegacyDepartment.REGISTRY_MAIN // Default to HQ Registry
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

        let isAuthorized = false;

        // 1. HR registry users, supers, standard admins, and the Vice Chancellor can view all dossiers
        if ([Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(viewerRole as any)) {
            isAuthorized = true;
        }

        // 2. Any user can see their own dossier
        if (viewerId === targetProfile.userId) {
            isAuthorized = true;
        }

        // 3. Manager roles (UNIT_HEAD, STUDY_CENTER_MANAGER, UNIT_ADMIN, BURSARY, AUDIT, etc.)
        if (
            !isAuthorized &&
            [Role.STUDY_CENTER_MANAGER, Role.UNIT_HEAD, Role.UNIT_ADMIN, Role.BURSARY, Role.AUDIT].includes(viewerRole as any)
        ) {
            // Check if they have an active approved file request for this staff dossier
            const hasApprovedRequest = await prisma.fileRequest.findFirst({
                where: {
                    requesterId: viewerId,
                    staffId: targetProfile.id,
                    status: RequestStatus.APPROVED
                }
            });

            if (hasApprovedRequest) {
                isAuthorized = true;
            } else {
                // Otherwise check their unit/center boundaries
                const currentUnitId = viewerProfile?.unitId;
                const currentCenterId = viewerProfile?.centerId;

                const isCurrentStaff = (targetProfile.centerId && targetProfile.centerId === currentCenterId) ||
                                       (targetProfile.unitId && targetProfile.unitId === currentUnitId);

                if (isCurrentStaff) {
                    isAuthorized = true;
                } else {
                    const managerPlacements = [
                        ...(currentUnitId ? [currentUnitId] : []),
                        ...(currentCenterId ? [currentCenterId] : [])
                    ];

                    if (managerPlacements.length > 0) {
                        const wasTransferredFromHere = await prisma.transferLog.findFirst({
                            where: {
                                staffId: targetProfile.userId,
                                oldCenterId: {
                                    in: managerPlacements
                                }
                            }
                        });

                        if (wasTransferredFromHere) {
                            isAuthorized = true;
                        }
                    }
                }
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Unauthorized Access to Dossier' });
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

/**
 * Batch upload multiple documents to staff dossiers
 * POST /api/registry/batch-upload
 */
export const batchUploadDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const uploaderId = req.user?.id;
        const uploaderRole = req.user?.role;
        const files = req.files as Express.Multer.File[];

        if (!uploaderId || !files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded or missing authentication' });
        }

        const isManagerOrAdmin = [
            Role.HR_ADMIN,
            Role.REGISTRY_ADMIN,
            Role.REGISTRAR,
            Role.SUPER_USER,
            Role.ADMIN,
            Role.STUDY_CENTER_MANAGER,
            Role.UNIT_HEAD,
            Role.UNIT_ADMIN,
            Role.VICE_CHANCELLOR
        ].includes(uploaderRole as any);

        if (!isManagerOrAdmin) {
            return res.status(403).json({ message: 'Unauthorized: Only HR/Registry administrators or managers can perform batch dossier uploads' });
        }

        const uploaderProfile = await prisma.staffProfile.findUnique({ where: { userId: uploaderId } });

        // Parse metadata: either sent as a JSON array string in req.body.metadata, or per-file items
        let metadataList: Array<{ staffId: string; title?: string; type?: string; accessLevel?: string }> = [];
        if (req.body.metadata) {
            try {
                metadataList = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
            } catch (err) {
                console.warn('Failed to parse metadata JSON, using defaults');
            }
        }

        const defaultStaffId = req.body.staffId;
        const defaultType = req.body.type || 'OTHER';
        const defaultAccessLevel = req.body.accessLevel || 'CONFIDENTIAL';

        const results: any[] = [];
        const errors: any[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const meta = metadataList[i] || {};
            let targetStaffId = meta.staffId || defaultStaffId;

            // If still no staffId, try to extract staffId from filename (e.g. "00001_Appointment.pdf" or "NOUN_2026_001_CV.pdf")
            if (!targetStaffId) {
                const match = file.originalname.match(/^([A-Za-z0-9_\/-]+)[_-\s]/);
                if (match) {
                    const candidateId = match[1].replace(/_/g, '/');
                    const profile = await prisma.staffProfile.findFirst({
                        where: {
                            OR: [
                                { staffId: candidateId },
                                { staffId: match[1] },
                                { id: match[1] }
                            ]
                        }
                    });
                    if (profile) targetStaffId = profile.id;
                }
            }

            if (!targetStaffId) {
                errors.push({ filename: file.originalname, error: 'Could not determine target staff profile' });
                continue;
            }

            let targetProfile = await prisma.staffProfile.findUnique({
                where: { id: targetStaffId },
                include: { user: true }
            });

            if (!targetProfile) {
                targetProfile = await prisma.staffProfile.findFirst({
                    where: {
                        OR: [
                            { staffId: targetStaffId },
                            { userId: targetStaffId }
                        ]
                    },
                    include: { user: true }
                });
            }

            if (!targetProfile) {
                errors.push({ filename: file.originalname, staffId: targetStaffId, error: 'Staff profile not found' });
                continue;
            }

            try {
                const url = await StorageService.uploadFile(file);
                const title = meta.title || file.originalname.substring(0, file.originalname.lastIndexOf('.')) || file.originalname;
                const type = (meta.type || defaultType) as DocumentType;
                const accessLevel = (meta.accessLevel || defaultAccessLevel) as AccessLevel;

                const doc = await prisma.document.create({
                    data: {
                        title,
                        type,
                        url,
                        ownerId: targetProfile.id,
                        uploadedById: uploaderProfile ? uploaderProfile.id : targetProfile.id,
                        accessLevel,
                        currentLocation: LegacyDepartment.REGISTRY_MAIN
                    }
                });

                results.push({
                    documentId: doc.id,
                    filename: file.originalname,
                    title,
                    type,
                    staffId: targetProfile.staffId,
                    staffName: `${targetProfile.surname} ${targetProfile.otherNames}`
                });
            } catch (uploadErr: any) {
                errors.push({ filename: file.originalname, error: uploadErr.message });
            }
        }

        await AuditService.log(
            uploaderId,
            AuditService.ACTIONS.CREATE,
            'DOCUMENT_BATCH',
            `Batch uploaded ${results.length} dossier documents (${errors.length} failed)`
        );

        res.status(200).json({
            message: `Batch dossier upload completed: ${results.length} succeeded, ${errors.length} failed`,
            successfulCount: results.length,
            failedCount: errors.length,
            results,
            errors
        });
    } catch (error: any) {
        console.error('Batch Upload Error:', error);
        res.status(500).json({ message: 'Internal Server Error during batch upload', error: error.message });
    }
};
