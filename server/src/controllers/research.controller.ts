import { Request, Response } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import path from 'path';
import { sendEmail } from '../services/email.service';
import { notifyUser } from './notification.controller';

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
        const { inviteeId } = req.body; // user ID or staffProfile ID of invitee
        const user = (req as any).user;

        // Resolve target user & staffProfile
        let targetUser = await prisma.user.findUnique({ where: { id: inviteeId } });
        let targetStaffProfile = null;
        if (!targetUser) {
            targetStaffProfile = await prisma.staffProfile.findUnique({ where: { id: inviteeId } });
            if (targetStaffProfile) {
                targetUser = await prisma.user.findUnique({ where: { id: targetStaffProfile.userId } });
            }
        }
        if (!targetUser) return res.status(404).json({ message: 'Invitee user not found' });

        const resolvedInviteeId = targetUser.id;

        const existingInvite = await prisma.projectInvite.findFirst({
            where: { projectId: id, inviteeId: resolvedInviteeId, status: 'PENDING' }
        });

        if (existingInvite) return res.status(400).json({ message: 'Invite already sent' });

        const invite = await prisma.projectInvite.create({
            data: {
                projectId: id,
                inviterId: user.id,
                inviteeId: resolvedInviteeId
            }
        });

        // ── Send Email Notification to Invitee ────────────────────────────────
        try {
            const [inviteeUser, project] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: inviteeId },
                    include: { staffProfile: { select: { surname: true, otherNames: true } } }
                }),
                prisma.researchProject.findUnique({
                    where: { id },
                    select: { title: true }
                })
            ]);

            if (inviteeUser?.email && project) {
                const inviteeName = inviteeUser.staffProfile
                    ? `${inviteeUser.staffProfile.surname} ${inviteeUser.staffProfile.otherNames}`.trim()
                    : inviteeUser.email;
                const portalUrl = `${process.env.CLIENT_URL || 'https://nounhrms.web.app'}/dashboard/research`;
                const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; border: 1px solid #e0e0e0; overflow: hidden; }
  .header { background: linear-gradient(135deg, #006533, #004d26); padding: 28px 32px; text-align: center; }
  .header h1 { color: #FFCD00; margin: 0; font-size: 20px; letter-spacing: 1px; }
  .header p { color: #ffffff; margin: 6px 0 0; font-size: 13px; opacity: 0.85; }
  .body { padding: 32px; color: #1f2937; line-height: 1.7; }
  .badge { display: inline-block; background: #f0fdf4; color: #166534; border: 1px solid #86efac; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; margin-bottom: 20px; }
  .project-box { background: #f9fafb; border-left: 4px solid #006533; padding: 16px 20px; border-radius: 6px; margin: 20px 0; }
  .project-box p { margin: 0; font-size: 15px; color: #006533; font-weight: bold; }
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
      <p>You have been invited to collaborate on a research project in the NOUN Research Forum. The project owner has selected you as a peer researcher and granted you collaborator access.</p>
      <div class="project-box">
        <p>📁 ${project.title}</p>
      </div>
      <p>Click the button below to log in to the NOUN HRMS portal and accept or review your invitation:</p>
      <a href="${portalUrl}" class="cta-btn">Open Research Forum →</a>
      <p style="font-size: 13px; color: #6b7280;">If you were not expecting this invitation, you may safely ignore this email. No action is required on your part unless you wish to accept the collaboration.</p>
      <br />
      <p>Regards,</p>
      <p><strong>NOUN Research Office</strong><br />Human Resource Management System</p>
    </div>
    <div class="footer">
      This is an automatically generated notification. Please do not reply to this email.<br />
      National Open University of Nigeria &mdash; NOUN HRMS
    </div>
  </div>
</body>
</html>`;
                await sendEmail(inviteeUser.email, `Research Collaboration Invite: ${project.title}`, html);
            }
        } catch (emailErr) {
            console.error('[RESEARCH] Failed to send invite email (non-fatal):', emailErr);
        }

        // ── In-App Notification to Invitee ────────────────────────────────
        try {
            const project = await prisma.researchProject.findUnique({ where: { id }, select: { title: true } });
            const inviter = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
            if (project) {
                await notifyUser(
                    inviteeId,
                    '📨 Research Collaboration Invite',
                    `${inviter?.name || 'A colleague'} has invited you to collaborate on: "${project.title}". Visit your Research Forum to accept.`,
                    'INFO',
                    '/dashboard/research'
                );
            }
        } catch (notifErr) {
            console.error('[RESEARCH] Failed to create in-app notification (non-fatal):', notifErr);
        }

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

        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
        if (!staffProfile) return res.status(404).json({ message: 'Staff profile required' });

        const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
        if (!invite) return res.status(404).json({ message: 'Invite not found' });

        const isTargetInvitee = invite.inviteeId === user.id || invite.inviteeId === staffProfile.id;
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
        const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: user.id } });

        const invites = await prisma.projectInvite.findMany({
            where: {
                OR: [
                    { inviteeId: user.id },
                    ...(staffProfile ? [{ inviteeId: staffProfile.id }] : [])
                ],
                status: 'PENDING'
            },
            include: {
                project: { select: { id: true, title: true, domain: true, status: true, abstract: true } },
                inviter: { select: { name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(invites);
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
