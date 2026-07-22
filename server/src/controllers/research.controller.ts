import { Request, Response } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import path from 'path';
import { sendEmail } from '../services/email.service';
import { notifyUser } from './notification.controller';
import { generatePDF, generateDOCX, generateLaTeX } from '../utils/documentExporter';

// Multer Config for Safe Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
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
        if (!staffProfile && user.role !== 'SUPER_USER' && user.role !== 'VICE_CHANCELLOR') {
             return res.status(200).json([]); // Non-staff maybe
        }

        const projects = await prisma.researchProject.findMany({
            where: (user.role === 'SUPER_USER' || user.role === 'VICE_CHANCELLOR') ? {} : {
                members: {
                    some: { staffId: staffProfile!.id }
                }
            },
            include: {
                owner: true,
                members: {
                    include: {
                        staff: {
                            include: {
                                user: true
                            }
                        }
                    }
                },
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
        if (user.role !== 'SUPER_USER' && user.role !== 'VICE_CHANCELLOR' && staffProfile) {
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
        const { inviteeId } = req.body;
        const user = (req as any).user;

        if (!inviteeId) return res.status(400).json({ message: 'Invitee ID is required' });

        // Resolve target user & staffProfile by user ID, staffProfile ID, or email
        let targetUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: inviteeId },
                    { email: inviteeId },
                    { staffProfile: { id: inviteeId } }
                ]
            },
            include: { staffProfile: true }
        });

        if (!targetUser) return res.status(404).json({ message: 'Academic peer not found' });

        const resolvedUserId = targetUser.id;
        const resolvedStaffId = targetUser.staffProfile?.id;

        // Check if already a member of the project
        if (resolvedStaffId) {
            const isMember = await prisma.projectMember.findFirst({
                where: { projectId: id, staffId: resolvedStaffId }
            });
            if (isMember) return res.status(400).json({ message: 'Peer is already a collaborator on this project' });
        }

        // Check if pending invite already exists
        const existingInvite = await prisma.projectInvite.findFirst({
            where: {
                projectId: id,
                status: 'PENDING',
                OR: [
                    { inviteeId: resolvedUserId },
                    ...(resolvedStaffId ? [{ inviteeId: resolvedStaffId }] : [])
                ]
            }
        });

        if (existingInvite) return res.status(400).json({ message: 'Invite already sent to this peer' });

        const invite = await prisma.projectInvite.create({
            data: {
                projectId: id,
                inviterId: user.id,
                inviteeId: resolvedUserId
            }
        });

        // ── Send Email Notification to Invitee ────────────────────────────────
        try {
            const project = await prisma.researchProject.findUnique({
                where: { id },
                select: { title: true }
            });

            if (targetUser.email && project) {
                const inviteeName = targetUser.staffProfile
                    ? `${targetUser.staffProfile.surname} ${targetUser.staffProfile.otherNames}`.trim()
                    : targetUser.email;
                const portalUrl = `${process.env.CLIENT_URL || 'https://nounhrms.web.app'}/dashboard/research`;

                const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
  .header { background: #006533; padding: 24px 32px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
  .body { padding: 32px; }
  .badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; border: 1px solid #a7f3d0; }
  .project-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; font-weight: bold; margin: 16px 0; color: #0f172a; }
  .cta-btn { display: inline-block; margin: 20px 0; background: #006533; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; }
  .footer { background: #f5f5f5; padding: 16px 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; }
  p { margin: 0 0 14px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 National Open University of Nigeria</h1>
      <p>Human Resource Management System — Research Forum</p>
    </div>
    <div class="body">
      <span class="badge">📨 Research Collaboration Invite</span>
      <p>Dear <strong>${inviteeName}</strong>,</p>
      <p>You have been invited to collaborate on a research project. Click the button below to review your invitation:</p>
      <div class="project-box">
        <p>📁 ${project.title}</p>
      </div>
      <a href="${portalUrl}" class="cta-btn">Open Research Forum →</a>
    </div>
    <div class="footer">
      This is an automatically generated notification. Please do not reply to this email.<br />
      National Open University of Nigeria &mdash; NOUN HRMS
    </div>
  </div>
</body>
</html>`;
                await sendEmail(targetUser.email, `Research Collaboration Invite: ${project.title}`, html);
            }
        } catch (emailErr) {
            console.error('[RESEARCH] Failed to send invite email:', emailErr);
        }

        // ── In-App Notification to Invitee ────────────────────────────────
        try {
            const project = await prisma.researchProject.findUnique({ where: { id }, select: { title: true } });
            const inviter = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
            if (project) {
                await notifyUser(
                    resolvedUserId,
                    '📨 Research Collaboration Invite',
                    `${inviter?.name || 'A colleague'} has invited you to collaborate on: "${project.title}". Visit your Research Forum to accept.`,
                    'INFO',
                    '/dashboard/research'
                );
            }
        } catch (notifErr) {
            console.error('[RESEARCH] Failed to create notification:', notifErr);
        }

        res.json({ message: 'Invite sent successfully', invite });
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

        let staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile) {
            staffProfile = await prisma.staffProfile.findFirst({
                where: { OR: [{ id: user.id }, { userId: user.id }] }
            });
            if (!staffProfile) {
                staffProfile = await prisma.staffProfile.create({
                    data: {
                        userId: user.id,
                        surname: user.name?.split(' ')?.[0] || 'Academic',
                        otherNames: user.name?.split(' ')?.slice(1)?.join(' ') || 'Staff',
                        cadre: user.role || 'LECTURER',
                        staffId: `NOUN/RES/${user.id.substring(0, 6).toUpperCase()}`
                    }
                });
            }
        }

        const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
        if (!invite) return res.status(404).json({ message: 'Invite not found' });

        const inviteeUser = await prisma.user.findUnique({ where: { id: invite.inviteeId } });

        const isTargetInvitee = 
            invite.inviteeId === user.id || 
            invite.inviteeId === staffProfile.id ||
            invite.inviteeId === staffProfile.userId ||
            (inviteeUser && inviteeUser.email.toLowerCase() === user.email.toLowerCase());

        if (!isTargetInvitee) {
            return res.status(403).json({ message: 'Forbidden: You are not the recipient of this invitation' });
        }

        await prisma.$transaction([
            prisma.projectInvite.update({
                where: { id: inviteId },
                data: { status: 'ACCEPTED' }
            }),
            prisma.projectMember.upsert({
                where: {
                    projectId_staffId: {
                        projectId: invite.projectId,
                        staffId: staffProfile.id
                    }
                },
                create: {
                    projectId: invite.projectId,
                    staffId: staffProfile.id,
                    role: 'EDITOR'
                },
                update: {
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

// 7. Get Project Document (creates a default document if none exists)
export const getDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        let doc = await prisma.projectDocument.findFirst({ where: { projectId: id } });
        if (!doc) {
            doc = await prisma.projectDocument.create({
                data: { projectId: id, title: project.title, contentHtml: '' }
            });
        }

        res.json({ id: doc.id, title: doc.title, contentHtml: doc.contentHtml || '', updatedAt: doc.updatedAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 8. Save Project Document content
export const saveDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { contentHtml } = req.body;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const member = project.members.find(m => m.staffId === staffProfile.id);
            if (!member) return res.status(403).json({ message: 'Forbidden' });
            if (member.role === 'VIEWER') return res.status(403).json({ message: 'Viewers cannot edit the document' });
        }

        // Find existing doc or prepare to create
        const existing = await prisma.projectDocument.findFirst({ where: { projectId: id } });

        const doc = existing
            ? await prisma.projectDocument.update({
                where: { id: existing.id },
                data: { contentHtml: contentHtml ?? '' }
            })
            : await prisma.projectDocument.create({
                data: { projectId: id, title: project.title, contentHtml: contentHtml ?? '' }
            });

        res.json({ message: 'Saved', updatedAt: doc.updatedAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 9. Get My Pending Invites
export const getMyInvites = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findFirst({
            where: { OR: [{ userId: user.id }, { id: user.id }] }
        });

        const invites = await prisma.projectInvite.findMany({
            where: {
                status: 'PENDING',
                OR: [
                    { inviteeId: user.id },
                    ...(staffProfile ? [{ inviteeId: staffProfile.id }, { inviteeId: staffProfile.userId }] : []),
                    { invitee: { email: { equals: user.email, mode: 'insensitive' } } }
                ]
            },
            include: {
                project: { select: { id: true, title: true, domain: true, status: true, abstract: true } },
                inviter: { select: { id: true, name: true, role: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(invites);
    } catch (err) {
        console.error('Failed in getMyInvites:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 16. Get Academic Peers (accessible to all academic staff for project invitation)
export const getAcademicPeers = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        const users = await prisma.user.findMany({
            where: {
                id: { not: user.id },
                isActive: true
            },
            include: {
                staffProfile: true
            },
            take: 300
        });

        const formattedPeers = users.map(u => ({
            id: u.id,
            userId: u.id,
            staffId: u.staffProfile?.id || u.id,
            name: u.staffProfile
                ? `${u.staffProfile.surname || ''} ${u.staffProfile.otherNames || ''}`.trim() || u.name || u.email
                : (u.name || u.email),
            surname: u.staffProfile?.surname || u.name?.split(' ')?.[0] || u.email,
            otherNames: u.staffProfile?.otherNames || u.name?.split(' ')?.slice(1)?.join(' ') || '',
            email: u.email,
            role: u.role,
            cadre: u.staffProfile?.cadre || 'ACADEMIC',
            department: u.staffProfile?.department || 'Academic Unit'
        }));

        res.json(formattedPeers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 10. Decline Invite
export const declineInvite = async (req: Request, res: Response) => {
    try {
        const { inviteId } = req.params;
        const user = (req as any).user;

        const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
        if (!invite || invite.inviteeId !== user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.projectInvite.update({
            where: { id: inviteId },
            data: { status: 'DECLINED' }
        });

        res.json({ message: 'Invite declined' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 11. Edit Workspace (Title, Synopsis/Abstract, Domain)
export const updateProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, abstract, domain } = req.body;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        const updated = await prisma.researchProject.update({
            where: { id },
            data: {
                ...(title ? { title } : {}),
                ...(abstract !== undefined ? { abstract } : {}),
                ...(domain ? { domain } : {})
            }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 12. Mark Workspace Status (COMPLETED / ONGOING / DRAFT)
export const updateProjectStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        const updated = await prisma.researchProject.update({
            where: { id },
            data: { status: status || 'COMPLETED' }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 13. Delete Workspace
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.researchProject.delete({ where: { id } });

        res.json({ message: 'Workspace deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 14. Remove Collaborator / Uninvite
export const removeMember = async (req: Request, res: Response) => {
    try {
        const { id, memberId } = req.params;
        const user = (req as any).user;
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.projectMember.delete({ where: { id: memberId } });

        res.json({ message: 'Collaborator removed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 15. Cancel Pending Invite
export const cancelInvite = async (req: Request, res: Response) => {
    try {
        const { inviteId } = req.params;
        const user = (req as any).user;

        const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
        if (!invite) return res.status(404).json({ message: 'Invite not found' });

        await prisma.projectInvite.delete({ where: { id: inviteId } });

        res.json({ message: 'Invite cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 16. Export Collaborative Document (PDF, DOCX, LaTeX)
export const exportDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { format, doubleSpaced } = req.query;
        const user = (req as any).user;

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const project = await prisma.researchProject.findUnique({
            where: { id },
            include: { members: true }
        });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (user.role !== 'SUPER_USER' && user.role !== 'VICE_CHANCELLOR' && staffProfile) {
            const isMember = project.members.some(m => m.staffId === staffProfile.id);
            if (!isMember) return res.status(403).json({ message: 'Forbidden' });
        }

        const doc = await prisma.projectDocument.findFirst({ where: { projectId: id } });
        if (!doc || !doc.contentHtml) {
            return res.status(400).json({ message: 'Document is empty. Write some content first before exporting.' });
        }

        const title = doc.title || project.title || 'Research Document';
        const isDoubleSpaced = doubleSpaced === 'true';

        if (format === 'latex') {
            const latexText = generateLaTeX(title, doc.contentHtml);
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.tex"`);
            return res.send(latexText);
        }

        if (format === 'docx') {
            const docxBuffer = await generateDOCX(title, doc.contentHtml, isDoubleSpaced);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.docx"`);
            return res.send(docxBuffer);
        }

        // Default: PDF
        const pdfBuffer = await generatePDF(title, doc.contentHtml, isDoubleSpaced);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
        return res.send(pdfBuffer);
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
