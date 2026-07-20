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
        update: {
            role: Role.HR_ADMIN
        },
        create: {
            email: 'registry@noun.edu.ng',
            name: 'Registry Officer',
            password,
            role: Role.HR_ADMIN, // HR_ADMIN role
            staffProfile: {
                create: {
                    department: Department.REGISTRY_HR,
                    level: 'Senior Admin Officer',
                    centerId: abujaCenter.id
                }
            }
        }
    });

    // VC User
    const vcUser = await prisma.user.upsert({
        where: { email: 'vc@noun.edu.ng' },
        update: {
            role: Role.VICE_CHANCELLOR
        },
        create: {
            email: 'vc@noun.edu.ng',
            name: 'Prof. Vice Chancellor',
            password,
            role: Role.VICE_CHANCELLOR,
            staffProfile: {
                create: {
                    level: 'CONTISS 15',
                    rank: 'Vice Chancellor',
                    centerId: abujaCenter.id,
                    status: 'ACTIVE'
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

    // Seed Clinic Staff Users
    await prisma.user.upsert({
        where: { email: 'nurse@noun.edu.ng' },
        update: {},
        create: {
            email: 'nurse@noun.edu.ng',
            name: 'Nurse Janet Adebayo',
            password,
            role: Role.CLINIC_NURSE,
            staffProfile: {
                create: { rank: 'Senior Nursing Officer', level: 'CONTISS 09', centerId: abujaCenter.id, status: 'ACTIVE' }
            }
        }
    });

    await prisma.user.upsert({
        where: { email: 'doctor@noun.edu.ng' },
        update: {},
        create: {
            email: 'doctor@noun.edu.ng',
            name: 'Dr. Chidi Obi',
            password,
            role: Role.CLINIC_DOCTOR,
            staffProfile: {
                create: { rank: 'Principal Medical Officer', level: 'CONTISS 12', centerId: abujaCenter.id, status: 'ACTIVE' }
            }
        }
    });

    await prisma.user.upsert({
        where: { email: 'lab@noun.edu.ng' },
        update: {},
        create: {
            email: 'lab@noun.edu.ng',
            name: 'Scientist Musa Bello',
            password,
            role: Role.CLINIC_LAB_SCIENTIST,
            staffProfile: {
                create: { rank: 'Laboratory Scientist I', level: 'CONTISS 08', centerId: abujaCenter.id, status: 'ACTIVE' }
            }
        }
    });

    await prisma.user.upsert({
        where: { email: 'pharmacist@noun.edu.ng' },
        update: {},
        create: {
            email: 'pharmacist@noun.edu.ng',
            name: 'Pharmacist Aisha Danjuma',
            password,
            role: Role.CLINIC_PHARMACIST,
            staffProfile: {
                create: { rank: 'Pharmacist II', level: 'CONTISS 08', centerId: abujaCenter.id, status: 'ACTIVE' }
            }
        }
    });

    // Seed Security Staff Users
    await prisma.user.upsert({
        where: { email: 'security@noun.edu.ng' },
        update: {},
        create: {
            email: 'security@noun.edu.ng',
            name: 'Chief Security Officer',
            password,
            role: Role.SECURITY_HEAD,
            staffProfile: {
                create: { rank: 'Director of Security Services', level: 'CONTISS 14', centerId: abujaCenter.id, status: 'ACTIVE' }
            }
        }
    });

    await prisma.user.upsert({
        where: { email: 'patrol@noun.edu.ng' },
        update: {},
        create: {
            email: 'patrol@noun.edu.ng',
            name: 'Officer Segun Alao',
            password,
            role: Role.SECURITY_OFFICER,
            staffProfile: {
                create: { rank: 'Patrol Officer', level: 'CONTISS 05', centerId: abujaCenter.id, status: 'ACTIVE' }
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

    const CUSTOM_UNIT_CODES: Record<string, string> = {
        // Map new names to existing codes to perform rename & avoid duplicates
        "Directorate of Academic Registry": "DIR-ACADE",
        "Directorate of Advancement and Linkages": "DIR-ADVAN",
        "Directorate of Internal Audit": "DIR-AUDIT",
        "Centre for Human Resource Development (CHRD)": "DIR-CHRD",
        "Directorate for Entrepreneurship and General Studies (DEAGS)": "DIR-DEAGS",
        "The Regional Training and Research Institute for Distance and Open Learning (RETRIDOL)": "DIR-CENTR",
        "Directorate of Information & Communications Technology": "DIR-ICT",
        "Directorate of Media and Publicity": "DIR-MEDIA",
        "Directorate of Physical Planning and Development": "DIR-PHYSI",
        "Directorate of Research Administration": "DIR-RESEA",
        "Directorate Of Staff Training And Development": "DIR-STD",

        // Rest of existing structures
        "Human Resource Senior Section": "DIR-HR-SR",
        "Human Resource Junior Section": "DIR-HR-JR",
        "Council": "DIR-COUNC",
        "Alumni": "DIR-ALUMN",
        "Student Affairs": "DIR-STUDE",
        "Vice-Chancellor's Office": "DIR-VICE-",
        "Learner Support Services (LSS)": "DIR-LEARN",
        "Bursary": "DIR-BURSA",

        // Unique codes for the brand new Non-Academic Directorates to avoid duplicates/collisions
        "Directorate of Security Services": "DIR-SEC",
        "Directorate of Procurement": "DIR-PROC",
        "Directorate of Quality Assurance": "DIR-QA",
        "Directorate of Works & Services": "DIR-WORKS",
        "Directorate of Protocol & General Services": "DIR-PROT",
        "Directorate of Counselling Services & Career Development": "DIR-COUNS",
        "Directorate of Examination & Assessment": "DIR-EXAM",
        "Directorate of Management Information System (DMIS)": "DIR-DMIS",
        "Software Development Unit": "DIR-SOFT",
        "Directorate of Learning Content Management System": "DIR-LCMS",
        "Directorate of Human Resources": "DIR-HR",

        // Unique codes for brand new Academic Directorates
        "Directorate of Academic Planning (DAP)": "DIR-DAP",
        "African Council on Distance Education Quality Assurance and Accreditation Agency (ACDE-QAAA)": "DIR-ACDE",
        "Student Industrial Work Experience Scheme (SIWES)": "DIR-SIWES",

        // Unique codes for Units
        "Course Material Development Unit": "UNIT-CMDU",
        "SERVICOM Unit": "UNIT-SERVI",
        "Anti-Corruption And Transparency Unit": "UNIT-ACTU",
        "NOUN Information and Call Centre (NICC)": "UNIT-NICC",
        "Manpower Development Unit": "UNIT-MDU",
        "Legal Services": "UNIT-LEGAL",
        "Deputy Registrar(Council)": "UNIT-DRC",
        "Transport and Logistics": "UNIT-TRANS",
        "University Clinic": "UNIT-CLIN",
        "Medical Diagnostic Laboratory": "UNIT-LAB",

        // Unique codes for Research Centers
        "Africa Centre of Excellence on Technology Enhanced Learning (ACETEL)": "RC-ACETEL",
        "Centre of Excellence in Migration and Global Studies (CEMGS)": "RC-CEMGS",
        "Olusegun Obasanjo Centre For African Studies (OOCAS)": "RC-OOCAS"
    };

    // Seed Directorates
    for (const directorate of NOUN_STRUCTURE.HQ_UNITS.DIRECTORATES) {
        const cleanName = directorate.replace(/Directorate of |Faculty of |Centre for |Unit|Directorate for |Directorate Of /gi, '').trim();
        const fallbackCode = `DIR-${cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;
        const code = CUSTOM_UNIT_CODES[directorate] || fallbackCode;
        await prisma.unit.upsert({
            where: { code },
            update: {
                name: directorate,
                type: 'DIRECTORATE'
            },
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
        console.error('Prisma seed warning (non-fatal):', e);
        await prisma.$disconnect();
        process.exit(0);
    });
