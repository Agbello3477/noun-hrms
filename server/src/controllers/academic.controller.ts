import { Request, Response } from 'express';
import { AcademicService } from '../services/academic.service';
import { AcademicPromotionService } from '../services/academicPromotion.service';
import { StorageService } from '../services/storage.service';
import { Role, PublicationType, PublicationVerificationStatus, Cadre } from '@prisma/client';
import prisma from '../prisma';
import { PUBLICATION_DEFAULT_POINTS } from '../utils/academicPromotionRules';

interface AuthRequest extends Request {
    user?: { id: string; role: Role; staffProfile?: { id: string } };
}

/**
 * Get all academic publications for a staff member
 * GET /api/academic/publications?staffId=...
 */
export const getPublications = async (req: AuthRequest, res: Response) => {
    try {
        let targetStaffId = req.query.staffId as string;

        if (targetStaffId) {
            const targetProfile = await prisma.staffProfile.findUnique({
                where: { id: targetStaffId }
            });
            if (!targetProfile) return res.status(404).json({ message: 'Profile not found' });

            const isSelf = req.user!.id === targetProfile.userId;
            const isAuthorized = isSelf || [
                Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR,
                Role.REGISTRAR, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN
            ].includes(req.user!.role as any);

            if (!isAuthorized) {
                return res.status(403).json({ message: 'Unauthorized access to this academic data' });
            }
        } else {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                include: { staffProfile: true }
            });
            if (!user?.staffProfile) return res.status(404).json({ message: 'Profile not found' });
            targetStaffId = user.staffProfile.id;
        }

        const pubs = await prisma.academicPublication.findMany({
            where: { staffId: targetStaffId },
            include: {
                vettedBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { publicationDate: 'desc' }
        });

        res.json(pubs);
    } catch (error) {
        console.error('Error fetching publications:', error);
        res.status(500).json({ message: 'Error fetching publications' });
    }
};

/**
 * Create a new academic research publication
 * POST /api/academic/publications
 */
export const createPublication = async (req: AuthRequest, res: Response) => {
    try {
        const {
            title,
            citation,
            year,
            link,
            type = 'JOURNAL_ARTICLE',
            doiOrIsbn,
            peerReviewed = true,
            pointsClaimed,
            indexingStatus
        } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Publication title is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });

        if (!user?.staffProfile) {
            return res.status(400).json({ message: 'Staff profile required to record publications' });
        }

        if (user.staffProfile.cadre !== Cadre.ACADEMIC) {
            return res.status(403).json({ message: 'Only staff assigned to the Academic Cadre can record academic research publications.' });
        }

        let evidenceDocumentUrl: string | null = null;
        if (req.file) {
            evidenceDocumentUrl = await StorageService.uploadFile(req.file, 'publications');
        } else if (req.body.evidenceDocumentUrl) {
            evidenceDocumentUrl = req.body.evidenceDocumentUrl;
        }

        const pubType = (type as PublicationType) || PublicationType.JOURNAL_ARTICLE;
        const defaultPoints = PUBLICATION_DEFAULT_POINTS[pubType] || 5.0;
        const calculatedPoints = pointsClaimed !== undefined && pointsClaimed !== null && !isNaN(Number(pointsClaimed))
            ? Number(pointsClaimed)
            : defaultPoints;

        const publication = await prisma.academicPublication.create({
            data: {
                staffId: user.staffProfile.id,
                title: title.trim(),
                type: pubType,
                doiOrIsbn: doiOrIsbn ? doiOrIsbn.trim() : null,
                peerReviewed: String(peerReviewed) === 'true' || peerReviewed === true,
                pointsClaimed: calculatedPoints,
                pointsAwarded: 0.0,
                verificationStatus: PublicationVerificationStatus.PENDING_VERIFICATION,
                publicationDate: year ? new Date(`${year}-01-01`) : new Date(),
                year: year ? Number(year) : new Date().getFullYear(),
                citation: citation ? citation.trim() : null,
                link: link ? link.trim() : null,
                evidenceDocumentUrl,
                indexingStatus: indexingStatus ? indexingStatus.trim() : null
            }
        });

        res.status(201).json(publication);
    } catch (error) {
        console.error('Error creating publication:', error);
        res.status(500).json({ message: 'Error creating publication' });
    }
};

/**
 * Update an academic publication
 * PUT /api/academic/publications/:id
 */
export const updatePublication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            title,
            citation,
            year,
            link,
            type,
            doiOrIsbn,
            peerReviewed,
            pointsClaimed,
            indexingStatus
        } = req.body;

        const publication = await prisma.academicPublication.findUnique({
            where: { id },
            include: { staff: true }
        });

        if (!publication) {
            return res.status(404).json({ message: 'Publication not found' });
        }

        const isOwner = publication.staff.userId === req.user!.id;
        const isPrivileged = [
            Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR
        ].includes(req.user!.role as any);

        if (!isOwner && !isPrivileged) {
            return res.status(403).json({ message: 'Unauthorized to edit this publication' });
        }

        let evidenceDocumentUrl = publication.evidenceDocumentUrl;
        if (req.file) {
            evidenceDocumentUrl = await StorageService.uploadFile(req.file, 'publications');
        }

        const updated = await prisma.academicPublication.update({
            where: { id },
            data: {
                ...(title ? { title: title.trim() } : {}),
                ...(type ? { type: type as PublicationType } : {}),
                ...(doiOrIsbn !== undefined ? { doiOrIsbn: doiOrIsbn ? doiOrIsbn.trim() : null } : {}),
                ...(peerReviewed !== undefined ? { peerReviewed: String(peerReviewed) === 'true' || peerReviewed === true } : {}),
                ...(pointsClaimed !== undefined ? { pointsClaimed: Number(pointsClaimed) } : {}),
                ...(year ? { year: Number(year), publicationDate: new Date(`${year}-01-01`) } : {}),
                ...(citation !== undefined ? { citation: citation ? citation.trim() : null } : {}),
                ...(link !== undefined ? { link: link ? link.trim() : null } : {}),
                ...(evidenceDocumentUrl ? { evidenceDocumentUrl } : {}),
                ...(indexingStatus !== undefined ? { indexingStatus: indexingStatus ? indexingStatus.trim() : null } : {})
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating publication:', error);
        res.status(500).json({ message: 'Error updating publication' });
    }
};

/**
 * Delete an academic publication
 * DELETE /api/academic/publications/:id
 */
export const deletePublication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });

        if (!user?.staffProfile) return res.status(403).json({ message: 'Unauthorized' });

        const pub = await prisma.academicPublication.findUnique({
            where: { id }
        });

        if (!pub) {
            return res.status(404).json({ message: 'Publication not found' });
        }

        const isOwner = pub.staffId === user.staffProfile.id;
        const isPrivileged = [
            Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.REGISTRAR, Role.VICE_CHANCELLOR
        ].includes(user.role as any);

        if (!isOwner && !isPrivileged) {
            return res.status(403).json({ message: 'Unauthorized to delete this publication' });
        }

        await prisma.academicPublication.delete({ where: { id } });

        // Recalculate staff total points
        const allVerified = await prisma.academicPublication.findMany({
            where: {
                staffId: pub.staffId,
                verificationStatus: PublicationVerificationStatus.VERIFIED,
                peerReviewed: true
            }
        });
        const total = allVerified.reduce((sum, p) => sum + (Number(p.pointsAwarded) || Number(p.pointsClaimed) || 0), 0);
        await prisma.staffProfile.update({
            where: { id: pub.staffId },
            data: { totalVerifiedPublicationPoints: parseFloat(total.toFixed(2)) }
        });

        res.json({ message: 'Publication deleted successfully' });
    } catch (error) {
        console.error('Error deleting publication:', error);
        res.status(500).json({ message: 'Error deleting publication' });
    }
};

/**
 * Vets and approves publication points (Committee / Registry)
 * POST /api/academic/publications/:id/vet
 */
export const vetPublication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { pointsAwarded, verificationStatus, vettingRemarks } = req.body;

        const isAuthorized = [
            Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR,
            Role.REGISTRAR, Role.UNIT_HEAD
        ].includes(req.user!.role as any);

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Unauthorized: Appraisal Vetting requires Committee Secretary or Registry privileges' });
        }

        if (pointsAwarded === undefined || isNaN(Number(pointsAwarded))) {
            return res.status(400).json({ message: 'Valid points awarded value is required' });
        }

        const vetted = await AcademicPromotionService.vetPublication({
            publicationId: id,
            actorId: req.user!.id,
            pointsAwarded: Number(pointsAwarded),
            verificationStatus: verificationStatus || PublicationVerificationStatus.VERIFIED,
            vettingRemarks
        });

        res.json(vetted);
    } catch (error: any) {
        console.error('Error vetting publication:', error);
        res.status(500).json({ message: error.message || 'Error vetting publication' });
    }
};

/**
 * Evaluate statutory academic promotion criteria for a staff candidate
 * GET /api/academic/evaluation/:staffId
 */
export const getAcademicEvaluation = async (req: AuthRequest, res: Response) => {
    try {
        const { staffId } = req.params;
        const { currentRank, targetRank } = req.query;

        const targetProfile = await prisma.staffProfile.findUnique({
            where: { id: staffId }
        });
        if (!targetProfile) return res.status(404).json({ message: 'Staff profile not found' });

        const isSelf = req.user!.id === targetProfile.userId;
        const isAuthorized = isSelf || [
            Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR,
            Role.REGISTRAR, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN
        ].includes(req.user!.role as any);

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Unauthorized to view evaluation' });
        }

        const evaluation = await AcademicPromotionService.evaluateAcademicPromotion(
            staffId,
            currentRank as string,
            targetRank as string
        );

        res.json(evaluation);
    } catch (error: any) {
        console.error('Error evaluating academic promotion:', error);
        res.status(500).json({ message: error.message || 'Error evaluating promotion' });
    }
};

/**
 * Get comprehensive academic appraisal dossier
 * GET /api/academic/dossier/:staffId
 */
export const getAcademicDossier = async (req: AuthRequest, res: Response) => {
    try {
        const { staffId } = req.params;

        const targetProfile = await prisma.staffProfile.findUnique({
            where: { id: staffId }
        });
        if (!targetProfile) return res.status(404).json({ message: 'Staff profile not found' });

        const isSelf = req.user!.id === targetProfile.userId;
        const isAuthorized = isSelf || [
            Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR,
            Role.REGISTRAR, Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN
        ].includes(req.user!.role as any);

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Unauthorized to view academic dossier' });
        }

        const dossier = await AcademicPromotionService.getStaffAcademicDossier(staffId);
        res.json(dossier);
    } catch (error: any) {
        console.error('Error retrieving academic dossier:', error);
        res.status(500).json({ message: error.message || 'Error retrieving academic dossier' });
    }
};

export const checkSabbatical = async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { staffProfile: true }
        });
        if (user?.staffProfile?.cadre !== Cadre.ACADEMIC) {
            return res.status(403).json({ eligible: false, message: 'Sabbatical leave is strictly reserved for Academic Cadre staff.' });
        }
        const result = await AcademicService.checkSabbaticalEligibility(req.user!.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error checking eligibility' });
    }
};

export const getTeachingWorkload = async (req: AuthRequest, res: Response) => {
    try {
        let targetStaffId = req.query.staffId as string;

        if (targetStaffId) {
            const targetProfile = await prisma.staffProfile.findUnique({
                where: { id: targetStaffId }
            });
            if (!targetProfile) return res.status(404).json({ message: 'Profile not found' });

            const isSelf = req.user!.id === targetProfile.userId;
            const isAuthorized = isSelf || [
                Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR,
                Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN, Role.REGISTRAR
            ].includes(req.user!.role as any);

            if (!isAuthorized) {
                return res.status(403).json({ message: 'Unauthorized access to this academic data' });
            }
        } else {
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
                Role.HR_ADMIN,
                Role.REGISTRAR
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
