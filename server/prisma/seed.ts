import { PrismaClient, Role, Department } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NOUN_STRUCTURE } from './data/noun_structure';

const prisma = new PrismaClient();

async function main() {

    const password = await bcrypt.hash('password123', 10);

    // 1. System Admin
    // 1. System Admin
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@noun.edu.ng' },
        update: { role: Role.ADMIN },
        create: {
            email: 'admin@noun.edu.ng',
            name: 'System Administrator',
            password,
            role: Role.ADMIN,
        },
    });

    await prisma.staffProfile.upsert({
        where: { userId: adminUser.id },
        update: {},
        create: {
            userId: adminUser.id,
            department: Department.REGISTRY_MAIN,
            level: 'Director'
        }
    });

    // 2. Study Centers
    const lagosCenter = await prisma.studyCenter.upsert({
        where: { code: 'LAG-001' },
        update: {},
        create: { name: 'Lagos Study Center', code: 'LAG-001', address: 'Victoria Island, Lagos' }
    });

    const abujaCenter = await prisma.studyCenter.upsert({
        where: { code: 'HQ-001' },
        update: {},
        create: { name: 'Abuja Head Quarters', code: 'HQ-001', address: 'Jabi, Abuja' }
    });

    // 3. Registry HR Officer (HQ)
    await prisma.user.upsert({
        where: { email: 'registry@noun.edu.ng' },
        update: {},
        create: {
            email: 'registry@noun.edu.ng',
            name: 'Registry Officer',
            password,
            role: Role.STAFF, // Staff Role but Registry Dept
            staffProfile: {
                create: {
                    department: Department.REGISTRY_HR,
                    level: 'Senior Admin Officer',
                    centerId: abujaCenter.id
                }
            }
        }
    });

    // 4. Bursary Auditor (HQ)
    await prisma.user.upsert({
        where: { email: 'bursary@noun.edu.ng' },
        update: {},
        create: {
            email: 'bursary@noun.edu.ng',
            name: 'Chief Auditor',
            password,
            role: Role.STAFF,
            staffProfile: {
                create: {
                    department: Department.BURSARY_AUDIT,
                    level: 'Chief Accountant',
                    centerId: abujaCenter.id
                }
            }
        }
    });

    // 5. Study Center Manager (Lagos)
    await prisma.user.upsert({
        where: { email: 'manager@noun.edu.ng' },
        update: {},
        create: {
            email: 'manager@noun.edu.ng',
            name: 'Lagos Center Director',
            password,
            role: Role.STUDY_CENTER_MANAGER,
            staffProfile: {
                create: {
                    department: null,
                    level: 'Director',
                    centerId: lagosCenter.id
                }
            }
        }
    });

    // 6. Seed full NOUN Structure
    console.log('Seeding Study Centers...');
    for (const [zone, centers] of Object.entries(NOUN_STRUCTURE.HQ_ZONES)) {
        for (const centerName of (centers as string[])) {
            const code = centerName.toUpperCase().replace(/\s+/g, '-').slice(0, 10);
            await prisma.studyCenter.upsert({
                where: { code },
                update: {},
                create: {
                    name: centerName + ' Study Centre',
                    code,
                    address: `${centerName}, ${zone}`
                }
            });
        }
    }

    console.log('Seeding Units (Faculties & Directorates)...');

    // Seed Faculties
    for (const faculty of NOUN_STRUCTURE.HQ_UNITS.FACULTIES) {
        const code = `FAC-${faculty.toUpperCase().replace(/\s+/g, '-').slice(0, 5)}`;
        await prisma.unit.upsert({
            where: { code },
            update: {},
            create: {
                name: `Faculty of ${faculty}`,
                type: 'FACULTY',
                code
            }
        });
    }

    // Seed Directorates
    for (const directorate of NOUN_STRUCTURE.HQ_UNITS.DIRECTORATES) {
        const code = `DIR-${directorate.toUpperCase().replace(/\s+/g, '-').slice(0, 5)}`;
        await prisma.unit.upsert({
            where: { code },
            update: {},
            create: {
                name: directorate,
                type: 'DIRECTORATE',
                code
            }
        });
    }

    // 7. Seed Salary Structure (CONTISS)
    console.log('Seeding Salary Scales...');
    const contiss = await prisma.salaryScale.upsert({
        where: { name: 'CONTISS' },
        update: {},
        create: {
            name: 'CONTISS',
            description: 'Consolidated Tertiary Institutions Salary Structure'
        }
    });

    // Seed Levels 07 - 15 (Simplified)
    const levels = ['07', '08', '09', '11', '13', '15'];
    const steps = ['01', '02', '03'];

    // Base salary logic for demo
    for (const level of levels) {
        const baseForLevel = parseInt(level) * 100000; // e.g. 700k
        for (const step of steps) {
            const increment = parseInt(step) * 5000;
            const consolidated = baseForLevel + increment;

            // Split Cons into Basic (40%) and Allowances (60%)
            const basic = consolidated * 0.4;
            const leftovers = consolidated - basic;

            await prisma.salaryLevel.upsert({
                where: {
                    scaleId_level_step: {
                        scaleId: contiss.id,
                        level: level,
                        step: step
                    }
                },
                update: {},
                create: {
                    scaleId: contiss.id,
                    level: level,
                    step: step,
                    basicSalary: basic,
                    rent: leftovers * 0.4,
                    transport: leftovers * 0.2,
                    meal: leftovers * 0.1,
                    utility: leftovers * 0.1,
                    entertainment: leftovers * 0.2,
                    consolidated: consolidated
                }
            });
        }
    }

    console.log('Seeding completed with Demo Users and NOUN Structure.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
