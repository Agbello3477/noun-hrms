import { Request, Response } from 'express';
import { PromotionService } from '../services/promotion.service';
import { calculatePromotionMaturity } from '../utils/promotionCalculator';
import prisma from '../prisma';
import { Role } from '@prisma/client';

/**
 * PATCH /api/v1/registry/promotions/:staffId/due-date
 * Updates or overrides promotion due date, intervals, and status for a staff profile.
 * RBAC: HR_ADMIN, REGISTRAR, VICE_CHANCELLOR, SUPER_USER, ADMIN
 */
export const updatePromotionDueDate = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        // @ts-ignore
        const actorId = req.user?.id as string;
        // @ts-ignore
        const actorRole = req.user?.role as string;

        const {
            lastPromotionDate,
            cadreType,
            currentGradeLevel,
            nextDueYear,
            nextPromotionDueYear,
            nextDueDate,
            nextPromotionDueDate,
            eligibilityStatus,
            promotionEligibilityStatus,
            registryOverride,
            reason,
            overrideReason,
            isDueImmediately
        } = req.body;

        let profile = await prisma.staffProfile.findUnique({
            where: { id: staffId },
            select: { id: true }
        });

        if (!profile) {
            profile = await prisma.staffProfile.findUnique({
                where: { staffId },
                select: { id: true }
            });
        }

        if (!profile) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        const effectiveReason = overrideReason || reason;

        const result = await PromotionService.updateStaffPromotionSchedule({
            staffProfileId: profile.id,
            actorId,
            actorRole,
            lastPromotionDate,
            cadreType,
            currentGradeLevel,
            nextDueYear,
            nextPromotionDueYear,
            nextDueDate,
            nextPromotionDueDate,
            eligibilityStatus,
            promotionEligibilityStatus,
            registryOverride: registryOverride === true || (nextDueYear !== undefined && nextDueYear !== null) || (nextPromotionDueYear !== undefined && nextPromotionDueYear !== null),
            overrideReason: effectiveReason,
            isDueImmediately
        });

        res.json({
            message: 'Promotion schedule updated successfully.',
            profile: result.profile,
            auditLog: result.auditLog
        });
    } catch (error: any) {
        console.error('updatePromotionDueDate error:', error);
        res.status(400).json({ message: error.message || 'Failed to update promotion schedule' });
    }
};

/**
 * GET /api/v1/registry/promotions/pending-overrides
 * Returns all promotion overrides awaiting Registrar approval.
 */
export const getPendingPromotionOverrides = async (req: Request, res: Response) => {
    try {
        const pending = await prisma.staffProfile.findMany({
            where: {
                promotionOverrideStatus: 'PENDING_REGISTRAR_OVERRIDE',
                isDeleted: false
            },
            include: {
                user: { select: { name: true, email: true } },
                unit: { select: { name: true } }
            },
            orderBy: { promotionOverrideRequestedAt: 'desc' }
        });

        res.json(pending);
    } catch (error: any) {
        console.error('Error fetching pending promotion overrides:', error);
        res.status(500).json({ message: 'Failed to fetch pending overrides' });
    }
};

/**
 * POST /api/v1/registry/promotions/:staffId/authorize-override
 * Registrar authorizes a staged promotion due year override.
 */
export const authorizePromotionOverride = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        const { remarks } = req.body;
        // @ts-ignore
        const actorId = req.user?.id as string;
        // @ts-ignore
        const actorRole = req.user?.role as string;

        if (actorRole !== Role.REGISTRAR && actorRole !== Role.SUPER_USER && actorRole !== Role.VICE_CHANCELLOR) {
            return res.status(403).json({ message: 'Forbidden: Only the Registrar or Super User can authorize promotion overrides.' });
        }

        let profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [{ id: staffId }, { staffId }, { userId: staffId }]
            },
            select: { id: true }
        });

        if (!profile) return res.status(404).json({ message: 'Staff profile not found' });

        const result = await PromotionService.authorizePromotionOverride(profile.id, actorId, remarks);

        res.json({
            message: 'Promotion override successfully authorized by Registrar.',
            result
        });
    } catch (error: any) {
        console.error('authorizePromotionOverride error:', error);
        res.status(400).json({ message: error.message || 'Failed to authorize promotion override' });
    }
};

/**
 * POST /api/v1/registry/promotions/:staffId/reject-override
 * Registrar rejects a staged promotion due year override.
 */
export const rejectPromotionOverride = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        const { reason } = req.body;
        // @ts-ignore
        const actorId = req.user?.id as string;
        // @ts-ignore
        const actorRole = req.user?.role as string;

        if (actorRole !== Role.REGISTRAR && actorRole !== Role.SUPER_USER && actorRole !== Role.VICE_CHANCELLOR) {
            return res.status(403).json({ message: 'Forbidden: Only the Registrar or Super User can reject promotion overrides.' });
        }

        let profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [{ id: staffId }, { staffId }, { userId: staffId }]
            },
            select: { id: true }
        });

        if (!profile) return res.status(404).json({ message: 'Staff profile not found' });

        const result = await PromotionService.rejectPromotionOverride(profile.id, actorId, reason);

        res.json({
            message: 'Promotion override rejected by Registrar.',
            result
        });
    } catch (error: any) {
        console.error('rejectPromotionOverride error:', error);
        res.status(400).json({ message: error.message || 'Failed to reject promotion override' });
    }
};

/**
 * GET /api/v1/registry/promotions/due-list & GET /api/v1/registry/promotions/candidates
 */
export const getPromotionDueList = async (req: Request, res: Response) => {
    try {
        const {
            year,
            cadre,
            status,
            tab,
            search,
            page,
            limit,
            export: exportFormat
        } = req.query;

        const result = await PromotionService.getPromotionDueList({
            year: year ? parseInt(String(year), 10) : undefined,
            cadre: cadre ? String(cadre) : undefined,
            status: status ? String(status) : undefined,
            tab: tab ? String(tab) : undefined,
            search: search ? String(search) : undefined,
            page: page ? parseInt(String(page), 10) : 1,
            limit: exportFormat === 'csv' ? 1000 : (limit ? parseInt(String(limit), 10) : 15)
        });

        if (exportFormat === 'csv') {
            const headers = [
                'Staff ID',
                'Full Name',
                'Cadre',
                'Rank',
                'Grade Level',
                'Unit / Department',
                'Last Promotion Date',
                'Next Due Year',
                'Next Due Date',
                'Eligibility Status',
                'Registry Override',
                'Disciplinary Hold',
                'Override Justification'
            ];

            const rows = result.data.map(p => {
                const name = `${p.title ? p.title + ' ' : ''}${p.surname || ''} ${p.otherNames || ''}`.trim() || p.user?.name || 'N/A';
                const unit = p.unit?.name || p.studyCenter?.name || p.department || 'N/A';
                const lastPromo = p.lastPromotionDate || p.dateOfLastPromotion ? new Date(p.lastPromotionDate || p.dateOfLastPromotion!).toISOString().split('T')[0] : 'N/A';
                const nextDate = p.nextDueDate ? new Date(p.nextDueDate).toISOString().split('T')[0] : 'N/A';

                return [
                    `"${p.staffId || ''}"`,
                    `"${name}"`,
                    `"${p.cadreType || p.cadre || ''}"`,
                    `"${p.rank || ''}"`,
                    `"${p.currentGradeLevel || p.level || ''}"`,
                    `"${unit}"`,
                    `"${lastPromo}"`,
                    `"${p.nextDueYear || ''}"`,
                    `"${nextDate}"`,
                    `"${p.eligibilityStatus || ''}"`,
                    `"${p.registryOverride ? 'YES' : 'NO'}"`,
                    `"${p.hasDisciplinaryHold ? 'BLOCKED' : 'CLEAR'}"`,
                    `"${(p.overrideReason || '').replace(/"/g, '""')}"`
                ].join(',');
            });

            const csvContent = [headers.join(','), ...rows].join('\n');
            const targetYear = year || new Date().getFullYear();

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="noun_promotion_due_list_${targetYear}.csv"`);
            return res.send(csvContent);
        }

        res.json(result);
    } catch (error: any) {
        console.error('getPromotionDueList error:', error);
        res.status(500).json({ message: error.message || 'Failed to retrieve promotion due list' });
    }
};

export const evaluatePromotionCycle = async (req: Request, res: Response) => {
    try {
        const { cycleYear } = req.body;
        // @ts-ignore
        const actorId = req.user?.id as string;
        const targetYear = cycleYear ? parseInt(String(cycleYear), 10) : new Date().getFullYear();

        const result = await PromotionService.evaluateMaturityCycle(targetYear, actorId, 'MANUAL');

        res.json({
            message: `Annual promotion maturity evaluation complete for cycle year ${targetYear}.`,
            result
        });
    } catch (error: any) {
        console.error('evaluatePromotionCycle error:', error);
        res.status(500).json({ message: error.message || 'Failed to execute maturity evaluation' });
    }
};

export const batchActionPromotions = async (req: Request, res: Response) => {
    try {
        const { staffProfileIds, action, status, reason } = req.body;
        // @ts-ignore
        const actorId = req.user?.id as string;

        const result = await PromotionService.batchActionCandidates({
            staffProfileIds,
            action,
            status,
            reason,
            actorId
        });

        res.json({
            message: `Successfully processed ${result.updatedCount} candidate(s).`,
            result
        });
    } catch (error: any) {
        console.error('batchActionPromotions error:', error);
        res.status(400).json({ message: error.message || 'Failed to perform batch promotion action' });
    }
};

export const getPromotionAuditLogs = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;

        let profile = await prisma.staffProfile.findUnique({
            where: { id: staffId },
            select: { id: true }
        });

        if (!profile) {
            profile = await prisma.staffProfile.findUnique({
                where: { staffId },
                select: { id: true }
            });
        }

        if (!profile) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        const logs = await PromotionService.getStaffPromotionAuditLogs(profile.id);
        res.json(logs);
    } catch (error: any) {
        console.error('getPromotionAuditLogs error:', error);
        res.status(500).json({ message: error.message || 'Failed to retrieve promotion audit logs' });
    }
};

export const syncPromotionCandidates = async (req: Request, res: Response) => {
    try {
        const { cycleYear } = req.body;
        // @ts-ignore
        const actorId = req.user?.id as string;
        const targetYear = cycleYear ? parseInt(String(cycleYear), 10) : new Date().getFullYear();

        const result = await PromotionService.syncCandidates(targetYear, actorId);

        res.json({
            message: `On-demand promotion candidate synchronization complete for ${targetYear}.`,
            result
        });
    } catch (error: any) {
        console.error('syncPromotionCandidates error:', error);
        res.status(500).json({ message: error.message || 'Failed to synchronize promotion candidates' });
    }
};

export const getPromotionCandidates = getPromotionDueList;

export const calculateMaturityPreview = async (req: Request, res: Response) => {
    try {
        const { lastPromotionDate, cadre, gradeLevel } = req.query;

        const result = calculatePromotionMaturity(
            lastPromotionDate ? String(lastPromotionDate) : null,
            cadre ? String(cadre) : null,
            gradeLevel ? String(gradeLevel) : null
        );

        res.json(result);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to calculate maturity preview' });
    }
};
