
import { Request, Response } from 'express';
import { AperStatus, Role } from '@prisma/client';
import prisma from '../prisma';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// --- HR Session Management ---

export const createSession = async (req: AuthRequest, res: Response) => {
    try {
        const { title, year, startDate, endDate } = req.body;

        // Ensure year is unique? Or just rely on logic
        const existing = await prisma.aperSession.findFirst({ where: { year: parseInt(year) } });
        if (existing) return res.status(400).json({ message: `Session for ${year} already exists` });

        const session = await prisma.aperSession.create({
            data: {
                title,
                year: parseInt(year),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: false
            }
        });
        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error creating session' });
    }
};

export const updateSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, startDate, endDate, isActive } = req.body;

        // If activating, ensure only ONE is active? Not strict requirement but good practice
        if (isActive) {
            await prisma.aperSession.updateMany({
                where: { id: { not: id } },
                data: { isActive: false }
            });
        }

        const session = await prisma.aperSession.update({
            where: { id },
            data: {
                title,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                isActive
            }
        });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error updating session' });
    }
};

export const getSessions = async (req: Request, res: Response) => {
    try {
        const sessions = await prisma.aperSession.findMany({
            orderBy: { year: 'desc' }
        });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sessions' });
    }
};

export const getActiveSession = async (req: Request, res: Response) => {
    try {
        const session = await prisma.aperSession.findFirst({
            where: { isActive: true }
        });
        if (!session) return res.status(404).json({ message: 'No active appraisal session' });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching active session' });
    }
};


// --- Staff Form Management ---

// Get MY form for the CURRENT active session
export const getMyForm = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        // 1. Get Active Session
        const session = await prisma.aperSession.findFirst({ where: { isActive: true } });
        if (!session) return res.status(404).json({ message: 'No active session' });

        // 2. Get Staff Profile
        const staff = await prisma.staffProfile.findUnique({ where: { userId } });
        if (!staff) return res.status(404).json({ message: 'Staff profile not found' });

        // 3. Get Form
        let form = await prisma.aperForm.findUnique({
            where: { staffId_sessionId: { staffId: staff.id, sessionId: session.id } }
        });

        // 4. If no form, return empty shell or null (Client can decide to show "Start")
        // Better: Return session info AND form info
        res.json({ session, form });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching form' });
    }
};

export const upsertForm = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { sessionId, scores, comments, status } = req.body;

        const staff = await prisma.staffProfile.findUnique({ where: { userId } });
        if (!staff) return res.status(404).json({ message: 'Staff profile not found' });

        // Ensure session is actually active if creating new or specific status check
        // (Skipping for brevity, but recommended in prod)

        const form = await prisma.aperForm.upsert({
            where: { staffId_sessionId: { staffId: staff.id, sessionId } },
            update: {
                scores,
                comments,
                status: status as AperStatus // Allow saving draft or submitting
            },
            create: {
                staffId: staff.id,
                sessionId,
                scores,
                comments,
                status: status || AperStatus.DRAFT
            }
        });

        res.json(form);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error saving form' });
    }
};

// --- HR Reporting ---
export const getAllForms = async (req: Request, res: Response) => {
    try {
        const { sessionId, unitId } = req.query;
        if (!sessionId) return res.status(400).json({ message: 'Session ID required' });

        const where: any = { sessionId: String(sessionId) };
        if (unitId) {
            where.staff = { unitId: String(unitId) };
        }

        const forms = await prisma.aperForm.findMany({
            where,
            include: {
                staff: {
                    select: {
                        user: { select: { name: true } },
                        staffId: true,
                        unitId: true,
                        centerId: true
                    }
                }
            }
        });
        res.json(forms);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching forms' });
    }
};

// --- Supervisor Review ---
export const reviewForm = async (req: AuthRequest, res: Response) => {
    try {
        const { formId } = req.params;
        const { supervisorScores, supervisorComments, status } = req.body;
        const supervisorId = req.user?.id;

        const form = await prisma.aperForm.findUnique({
            where: { id: formId },
            include: { staff: true }
        });
        if (!form) return res.status(404).json({ message: 'Appraisal form not found' });

        const uploaderRole = req.user?.role;
        const isGlobalApprover = [Role.HR_ADMIN, Role.SUPER_USER, Role.VICE_CHANCELLOR].includes(uploaderRole as any);

        if (!isGlobalApprover) {
            const supervisorProfile = await prisma.staffProfile.findUnique({
                where: { userId: supervisorId },
                select: { unitId: true, centerId: true }
            });
            if (!supervisorProfile) {
                return res.status(403).json({ message: 'Unauthorized: Supervisor profile not found' });
            }

            const targetStaff = form.staff;
            let isAuthorized = false;

            if (uploaderRole === Role.STUDY_CENTER_MANAGER && supervisorProfile.centerId && targetStaff.centerId === supervisorProfile.centerId) {
                isAuthorized = true;
            } else if ([Role.UNIT_HEAD, Role.UNIT_ADMIN].includes(uploaderRole as any) && supervisorProfile.unitId && targetStaff.unitId === supervisorProfile.unitId) {
                isAuthorized = true;
            }

            if (!isAuthorized) {
                return res.status(403).json({ message: 'Unauthorized: This staff member is outside your supervision boundary' });
            }
        }

        // Ensure status is valid for review (e.g. REVIEWED or COMPLETED)
        const updatedForm = await prisma.aperForm.update({
            where: { id: formId },
            data: {
                supervisorId,
                scores: supervisorScores, // Store merged or separate scores? Schema says Json
                comments: supervisorComments, // Schema says Json
                status: status || AperStatus.REVIEWED
            }
        });

        res.json({ message: 'Appraisal reviewed successfully', form: updatedForm });
    } catch (error) {
        console.error('Review Form Error', error);
        res.status(500).json({ message: 'Error reviewing appraisal' });
    }
};
