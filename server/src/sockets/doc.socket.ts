import { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

const prisma = new PrismaClient();

// This map allows us to intercept document updates if we want to save them to the DB.
// By default, y-websocket stores the doc in memory. We can periodically flush it.
const docs = new Map<string, Y.Doc>();

// Helper to authenticate WS upgrades
export const authenticateDocSocket = async (req: IncomingMessage): Promise<boolean> => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const projectId = url.searchParams.get('projectId');
        
        if (!token || !projectId) return false;

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        const staffProfile = await prisma.staffProfile.findUnique({
            where: { userId: decoded.userId }
        });

        if (!staffProfile && decoded.role !== 'SUPER_USER') return false;

        if (decoded.role === 'SUPER_USER') return true;

        const membership = await prisma.projectMember.findUnique({
            where: {
                projectId_staffId: {
                    projectId,
                    staffId: staffProfile!.id
                }
            }
        });

        return !!membership;
    } catch (err) {
        return false;
    }
};

export const setupDocSocket = (conn: WebSocket, req: IncomingMessage) => {
    // Determine the document name (projectId) from the URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    
    if (!projectId) {
        conn.close();
        return;
    }

    // Call the standard y-websocket handler
    // We pass docName as the projectId so all users on this project share the same Y.Doc
    setupWSConnection(conn, req, { docName: projectId });
};
