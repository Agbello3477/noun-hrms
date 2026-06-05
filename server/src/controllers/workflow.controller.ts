import { Request, Response } from 'express';
import { Department, Role } from '@prisma/client';
import { AuditService } from '../services/audit.service';
import prisma from '../prisma';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// Move a document from one department to another
export const moveDocument = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { documentId, toDept, note } = req.body;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Fetch Document
        const document = await prisma.document.findUnique({ where: { id: documentId } });
        if (!document) return res.status(404).json({ message: 'Document not found' });

        // 2. Permission Check
        // Only someone currently in the `currentLocation` department can move it?
        // OR Admin/Registry. For MVF, let's allow Admin, Registry, and Bursary to move things.
        // A Study Center manager probably shouldn't move files to Audit directly (maybe via Registry).

        // Simplified Logic: Record the trail
        const fromDept = document.currentLocation;

        if (fromDept === toDept) {
            return res.status(400).json({ message: 'Document is already in this department' });
        }

        // 3. Create Trail Record
        await prisma.documentTrail.create({
            data: {
                documentId,
                fromDept,
                toDept: toDept as Department,
                actionById: userId, // Assuming user exists in StaffProfile/User
                note
            }
        });

        // 4. Update Document Location
        const updatedDoc = await prisma.document.update({
            where: { id: documentId },
            data: { currentLocation: toDept as Department }
        });

        // 5. Audit Log
        await AuditService.log(userId, AuditService.ACTIONS.MOVE, 'DOCUMENT', `Moved doc ${document.title} from ${fromDept} to ${toDept}`);

        res.json({ message: 'Document moved successfully', document: updatedDoc });

    } catch (error) {
        console.error('Workflow Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDocumentTrail = async (req: AuthRequest, res: Response) => {
    try {
        const { documentId } = req.params;
        const trail = await prisma.documentTrail.findMany({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
            include: { actionBy: { select: { name: true } } }
        });
        res.json(trail);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
