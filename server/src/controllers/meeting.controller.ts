import { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Generates a secure, cryptographically hashed WebRTC room token and room ID
 * for authenticated users entering video calls.
 */
export const generateMeetingToken = async (req: any, res: Response) => {
    try {
        const { module, targetId } = req.body;
        const userId = req.user?.id || 'anonymous';
        const userRole = req.user?.role || 'GUEST';

        if (!module || !targetId) {
            return res.status(400).json({ message: 'Module and Target ID are required' });
        }

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
