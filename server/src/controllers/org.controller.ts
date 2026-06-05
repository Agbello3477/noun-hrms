
import { Request, Response } from 'express';
import prisma from '../prisma';

export const getOrganizationStructure = async (req: Request, res: Response) => {
    try {
        const centers = await prisma.studyCenter.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true }
        });

        const units = await prisma.unit.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, type: true, code: true }
        });

        res.json({
            centers,
            units
        });
    } catch (error) {
        console.error('Get Org Structure Error:', error);
        res.status(500).json({ message: 'Failed to fetch organization structure' });
    }
};

export const getProgrammes = async (req: Request, res: Response) => {
    try {
        const programmes = await prisma.academicProgramme.findMany({
            orderBy: { title: 'asc' }
        });
        res.json(programmes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching programmes' });
    }
};
