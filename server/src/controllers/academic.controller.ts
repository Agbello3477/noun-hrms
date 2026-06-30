import { Request, Response } from 'express';
import { AcademicService } from '../services/academic.service';
import { Role } from '@prisma/client';
import prisma from '../prisma';

interface AuthRequest extends Request {
    user?: { id: string; role: Role; staffProfile?: { id: string } };
}

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

export const getCourses = async (req: Request, res: Response) => {
    try {
        let courses = await prisma.course.findMany({
            orderBy: { code: 'asc' }
        });

        // Auto-seed default courses if table is empty or missing key GST107 course
        if (courses.length === 0 || !courses.some(c => c.code === 'GST107')) {
            const defaultCourses = [
                { code: 'GST107', title: 'A Study Guide for the Distance Learner', unit: 2, semester: 'FIRST' },
                { code: 'GST101', title: 'Use of English and Communication Skills I', unit: 2, semester: 'FIRST' },
                { code: 'CIT211', title: 'Introduction to Computer Programming', unit: 3, semester: 'FIRST' },
                { code: 'CIT311', title: 'Computer Networks', unit: 3, semester: 'FIRST' },
                { code: 'CSS111', title: 'Introduction to Sociology', unit: 3, semester: 'FIRST' },
                { code: 'LIS201', title: 'Foundations of Library and Information Science', unit: 3, semester: 'FIRST' },
                { code: 'BUS102', title: 'Introduction to Business', unit: 3, semester: 'SECOND' },
                { code: 'ECO122', title: 'Principles of Economics II', unit: 3, semester: 'SECOND' }
            ];

            await Promise.all(
                defaultCourses.map(c => 
                    prisma.course.upsert({
                        where: { code: c.code },
                        update: {},
                        create: c
                    })
                )
            );

            courses = await prisma.course.findMany({
                orderBy: { code: 'asc' }
            });
        }

        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching courses' });
    }
};

export const allocateCourse = async (req: AuthRequest, res: Response) => {
    try {
        const { courseCode, session, students, staffId } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });
        if (!user?.staffProfile) return res.status(403).json({ message: 'Profile required' });

        let targetStaffId = staffId;

        if (targetStaffId && targetStaffId !== user.staffProfile.id) {
            const isAuthorized = [
                Role.ADMIN,
                Role.SUPER_USER,
                Role.UNIT_HEAD,
                Role.UNIT_ADMIN,
                Role.HR_ADMIN
            ].includes(req.user!.role as any);

            if (!isAuthorized) {
                return res.status(403).json({ message: 'Unauthorized: Only unit managers or admins can allocate courses to other staff members' });
            }
        } else if (!targetStaffId) {
            targetStaffId = user.staffProfile.id;
        }

        const allocation = await AcademicService.allocateTeaching({
            staffId: targetStaffId,
            courseCode,
            session,
            students: Number(students)
        });
        res.json(allocation);
    } catch (error) {
        res.status(500).json({ message: 'Error allocating course' });
    }
};
