import { Request, Response } from 'express';
import { AcademicService } from '../services/academic.service';
import { PrismaClient, Role } from '@prisma/client';

interface AuthRequest extends Request {
    user?: { id: string; role: Role; staffProfile?: { id: string } };
}

const prisma = new PrismaClient(); // Helper for direct lookups if needed

export const getPublications = async (req: AuthRequest, res: Response) => {
    try {
        // If query 'staffId' provided (for viewing others), use it. Else use 'me'.
        let targetStaffId = req.query.staffId as string;

        if (!targetStaffId) {
            // Self
            // Need to fetch user's profile ID if not in token. 
            // Our middleware attaches user {id, role} but maybe not staffProfile.id
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                include: { staffProfile: true }
            });
            if (!user?.staffProfile) return res.status(404).json({ message: 'Profile not found' });
            targetStaffId = user.staffProfile.id;
        }

        const pubs = await AcademicService.getPublications(targetStaffId);
        res.json(pubs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching publications' });
    }
};

export const createPublication = async (req: AuthRequest, res: Response) => {
    try {
        const { title, citation, year, link, type } = req.body;

        // Confirm user has a profile
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });

        if (!user?.staffProfile) return res.status(400).json({ message: 'Staff profile required' });

        const pub = await AcademicService.addPublication(user.staffProfile.id, {
            title, citation, year, link, type
        });

        res.json(pub);
    } catch (error) {
        res.status(500).json({ message: 'Error creating publication' });
    }
};

export const deletePublication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        // Confirm user has a profile
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });
        if (!user?.staffProfile) return res.status(403).json({ message: 'Unauthorized' });

        await AcademicService.deletePublication(id, user.staffProfile.id);
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting publication' });
    }
};

export const checkSabbatical = async (req: AuthRequest, res: Response) => {
    try {
        const result = await AcademicService.checkSabbaticalEligibility(req.user!.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error checking eligibility' });
    }
};

export const getTeachingWorkload = async (req: AuthRequest, res: Response) => {
    try {
        let targetStaffId = req.query.staffId as string;

        if (!targetStaffId) {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                include: { staffProfile: true }
            });
            if (!user?.staffProfile) return res.status(404).json({ message: 'Profile not found' });
            targetStaffId = user.staffProfile.id;
        }

        const workload = await AcademicService.getTeachingWorkload(targetStaffId);
        res.json(workload);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching workload' });
    }
};

export const allocateCourse = async (req: AuthRequest, res: Response) => {
    try {
        const { courseCode, session, students } = req.body;

        // Demo: Allow self-allocation or Admin allocation
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });
        if (!user?.staffProfile) return res.status(400).json({ message: 'Profile required' });

        const allocation = await AcademicService.allocateTeaching({
            staffId: user.staffProfile.id,
            courseCode,
            session,
            students: Number(students)
        });
        res.json(allocation);
    } catch (error) {
        res.status(500).json({ message: 'Error allocating course' });
    }
};
