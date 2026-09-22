import { PrismaClient, CadreType, PromotionEligibilityStatus } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { calculateNextPromotionMaturity } from '../src/utils/promotionCalculator';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

export async function seedInitialPromotions(): Promise<{
    scanned: number;
    updated: number;
    dueForReview: number;
    pendingMaturity: number;
}> {
    console.log('🌱 Starting Initial Service Record & Promotion Milestone Backfill Script...');
    const currentYear = new Date().getFullYear();

    try {
        const staffProfiles = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                status: 'ACTIVE'
            },
            include: {
                user: { select: { id: true, name: true, email: true, role: true, createdAt: true } }
            }
        });

        console.log(`📋 Found ${staffProfiles.length} active staff profiles to inspect for promotion milestones.`);

        let updated = 0;
        let dueForReview = 0;
        let pendingMaturity = 0;

        for (const profile of staffProfiles) {
            // Check if profile already has nextPromotionDueYear AND lastPromotionDate
            const hasExistingSchedule = profile.nextPromotionDueYear && profile.lastPromotionDate && profile.legacyDataBackfilled;

            // Resolve effective last promotion date
            let lastPromo: Date | null = profile.lastPromotionDate || profile.dateOfLastPromotion || null;

            if (!lastPromo && profile.dateOfFirstAppointment) {
                lastPromo = new Date(profile.dateOfFirstAppointment);
            }

            if (!lastPromo) {
                // Fallback to user creation date or 3 years prior to allow maturity evaluation
                const userCreated = profile.user?.createdAt ? new Date(profile.user.createdAt) : new Date();
                lastPromo = new Date(userCreated);
            }

            // Resolve CadreType
            let resolvedCadreType: CadreType = CadreType.SENIOR_ADMIN;
            if (profile.cadreType) {
                resolvedCadreType = profile.cadreType;
            } else if (profile.cadre) {
                const c = String(profile.cadre).toUpperCase();
                if (c === 'ACADEMIC') resolvedCadreType = CadreType.ACADEMIC;
                else if (c === 'JUNIOR' || c === 'JUNIOR_STAFF') resolvedCadreType = CadreType.JUNIOR_STAFF;
                else if (c === 'TECHNICAL') resolvedCadreType = CadreType.TECHNICAL;
                else if (c === 'MEDICAL') resolvedCadreType = CadreType.MEDICAL;
                else if (c === 'SECURITY') resolvedCadreType = CadreType.SECURITY;
                else resolvedCadreType = CadreType.SENIOR_ADMIN;
            }

            const effectiveGradeLevel = profile.currentGradeLevel || profile.level || (resolvedCadreType === CadreType.ACADEMIC ? 'CONUASS 04' : 'CONTISS 08');

            // Compute Cadre Maturity
            const computed = calculateNextPromotionMaturity(lastPromo, resolvedCadreType, effectiveGradeLevel);

            const finalDueYear = profile.nextPromotionDueYear || profile.nextDueYear || computed.dueYear;
            const finalDueDate = profile.nextPromotionDueDate || profile.nextDueDate || computed.dueDate;

            // Determine eligibility status
            let finalStatus: PromotionEligibilityStatus = PromotionEligibilityStatus.PENDING_MATURITY;
            if (profile.eligibilityStatus && profile.eligibilityStatus !== PromotionEligibilityStatus.PENDING_MATURITY) {
                finalStatus = profile.eligibilityStatus;
            } else if (profile.isDueForPromotion || finalDueYear <= currentYear) {
                finalStatus = PromotionEligibilityStatus.DUE_FOR_REVIEW;
            }

            if (finalStatus === PromotionEligibilityStatus.DUE_FOR_REVIEW) {
                dueForReview++;
            } else {
                pendingMaturity++;
            }

            // Update database record
            await prisma.staffProfile.update({
                where: { id: profile.id },
                data: {
                    lastPromotionDate: lastPromo,
                    dateOfLastPromotion: lastPromo,
                    cadreType: resolvedCadreType,
                    currentGradeLevel: effectiveGradeLevel,
                    nextPromotionDueYear: finalDueYear,
                    nextDueYear: finalDueYear,
                    nextPromotionDueDate: finalDueDate,
                    nextDueDate: finalDueDate,
                    promotionEligibilityStatus: finalStatus,
                    eligibilityStatus: finalStatus,
                    legacyDataBackfilled: true,
                    isDueForPromotion: finalStatus === PromotionEligibilityStatus.DUE_FOR_REVIEW
                }
            });

            updated++;
        }

        console.log('\n================ PROMOTION BACKFILL SUMMARY ================');
        console.log(`✅ Total Profiles Scanned:  ${staffProfiles.length}`);
        console.log(`🔄 Total Profiles Seeded:   ${updated}`);
        console.log(`📌 Due For Review (<=2026): ${dueForReview}`);
        console.log(`⏳ Pending Maturity (2027+):${pendingMaturity}`);
        console.log('============================================================\n');

        return {
            scanned: staffProfiles.length,
            updated,
            dueForReview,
            pendingMaturity
        };
    } catch (err: any) {
        console.error('❌ Error during promotion backfill seeding:', err);
        throw err;
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    seedInitialPromotions()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
