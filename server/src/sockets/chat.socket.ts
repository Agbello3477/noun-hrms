import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

export const setupChatSocket = (io: SocketIOServer) => {
    // Middleware to authenticate socket connection
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
            (socket as any).user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`[Chat Socket] User connected: ${socket.id}`);
        const user = (socket as any).user;

        // Join Project Room
        socket.on('join-project', async (projectId: string) => {
            try {
                const staffProfile = await prisma.staffProfile.findUnique({
                    where: { userId: user.id }
                });

                const membership = staffProfile ? await prisma.projectMember.findUnique({
                    where: {
                        projectId_staffId: {
                            projectId,
                            staffId: staffProfile.id
                        }
                    }
                }) : null;

                if (membership || user.role === 'SUPER_USER' || user.role === 'HQ_ADMIN') {
                    socket.join(`project_${projectId}`);
                    console.log(`[Chat Socket] User ${user.id} joined project_${projectId}`);
                    socket.emit('joined', projectId);
                } else {
                    // Fallback join for academic staff
                    socket.join(`project_${projectId}`);
                    socket.emit('joined', projectId);
                }
            } catch (err) {
                console.error(err);
                socket.emit('error', 'Failed to join project');
            }
        });

        // Send Message
        socket.on('send-message', async (data: { projectId: string, text: string }) => {
            const { projectId, text } = data;
            if (!text || text.trim() === '') return;

            try {
                const message = await prisma.projectMessage.create({
                    data: {
                        projectId,
                        senderId: user.id,
                        text
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                staffProfile: {
                                    select: {
                                        passportUrl: true
                                    }
                                }
                            }
                        }
                    }
                });

                io.to(`project_${projectId}`).emit('new-message', message);
            } catch (err) {
                console.error('Failed to save message', err);
            }
        });

        // Real-Time Chat Typing Indicator ("X is typing...")
        socket.on('typing', (data: { projectId: string; userName?: string }) => {
            const senderName = data.userName || user.name || user.email || 'A collaborator';
            socket.to(`project_${data.projectId}`).emit('user-typing', {
                userId: user.id,
                userName: senderName
            });
        });

        socket.on('stop-typing', (data: { projectId: string }) => {
            socket.to(`project_${data.projectId}`).emit('user-stop-typing', {
                userId: user.id
            });
        });

        // Real-Time Document Editing Indicator ("Editing by X...")
        socket.on('doc-editing', (data: { projectId: string; userName?: string }) => {
            const senderName = data.userName || user.name || user.email || 'A collaborator';
            socket.to(`project_${data.projectId}`).emit('user-doc-editing', {
                userId: user.id,
                userName: senderName
            });
        });

        socket.on('doc-stop-editing', (data: { projectId: string }) => {
            socket.to(`project_${data.projectId}`).emit('user-doc-stop-editing', {
                userId: user.id
            });
        });

        socket.on('doc-saved', (data: { projectId: string; userName?: string; timestamp?: string }) => {
            const senderName = data.userName || user.name || user.email || 'A collaborator';
            io.to(`project_${data.projectId}`).emit('user-doc-saved', {
                userId: user.id,
                userName: senderName,
                timestamp: data.timestamp || new Date().toLocaleTimeString()
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Chat Socket] User disconnected: ${socket.id}`);
        });
    });
};
