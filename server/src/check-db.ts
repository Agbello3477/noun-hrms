import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const units = await prisma.unit.findMany();
    console.log('Units in DB:', JSON.stringify(units, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
