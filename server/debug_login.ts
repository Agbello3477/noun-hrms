
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function debugLogin() {
    const email = 'admin@noun.edu.ng';
    const password = 'password123';

    console.log(`Checking user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error('❌ User NOT FOUND in database.');
        return;
    }

    console.log('✅ User found:', user.email, user.role);
    console.log('Stored Hash:', user.password);

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
        console.log('✅ Password MATCHES!');
    } else {
        console.error('❌ Password DOES NOT match.');
    }
}

debugLogin()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
