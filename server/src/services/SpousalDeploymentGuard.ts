import prisma from '../prisma';

export interface SpousalConflictCheckResult {
    hasConflict: boolean;
    spouseStaffProfileId?: string;
    spouseName?: string;
    spouseUnitOrCenterName?: string;
    targetDestinationName?: string;
    requiresVcApproval: boolean;
    hasValidVcApproval: boolean;
    message?: string;
}

export class SpousalDeploymentGuard {
    /**
     * Checks for spousal co-location conflict:
     * Husband and wife shall not be deployed or posted to work in the same unit, directorate, or study centre
     * without explicit written approval of the Vice-Chancellor (Section 3.8 Senior Staff Conditions of Service).
     */
    static async checkConflict(params: {
        staffProfileId: string;
        targetUnitId?: string | null;
        targetCenterId?: string | null;
        vcApprovalUrl?: string | null;
    }): Promise<SpousalConflictCheckResult> {
        const { staffProfileId, targetUnitId, targetCenterId, vcApprovalUrl } = params;

        const staff = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId },
            include: {
                spouse: {
                    include: {
                        user: true,
                        unit: true,
                        studyCenter: true
                    }
                }
            }
        });

        if (!staff) {
            throw new Error('Staff profile not found');
        }

        // Check if spouse is registered via spouseStaffId or reciprocal relationship
        let spouse = staff.spouse;
        if (!spouse) {
            const reverseSpouse = await prisma.staffProfile.findFirst({
                where: {
                    spouseStaffId: staffProfileId,
                    isDeleted: false
                },
                include: {
                    user: true,
                    unit: true,
                    studyCenter: true
                }
            });
            if (reverseSpouse) {
                spouse = reverseSpouse as any;
            }
        }

        if (!spouse) {
            return {
                hasConflict: false,
                requiresVcApproval: false,
                hasValidVcApproval: false
            };
        }

        const spouseUnitId = spouse.unitId;
        const spouseCenterId = spouse.centerId;

        // Check if destination matches spouse's current unit or center
        const unitConflict = Boolean(targetUnitId && spouseUnitId && targetUnitId === spouseUnitId);
        const centerConflict = Boolean(targetCenterId && spouseCenterId && targetCenterId === spouseCenterId);
        const hasConflict = unitConflict || centerConflict;

        const spouseName = `${spouse.title ? spouse.title + ' ' : ''}${spouse.surname || ''} ${spouse.otherNames || ''}`.trim() || spouse.user?.name || 'Spouse';
        const spouseLocation = spouse.unit?.name || spouse.studyCenter?.name || 'Same Station';

        const hasValidVcApproval = Boolean(vcApprovalUrl && vcApprovalUrl.trim().length > 0);

        if (hasConflict) {
            return {
                hasConflict: true,
                spouseStaffProfileId: spouse.id,
                spouseName,
                spouseUnitOrCenterName: spouseLocation,
                requiresVcApproval: true,
                hasValidVcApproval,
                message: hasValidVcApproval
                    ? `Spousal co-location identified with spouse ${spouseName} at ${spouseLocation}. VC Exemption Waiver attached.`
                    : `SPOUSAL CO-LOCATION CONFLICT: Staff spouse ${spouseName} is currently deployed at ${spouseLocation}. Posting to the same unit/centre is prohibited under Section 3.8 unless Vice-Chancellor exemption is attached.`
            };
        }

        return {
            hasConflict: false,
            spouseStaffProfileId: spouse.id,
            spouseName,
            requiresVcApproval: false,
            hasValidVcApproval: false
        };
    }
}
