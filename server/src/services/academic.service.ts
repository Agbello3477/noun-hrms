import prisma from '../prisma';

export class AcademicService {

    // Publication Management
    static async addPublication(staffId: string, data: { title: string; citation: string; year: number; link?: string; type: string }) {
        // Find staff profile ID
        const staffProfile = await prisma.staffProfile.findUnique({
            where: { id: staffId }
        });

        if (!staffProfile) throw new Error('Staff Profile not found');

        return prisma.publication.create({
            data: {
                staffId: staffProfile.id,
                ...data
            }
        });
    }

    static async getPublications(staffId: string) {
        return prisma.publication.findMany({
            where: { staffId },
            orderBy: { year: 'desc' }
        });
    }

    static async deletePublication(id: string, staffId: string) {
        // Check ownership
        const pub = await prisma.publication.findUnique({ where: { id } });
        if (!pub || pub.staffId !== staffId) {
            throw new Error('Publication not found or unauthorized');
        }
        return prisma.publication.delete({ where: { id } });
    }

    // Sabbatical Eligibility Logic
    static async checkSabbaticalEligibility(userId: string): Promise<{ eligible: boolean; yearsServed: number; message: string }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { staffProfile: true }
        });

        if (!user || !user.staffProfile) throw new Error('User/Profile not found');

        // Logic: Served at least 6 years.
        // Use createdAt for demo purposes, in real life use 'AppointmentDate' from profile if available.
        const startDate = user.createdAt;
        const now = new Date();

        // Calculate years difference
        const diffMs = now.getTime() - startDate.getTime();
        const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

        // For DEMO purposes, let's relax this or hardcode a "Force Eligible" flag check?
        // Let's assume strict rule for now (will return false for new users) but Frontend can show "Projected Eligibility".
        const eligible = diffYears >= 6;

        return {
            eligible,
            yearsServed: parseFloat(diffYears.toFixed(1)),
            message: eligible ? 'Eligible for Sabbatical' : `Service duration insufficient. Requires 6 years (Current: ${diffYears.toFixed(1)} years)`
        };
    }

    // Teaching Allocation
    static async getTeachingWorkload(staffId: string) {
        return prisma.teachingAllocation.findMany({
            where: { staffId },
            include: { course: true }, // Join course details
            orderBy: { session: 'desc' }
        });
    }

    static async allocateTeaching(data: { staffId: string, courseCode: string, session: string, students: number }) {
        // 1. Find or Create Course (Simplified for demo, usually courses are pre-loaded)
        const course = await prisma.course.upsert({
            where: { code: data.courseCode },
            update: {},
            create: {
                code: data.courseCode,
                title: 'Introduction to ODL (Demo)', // Placeholder
                unit: 3,
                semester: 'FIRST'
            }
        });

        // 2. Create Allocation
        return prisma.teachingAllocation.create({
            data: {
                staffId: data.staffId,
                courseId: course.id,
                session: data.session,
                students: data.students
            }
        });
    }
}
