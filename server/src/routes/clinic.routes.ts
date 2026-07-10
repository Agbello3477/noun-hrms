import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import {
    createPatientFile,
    searchPatientFile,
    createEncounter,
    submitTriage,
    submitConsultation,
    submitLabResults,
    dispensePrescription,
    getEncounters,
    getInventory,
    updateInventory
} from '../controllers/clinic.controller';
import { Role } from '@prisma/client';

const router = Router();

router.use(verifyToken);

// Patient File management
router.post('/patients', requireRole([Role.CLINIC_NURSE, Role.CLINIC_DOCTOR, Role.SUPER_USER, Role.ADMIN]), createPatientFile);
router.get('/patients', requireRole([Role.CLINIC_NURSE, Role.CLINIC_DOCTOR, Role.CLINIC_LAB_SCIENTIST, Role.CLINIC_PHARMACIST, Role.SUPER_USER, Role.ADMIN]), searchPatientFile);

// Encounters / Visit flows
router.get('/encounters', requireRole([Role.CLINIC_NURSE, Role.CLINIC_DOCTOR, Role.CLINIC_LAB_SCIENTIST, Role.CLINIC_PHARMACIST, Role.SUPER_USER, Role.ADMIN]), getEncounters);
router.post('/encounters', requireRole([Role.CLINIC_NURSE, Role.SUPER_USER, Role.ADMIN]), createEncounter);

// Nurse Triage
router.post('/triage', requireRole([Role.CLINIC_NURSE, Role.SUPER_USER, Role.ADMIN]), submitTriage);

// Doctor Consultation
router.post('/consultation', requireRole([Role.CLINIC_DOCTOR, Role.SUPER_USER, Role.ADMIN]), submitConsultation);

// Lab results
router.post('/lab', requireRole([Role.CLINIC_LAB_SCIENTIST, Role.SUPER_USER, Role.ADMIN]), submitLabResults);

// Pharmacist Dispense
router.post('/dispense', requireRole([Role.CLINIC_PHARMACIST, Role.SUPER_USER, Role.ADMIN]), dispensePrescription);

// Inventory
router.get('/inventory', requireRole([Role.CLINIC_PHARMACIST, Role.CLINIC_DOCTOR, Role.SUPER_USER, Role.ADMIN]), getInventory);
router.post('/inventory', requireRole([Role.CLINIC_PHARMACIST, Role.SUPER_USER, Role.ADMIN]), updateInventory);

export default router;
