import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import { Role, Cadre, Department } from '@prisma/client';

/**
 * Ensures the University Registrar user account and profile exist in the database with staffId '00002'.
 * Automatically executed on server bootstrap so production databases are updated on deployment.
 */
export async function ensureRegistrarAccount(): Promise<void> {
    try {
        const email = 'registrar@noun.edu.ng';
        const staffId = '00002';
        const defaultPassword = 'password123';

        console.log(`[Registrar Seeder] Verifying Registrar account (${email}, Staff ID: ${staffId})...`);

        // Check if user already exists
        let user = await prisma.user.findUnique({
            where: { email }
        });

        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        if (!user) {
            console.log(`[Registrar Seeder] Creating new Registrar user (${email})...`);
            user = await prisma.user.create({
                data: {
                    email,
                    name: 'University Registrar',
                    password: hashedPassword,
                    role: Role.REGISTRAR,
                    isActive: true,
                    mustChangePassword: false,
                }
            });
        } else {
            // Ensure role and active status are up to date
            if (user.role !== Role.REGISTRAR || !user.isActive) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        role: Role.REGISTRAR,
                        isActive: true
                    }
                });
            }
        }

        // Check if another profile inadvertently holds staffId 00002
        const conflictingProfile = await prisma.staffProfile.findFirst({
            where: {
                staffId,
                userId: { not: user.id }
            }
        });

        if (conflictingProfile) {
            console.warn(`[Registrar Seeder] Reassigning conflicting staffId ${staffId} from profile ${conflictingProfile.id}...`);
            await prisma.staffProfile.update({
                where: { id: conflictingProfile.id },
                data: { staffId: `OLD-${staffId}-${Date.now().toString().slice(-4)}` }
            });
        }

        // Upsert the StaffProfile for the Registrar
        const existingProfile = await prisma.staffProfile.findUnique({
            where: { userId: user.id }
        });

        // Find HQ Study Center if available
        const hqCenter = await prisma.studyCenter.findFirst({
            where: { code: 'HQ-001' }
        });

        if (!existingProfile) {
            await prisma.staffProfile.create({
                data: {
                    userId: user.id,
                    staffId,
                    surname: 'Registrar',
                    otherNames: 'University',
                    title: 'Mr.',
                    rank: 'University Registrar',
                    level: 'CONTISS 15',
                    step: '09',
                    cadre: Cadre.ADMINISTRATIVE,
                    department: Department.REGISTRY_MAIN,
                    centerId: hqCenter?.id || undefined,
                    status: 'ACTIVE',
                    accountStatus: 'CLEARED_ACTIVE',
                    isActivated: true,
                    voipExtension: '1000',
                    emailPersonal: 'registrar.office@noun.edu.ng'
                }
            });
            console.log(`[Registrar Seeder] Created staff profile for Registrar with Staff ID ${staffId}.`);
        } else {
            await prisma.staffProfile.update({
                where: { userId: user.id },
                data: {
                    staffId,
                    surname: existingProfile.surname || 'Registrar',
                    otherNames: existingProfile.otherNames || 'University',
                    title: existingProfile.title || 'Mr.',
                    rank: 'University Registrar',
                    level: 'CONTISS 15',
                    cadre: Cadre.ADMINISTRATIVE,
                    department: Department.REGISTRY_MAIN,
                    status: 'ACTIVE',
                    accountStatus: 'CLEARED_ACTIVE',
                    isActivated: true,
                    voipExtension: existingProfile.voipExtension || '1000'
                }
            });
            console.log(`[Registrar Seeder] Updated staff profile for Registrar with Staff ID ${staffId}.`);
        }

        console.log(`[Registrar Seeder] ✅ Registrar account successfully provisioned: ${email} (Staff ID: ${staffId}, Role: REGISTRAR).`);
    } catch (err: any) {
        console.error('[Registrar Seeder] ⚠️ Encountered issue while provisioning Registrar account:', err?.message || err);
    }
}
