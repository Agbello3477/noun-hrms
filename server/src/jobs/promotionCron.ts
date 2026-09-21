import cron from 'node-cron';
import { PromotionService } from '../services/promotion.service';

/**
 * Core promotion maturity worker — callable by cron OR manually from the API.
 * Evaluates cadre-based intervals, filters integrity holds (queries/suspensions), stages dockets, and dispatches multi-tier notifications.
 */
export const runPromotionJob = async (
    triggeredBy: 'CRON' | 'MANUAL' = 'CRON',
    cycleYear: number = new Date().getFullYear()
): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
    log: string[];
    maturedCount?: number;
    integrityHoldsCount?: number;
}> => {
    try {
        const result = await PromotionService.evaluateMaturityCycle(cycleYear, undefined, triggeredBy);
        return {
            processed: result.totalCandidates,
            skipped: result.skippedCount,
            errors: result.errors,
            log: result.log,
            maturedCount: result.maturedCount,
            integrityHoldsCount: result.integrityHoldsCount
        };
    } catch (error: any) {
        console.error('[PROMOTION_CRON] Fatal execution failure:', error);
        return {
            processed: 0,
            skipped: 0,
            errors: [error.message || 'Fatal error in promotion maturity worker'],
            log: [`[FATAL] ${error.message}`]
        };
    }
};

/**
 * Scheduled background workers for Promotion Maturity Tracking:
 * 1. Annual Main Cycle Run: 00:00 on January 1st every year (WAT) -> "0 0 1 1 *"
 * 2. Quarterly Refresh & Staging Check: 00:00 on April 1st, July 1st, October 1st (WAT) -> "0 0 1 4,7,10 *"
 */
export const schedulePromotionCron = () => {
    // Annual January 1st Run
    cron.schedule('0 0 1 1 *', async () => {
        const year = new Date().getFullYear();
        console.log(`[PROMOTION_CRON] 🕛 January 1st annual promotion cycle triggered for year ${year}...`);
        await runPromotionJob('CRON', year);
    }, {
        timezone: 'Africa/Lagos' // WAT (UTC+1)
    });

    // Quarterly Maturity Alignment (evaluates current & upcoming cycle)
    cron.schedule('0 0 1 4,7,10 *', async () => {
        const year = new Date().getFullYear();
        console.log(`[PROMOTION_CRON] 🔄 Quarterly promotion maturity alignment check for year ${year}...`);
        await runPromotionJob('CRON', year);
    }, {
        timezone: 'Africa/Lagos'
    });

    console.log('[PROMOTION_CRON] ✅ Promotion maturity background workers scheduled (Annual Jan 1 + Quarterly WAT).');
};
