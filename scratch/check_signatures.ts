import prisma from '../server/src/prisma';

async function checkSignatures() {
    const profiles = await prisma.staffProfile.findMany({
        where: {
            signatureUrl: {
                not: null
            }
        },
        select: {
            userId: true,
            signatureUrl: true,
            user: {
                select: {
                    name: true,
                    role: true
                }
            }
        }
    });

    console.log('--- Current Signatures in Database ---');
    console.log(profiles);
}

checkSignatures().catch(console.error);
