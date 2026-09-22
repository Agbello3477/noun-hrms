import { Request, Response } from 'express';
import { PromotionService } from '../services/promotion.service';
import { calculatePromotionMaturity } from '../utils/promotionCalculator';
import prisma from '../prisma';

/**
 * PATCH /api/v1/registry/promotions/:staffId/due-date
 * Updates or overrides promotion due date, intervals, and status for a staff profile.
 * RBAC: HR_ADMIN, VICE_CHANCELLOR, SUPER_USER, ADMIN
 */
export const updatePromotionDueDate = async (req: Request, res: Response) => {
    try {
        const { staffId } = req.params;
        // @ts-ignore
        const actorId = req.user?.id as string;

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

        // Resolve staffProfileId (support UUID id or institutional staffId)
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
            message: 'Promotion schedule updated and audited successfully.',
            profile: result.profile,
            auditLog: result.auditLog
        });
    } catch (error: any) {
        console.error('updatePromotionDueDate error:', error);
        res.status(400).json({ message: error.message || 'Failed to update promotion schedule' });
    }
};

/**
 * GET /api/v1/registry/promotions/due-list & GET /api/v1/registry/promotions/candidates
 * Filtered, paginated promotion due list with summary metrics and CSV export.
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

        // Handle CSV Export
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

/**
 * POST /api/v1/registry/promotions/evaluate-cycle
 * On-demand evaluation trigger for the annual promotion maturity engine.
 */
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

/**
 * POST /api/v1/registry/promotions/batch-action
 * Executes batch status updates or docket staging on multiple candidate profiles.
 */
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

/**
 * GET /api/v1/registry/promotions/audit-logs/:staffId
 * Retrieves immutable audit logs for a staff profile's promotion schedule.
 */
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

/**
 * POST /api/v1/registry/promotions/sync-candidates
 * Manual trigger endpoint allowing Registry admins to run an on-demand sync that moves any staff with nextPromotionDueYear <= currentYear into DUE_FOR_REVIEW status.
 */
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

/**
 * GET /api/v1/registry/promotions/candidates
 * Alias for getPromotionDueList
 */
export const getPromotionCandidates = getPromotionDueList;

/**
 * GET /api/v1/registry/promotions/calculate
 * Helper endpoint that calculates cadre maturity given input parameters without persisting.
 */
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

