const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const memos = await prisma.memo.findMany({
        include: {
            sender: {
                select: { name: true, email: true }
            },
            recipient: {
                select: {
                    name: true,
                    email: true,
                    staffProfile: {
                        select: { staffId: true }
                    }
                }
            },
            responses: {
                include: {
                    staff: {
                        select: {
                            name: true,
                            email: true,
                            staffProfile: {
                                select: {
                                    staffId: true,
                                    level: true,
                                    step: true,
                                    cadre: true,
                                    unit: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    console.log(JSON.stringify(memos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
