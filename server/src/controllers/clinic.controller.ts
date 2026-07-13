import { Request, Response } from 'express';
import { prisma } from '../prisma-replica';
import { encrypt, decrypt } from '../services/encryption';
import { Role } from '@prisma/client';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
    };
}

export const createPatientFile = async (req: AuthRequest, res: Response) => {
    const { patientId, name, gender, dob, bloodGroup, genotype, allergies, medicalHistory } = req.body;

    try {
        // Search if employee exists in system
        const staff = await prisma.staffProfile.findUnique({
            where: { staffId: patientId },
            include: { user: true }
        });

        const encryptedHistory = encrypt(medicalHistory || 'None');

        const patientFile = await prisma.clinicPatientFile.create({
            data: {
                patientId,
                name: name || (staff ? `${staff.surname || ''} ${staff.otherNames || ''}`.trim() : 'Unknown Patient'),
                gender,
                dob: new Date(dob),
                bloodGroup,
                genotype,
                allergies,
                encryptedMedicalHistory: encryptedHistory,
                userId: staff?.userId || null
            }
        });

        res.status(201).json({
            message: 'Patient File Created Successfully',
            patientFile: {
                ...patientFile,
                medicalHistory: medicalHistory || 'None'
            }
        });
    } catch (error: any) {
        res.status(450).json({ message: error.message || 'Failed to create patient file' });
    }
};

export const searchPatientFile = async (req: AuthRequest, res: Response) => {
    const { query } = req.query;

    try {
        const files = await prisma.clinicPatientFile.findMany({
            where: {
                OR: [
                    { patientId: { contains: String(query), mode: 'insensitive' } },
                    { name: { contains: String(query), mode: 'insensitive' } }
                ]
            },
            include: {
                encounters: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        const decryptedFiles = files.map(file => ({
            ...file,
            medicalHistory: decrypt(file.encryptedMedicalHistory)
        }));

        res.json(decryptedFiles);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to search patient files' });
    }
};

export const createEncounter = async (req: AuthRequest, res: Response) => {
    const { patientFileId } = req.body;

    try {
        const encounter = await prisma.clinicEncounter.create({
            data: {
                patientFileId,
                status: 'TRIAGE'
            }
        });
        res.status(201).json(encounter);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to start clinical encounter' });
    }
};

export const submitTriage = async (req: AuthRequest, res: Response) => {
    const { encounterId, bp, temperature, weight, symptoms } = req.body;
    const nurseId = req.user?.id;

    try {
        // Fetch patient info for the notification message
        const encounter = await prisma.clinicEncounter.findUnique({
            where: { id: encounterId },
            include: { patientFile: true }
        });

        const updated = await prisma.clinicEncounter.update({
            where: { id: encounterId },
            data: {
                bp,
                temperature: parseFloat(temperature),
                weight: parseFloat(weight),
                symptoms,
                status: 'AWAITING_DOCTOR',
                triagedById: nurseId,
                triagedAt: new Date()
            }
        });

        // Notify all doctors in the system
        if (encounter) {
            const doctors = await prisma.user.findMany({
                where: { role: 'CLINIC_DOCTOR' },
                select: { id: true }
            });
            await prisma.notification.createMany({
                data: doctors.map(d => ({
                    userId: d.id,
                    title: '🩺 New Patient in Consultation Queue',
                    message: `${encounter.patientFile?.name || 'A patient'}'s vitals have been recorded. Awaiting your consultation.`,
                    type: 'INFO'
                }))
            });
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to record vitals triage data' });
    }
};

export const submitConsultation = async (req: AuthRequest, res: Response) => {
    const { encounterId, clinicalNotes, diagnoses, labTests, prescriptions } = req.body;
    const doctorId = req.user?.id;

    try {
        let status = 'CLOSED';
        if (labTests) {
            status = 'LAB_REQUESTED';
        } else if (prescriptions) {
            status = 'PHARMACY_REQUESTED';
        }

        // Fetch patient info for notifications
        const encounter = await prisma.clinicEncounter.findUnique({
            where: { id: encounterId },
            include: { patientFile: true }
        });

        const updated = await prisma.clinicEncounter.update({
            where: { id: encounterId },
            data: {
                clinicalNotes,
                diagnoses,
                labTests,
                prescriptions,
                status,
                consultedById: doctorId,
                consultedAt: new Date()
            }
        });

        // Notify the relevant department
        if (encounter) {
            const patientName = encounter.patientFile?.name || 'A patient';

            if (status === 'LAB_REQUESTED') {
                // Notify all lab scientists
                const labStaff = await prisma.user.findMany({
                    where: { role: 'CLINIC_LAB_SCIENTIST' },
                    select: { id: true }
                });
                await prisma.notification.createMany({
                    data: labStaff.map(u => ({
                        userId: u.id,
                        title: '🔬 New Lab Test Ordered',
                        message: `Doctor has ordered lab tests for ${patientName}: ${labTests}`,
                        type: 'INFO'
                    }))
                });
            } else if (status === 'PHARMACY_REQUESTED') {
                // Notify all pharmacists
                const pharmacists = await prisma.user.findMany({
                    where: { role: 'CLINIC_PHARMACIST' },
                    select: { id: true }
                });
                await prisma.notification.createMany({
                    data: pharmacists.map(u => ({
                        userId: u.id,
                        title: '💊 New Prescription Ready',
                        message: `Prescription issued for ${patientName}. Please dispense medications.`,
                        type: 'INFO'
                    }))
                });
            }
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to submit consultation details' });
    }
};

export const submitLabResults = async (req: AuthRequest, res: Response) => {
    const { encounterId, labResults } = req.body;
    const labScientistId = req.user?.id;

    try {
        const encounter = await prisma.clinicEncounter.findUnique({
            where: { id: encounterId },
            include: { patientFile: true }
        });

        if (!encounter) return res.status(404).json({ message: 'Encounter not found' });

        const updated = await prisma.clinicEncounter.update({
            where: { id: encounterId },
            data: {
                labResults,
                status: 'CONSULTATION', // Route back to doctor for consultation
                labScientistId,
                labCompletedAt: new Date()
            }
        });

        // Trigger system notification to the Doctor who ordered the test
        if (encounter.consultedById) {
            await prisma.notification.create({
                data: {
                    userId: encounter.consultedById,
                    title: 'Laboratory Test Results Completed',
                    message: `Lab results are ready for patient ${encounter.patientFile.name}.`,
                    type: 'SUCCESS'
                }
            });
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to upload laboratory results' });
    }
};

export const dispensePrescription = async (req: AuthRequest, res: Response) => {
    const { encounterId, items } = req.body; // Array of { name, quantity }
    const pharmacistId = req.user?.id;

    try {
        // Fulfill prescription and deduct inventory
        for (const item of (items || [])) {
            const stock = await prisma.clinicInventory.findUnique({
                where: { name: item.name }
            });
            if (stock) {
                await prisma.clinicInventory.update({
                    where: { name: item.name },
                    data: {
                        quantity: Math.max(0, stock.quantity - item.quantity)
                    }
                });
            }
        }

        const updated = await prisma.clinicEncounter.update({
            where: { id: encounterId },
            data: {
                pharmacyStatus: 'FULFILLED',
                status: 'CLOSED', // Flow is closed
                pharmacistId,
                pharmacyFulfilledAt: new Date()
            }
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to dispense prescriptions' });
    }
};

export const getEncounters = async (req: AuthRequest, res: Response) => {
    const { status } = req.query;

    try {
        const encounters = await prisma.clinicEncounter.findMany({
            where: status ? { status: String(status) } : {},
            include: {
                patientFile: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(encounters);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch encounters' });
    }
};

export const getInventory = async (req: AuthRequest, res: Response) => {
    try {
        const inventory = await prisma.clinicInventory.findMany();
        res.json(inventory);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch inventory' });
    }
};

export const updateInventory = async (req: AuthRequest, res: Response) => {
    const { name, quantity, unit } = req.body;

    try {
        const item = await prisma.clinicInventory.upsert({
            where: { name },
            update: { quantity: parseInt(quantity) },
            create: { name, quantity: parseInt(quantity), unit }
        });
        res.json(item);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to update stock' });
    }
};
