const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const profiles = await prisma.staffProfile.findMany({
        where: { signatureUrl: { not: null } },
        select: {
            userId: true,
            signatureUrl: true,
            user: { select: { name: true, role: true } }
        }
    });
    console.log(profiles);
}
run().catch(console.error).finally(() => prisma.$disconnect());
