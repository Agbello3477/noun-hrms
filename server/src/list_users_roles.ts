import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            name: true,
            staffProfile: {
                select: {
                    cadre: true,
                    unitId: true,
                    centerId: true,
                    unit: { select: { name: true, type: true } },
                    studyCenter: { select: { name: true } }
                }
            }
        }
    });
    console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
