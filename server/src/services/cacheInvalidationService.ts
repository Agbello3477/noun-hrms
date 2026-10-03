import { redisService } from './redis.service';
import { logger } from './observability.service';

export class CacheInvalidationService {
    /**
     * Invalidate one or more tag sets atomically.
     * Fetches all keys registered in the Redis Set for each tag,
     * deletes all the cached items, and deletes the tag set itself.
     */
    async invalidateTags(tags: string[]): Promise<void> {
        if (!tags || tags.length === 0) return;

        try {
            const allKeysToDelete: Set<string> = new Set();
            const tagKeysToDelete: string[] = [];

            for (const rawTag of tags) {
                const tag = rawTag.startsWith('tag:') ? rawTag : `tag:${rawTag}`;
                tagKeysToDelete.push(tag);

                const keys = await redisService.smembers(tag);
                if (keys && keys.length > 0) {
                    for (const k of keys) {
                        allKeysToDelete.add(k);
                    }
                }
            }

            // Delete all associated keys and the tag indices
            const keysArray = Array.from(allKeysToDelete);
            if (keysArray.length > 0) {
                await redisService.delMultiple(keysArray);
            }
            if (tagKeysToDelete.length > 0) {
                await redisService.delMultiple(tagKeysToDelete);
            }
        } catch (error: any) {
            logger.error('Failed to invalidate cache tags', {
                tags,
                error: error?.message
            });
        }
    }

    /**
     * Associate a cache key with a set of tags.
     */
    async tagKey(key: string, tags: string[], ttlSeconds: number = 3600): Promise<void> {
        if (!tags || tags.length === 0) return;
        try {
            for (const rawTag of tags) {
                const tag = rawTag.startsWith('tag:') ? rawTag : `tag:${rawTag}`;
                await redisService.sadd(tag, key);
                await redisService.expire(tag, ttlSeconds * 2);
            }
        } catch (error: any) {
            logger.warn('Failed to tag cache key', { key, tags, error: error?.message });
        }
    }

    /**
     * Purge all API response caches for a specific user.
     * Uses actor prefix: redis:api:${userId}:*
     */
    async invalidateUserCache(userId: string): Promise<void> {
        if (!userId) return;
        try {
            await redisService.clearPattern(`redis:api:${userId}:*`);
            await redisService.del(`user:session:${userId}`);
        } catch (error: any) {
            logger.error('Failed to invalidate user cache', { userId, error: error?.message });
        }
    }

    /**
     * Invalidate executive dashboard KPIs and high-level summaries.
     */
    async invalidateDashboardKpis(): Promise<void> {
        await this.invalidateTags([
            'tag:dashboard_kpis',
            'tag:executive_analytics',
            'tag:manager_dashboard'
        ]);
        await redisService.clearPattern('analytics:*');
        await redisService.clearPattern('vc:executive:*');
        await redisService.clearPattern('manager:dashboard:*');
        await redisService.clearPattern('hr:analytics:*');
    }

    /**
     * Invalidate staff roster, directory, and related KPI summaries.
     * Triggered on StaffProfile or StaffPosting creation/update/deletion.
     */
    async invalidateStaffRoster(): Promise<void> {
        await this.invalidateTags([
            'tag:staff_roster',
            'tag:dashboard_kpis',
            'tag:due_for_promotion'
        ]);
        await redisService.clearPattern('staff:*');
        await redisService.clearPattern('analytics:*');
        await redisService.clearPattern('hr:analytics:*');
    }

    /**
     * Invalidate staff postings and dual-control docket queues.
     * Triggered on Maker imputation or Registrar authorizer action.
     */
    async invalidateStaffPostings(): Promise<void> {
        await this.invalidateTags([
            'tag:staff_postings',
            'tag:pending_postings_docket',
            'tag:staff_roster',
            'tag:dashboard_kpis'
        ]);
        await redisService.clearPattern('registrar:*');
        await redisService.clearPattern('staff:*');
        await redisService.clearPattern('analytics:*');
    }

    /**
     * Invalidate academic teaching workload allocations and dockets.
     * Triggered on CourseWorkloadAllocation creation or updates.
     */
    async invalidateWorkload(departmentId?: string): Promise<void> {
        const tags = [
            'tag:workload_all',
            'tag:dean_workload_docket'
        ];
        if (departmentId) {
            tags.push(`tag:workload_${departmentId}`);
        }
        await this.invalidateTags(tags);
    }

    /**
     * Invalidate Institutional Multi-Tier Routing Docket.
     * Triggered on Staff submit/rewrite, Director vetting, Registry acknowledgment, or Registrar action.
     */
    async invalidateInstitutionalApplications(): Promise<void> {
        await this.invalidateTags([
            'tag:institutional_applications',
            'tag:pending_applications_docket',
            'tag:registry_dockets',
            'tag:dashboard_kpis'
        ]);
        await redisService.clearPattern('applications:*');
        await redisService.clearPattern('registry:*');
        await redisService.clearPattern('registrar:*');
    }

    /**
     * Invalidate File Custody, Intake Folio, and Dispatch Release queues.
     * Triggered on Requisition lodgment, Registry acknowledgment, Registrar clearance, or handover.
     */
    async invalidateFileRequisitions(): Promise<void> {
        await this.invalidateTags([
            'tag:file_requisitions',
            'tag:pending_file_docket',
            'tag:registry_dockets',
            'tag:dashboard_kpis'
        ]);
        await redisService.clearPattern('file-requests:*');
        await redisService.clearPattern('registry:*');
        await redisService.clearPattern('registrar:*');
    }

    /**
     * Invalidate Promotion Maturity, APER appraisals, and annual batches.
     */
    async invalidatePromotions(): Promise<void> {
        await this.invalidateTags([
            'tag:due_for_promotion',
            'tag:promotion_records',
            'tag:dashboard_kpis'
        ]);
        await redisService.clearPattern('staff:promotions:*');
        await redisService.clearPattern('analytics:*');
    }

    /**
     * General docket invalidator for Maker-Checker dual control governance.
     */
    async invalidateDocket(docketType: string, docketId?: string): Promise<void> {
        const tags = [`tag:docket_${docketType}`];
        if (docketId) {
            tags.push(`tag:docket_${docketType}_${docketId}`);
        }
        await this.invalidateTags(tags);
    }
}

export const cacheInvalidationService = new CacheInvalidationService();
