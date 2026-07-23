import { Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';

/**
 * Generates a secure, cryptographically hashed WebRTC room token and room ID
 * for authenticated users entering video calls after strict RBAC verification.
 */
export const generateMeetingToken = async (req: any, res: Response) => {
    try {
        const { module, targetId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!module || !targetId) {
            return res.status(400).json({ message: 'Module and Target ID are required' });
        }

        const isSuperAdmin = ['SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(userRole);

        // ─── RBAC & Workspace Authorization Check ─────────────────────────────────
        let isAuthorized = false;

        if (module === 'research') {
            if (isSuperAdmin) {
                isAuthorized = true;
            } else {
                // Verify user is owner or active member of the research project
                const project = await prisma.researchProject.findUnique({
                    where: { id: targetId },
                    include: { members: true }
                });

                if (project) {
                    const isOwner = project.ownerId === userId;
                    const isMember = project.members.some(m => m.staffId === req.user?.staffProfileId || m.staffId === userId);
                    isAuthorized = isOwner || isMember;
                }
            }
        } else if (module === 'promotion') {
            // Only HR Admins, VC, Super Users, and Admins can launch promotion interview rooms
            isAuthorized = ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'].includes(userRole);
        } else if (module === 'security') {
            // Security Officers, Security Head, VC, and Admins
            isAuthorized = ['SECURITY_HEAD', 'SECURITY_OFFICER', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'].includes(userRole);
        } else if (module === 'telemedicine') {
            // Medical Doctors, Nurses, Clinic Head, and Admins
            isAuthorized = ['CLINIC_HEAD', 'CLINIC_DOCTOR', 'CLINIC_NURSE', 'CLINIC_LAB_SCIENTIST', 'CLINIC_PHARMACIST', 'SUPER_USER', 'ADMIN'].includes(userRole);
        }

        if (!isAuthorized) {
            return res.status(403).json({
                message: `Access denied: You do not have authorization to create or join a video room for ${module}.`,
                code: 'RBAC_PERMISSION_DENIED'
            });
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Create a deterministic cryptographic hash for the room to prevent link guessing
        const secretKey = process.env.JWT_SECRET || 'noun-hrms-meeting-secret-key-2026';
        const roomHash = crypto
            .createHmac('sha256', secretKey)
            .update(`${module}:${targetId}`)
            .digest('hex')
            .slice(0, 16);

        const roomName = `noun-${module}-${targetId}-${roomHash}`;

        return res.json({
            roomName,
            module,
            targetId,
            userName: req.user?.email ? req.user.email.split('@')[0] : 'User',
            userRole,
            tokenIssuedAt: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Error generating meeting token:', error);
        return res.status(500).json({ message: 'Failed to generate meeting token' });
    }
};
