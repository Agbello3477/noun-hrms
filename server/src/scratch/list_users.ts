import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { staffProfile: true }
    });
    console.log('--- DATABASE USERS ---');
    for (const u of users) {
        console.log(`Email: ${u.email} | Role: ${u.role} | UnitId: ${u.staffProfile?.unitId} | CenterId: ${u.staffProfile?.centerId}`);
    }
}

main().finally(() => prisma.$disconnect());
