import { PrismaClient } from '@prisma/client';
import { ensureRegistrarAccount } from '../src/services/registrarSeed.service';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding / Verifying University Registrar Account...');
    await ensureRegistrarAccount();
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
