
import { PrismaClient, Role, Department } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Super User...');

    const email = 'superuser@noun.edu.ng';
    const password = 'password123'; // Default strong password for initial access
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or Update Super User
    const superUser = await prisma.user.upsert({
        where: { email },
        update: { role: Role.SUPER_USER },
        create: {
            email,
            name: 'Super User',
            password: hashedPassword,
            role: Role.SUPER_USER,
            isActive: true
        }
    });

    // Ensure Profile Exists
    await prisma.staffProfile.upsert({
        where: { userId: superUser.id },
        update: {},
        create: {
            userId: superUser.id,
            surname: 'Super',
            otherNames: 'User',
            staffId: 'SU-001',
            level: '15',
            step: '09',
            cadre: 'ADMINISTRATIVE',
            department: Department.REGISTRY_MAIN, // Using generic department or create a special one if needed
            emailPersonal: 'superuser@gmail.com'
        }
    });

    console.log(`Super User seeded: ${email} / ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
