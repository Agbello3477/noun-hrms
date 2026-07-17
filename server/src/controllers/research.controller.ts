import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';

const prisma = new PrismaClient();

// Multer Config for Safe Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../uploads/')),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proj-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    const allowedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/csv'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDFs, Word docs, images, and CSVs are allowed.'), false);
    }
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// 1. Create a Project
export const createProject = async (req: Request, res: Response) => {
    try {
        const { title, abstract, domain } = req.body;
        const user = (req as any).user;

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile) return res.status(404).json({ message: 'Staff profile not found' });

        const project = await prisma.researchProject.create({
            data: {
                title,
                abstract,
                domain,
                ownerId: staffProfile.id,
                members: {
                    create: {
                        staffId: staffProfile.id,
                        role: 'OWNER'
                    }
                }
            }
        });

        res.status(201).json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 2. Get My Projects
export const getMyProjects = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile && user.role !== 'SUPER_USER') {
             return res.status(200).json([]); // Non-staff maybe
        }

        const projects = await prisma.researchProject.findMany({
            where: user.role === 'SUPER_USER' ? {} : {
                members: {
                    some: { staffId: staffProfile!.id }
                }
            },
            include: {
                owner: true,
                _count: {
                    select: { members: true, documents: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 3. Get Project Details (RBAC checked via middleware or inline)
export const getProjectDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        
        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: {
                owner: true,
                members: {
                    include: { staff: true }
                },
                invites: {
                    include: { invitee: true }
                },
                files: true,
                messages: {
                    take: 50,
                    orderBy: { createdAt: 'asc' },
                    include: { sender: true }
                }
            }
        });

        if (!project) return res.status(404).json({ message: 'Project not found' });

        // RBAC Check
        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) {
                return res.status(403).json({ message: 'Forbidden. You are not a member of this project.' });
            }
        }

        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 4. Send Invite
export const sendInvite = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { inviteeId } = req.body; // user ID of invitee
        const user = (req as any).user;

        const existingInvite = await prisma.projectInvite.findFirst({
            where: { projectId: id, inviteeId, status: 'PENDING' }
        });

        if (existingInvite) return res.status(400).json({ message: 'Invite already sent' });

        const invite = await prisma.projectInvite.create({
            data: {
                projectId: id,
                inviterId: user.id,
                inviteeId
            }
        });

        res.json({ message: 'Invite sent', invite });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 5. Accept Invite
export const acceptInvite = async (req: Request, res: Response) => {
    try {
        const { inviteId } = req.params;
        const user = (req as any).user;

        const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
        if (!invite || invite.inviteeId !== user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile) return res.status(404).json({ message: 'Staff profile required' });

        await prisma.$transaction([
            prisma.projectInvite.update({
                where: { id: inviteId },
                data: { status: 'ACCEPTED' }
            }),
            prisma.projectMember.create({
                data: {
                    projectId: invite.projectId,
                    staffId: staffProfile.id,
                    role: 'EDITOR'
                }
            })
        ]);

        res.json({ message: 'Invite accepted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 6. Upload File to Shared Drive
export const uploadFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const file = req.file;

        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile) return res.status(403).json({ message: 'Forbidden' });

        // RBAC
        const isMember = await prisma.projectMember.findUnique({
            where: { projectId_staffId: { projectId: id, staffId: staffProfile.id } }
        });

        if (!isMember && user.role !== 'SUPER_USER') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const projectFile = await prisma.uploadedProjectFile.create({
            data: {
                projectId: id,
                uploaderId: staffProfile.id,
                fileName: file.originalname,
                fileUrl: `/uploads/${file.filename}`,
                mimeType: file.mimetype
            }
        });

        res.json(projectFile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
