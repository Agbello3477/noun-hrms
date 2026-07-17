import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

                if (!staffProfile) {
                    socket.emit('error', 'Staff profile not found');
                    return;
                }

                const membership = await prisma.projectMember.findUnique({
                    where: {
                        projectId_staffId: {
                            projectId,
                            staffId: staffProfile.id
                        }
                    }
                });

                if (membership || user.role === 'SUPER_USER') {
                    socket.join(`project_${projectId}`);
                    console.log(`[Chat Socket] User ${user.id} joined project_${projectId}`);
                    socket.emit('joined', projectId);
                } else {
                    socket.emit('error', 'Unauthorized to join this project');
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

        socket.on('disconnect', () => {
            console.log(`[Chat Socket] User disconnected: ${socket.id}`);
        });
    });
};
