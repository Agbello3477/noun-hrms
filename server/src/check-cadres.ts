import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const profiles = await prisma.staffProfile.findMany({
        select: {
            cadre: true,
            user: {
                select: {
                    email: true,
                    name: true,
                    role: true
                }
            }
        }
    });
    console.log(JSON.stringify(profiles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
