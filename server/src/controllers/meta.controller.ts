import { Request, Response } from 'express';
import prisma from '../prisma';
import { getCachedQuery } from '../utils/dbCache';
import { Cadre } from '@prisma/client';

export const getFaculties = async (req: Request, res: Response) => {
    try {
        const faculties = await getCachedQuery(
            'redis:db:meta:faculties',
            86400, // 24 hours
            async () => {
                // Fetch distinct faculties from programmes
                const programmeFaculties = await prisma.academicProgramme.findMany({
                    select: { faculty: true },
                    distinct: ['faculty']
                });

                // Fetch units of type FACULTY
                const facultyUnits = await prisma.unit.findMany({
                    where: { type: 'FACULTY' },
                    select: { id: true, name: true, code: true }
                });

                const distinctNames = Array.from(new Set([
                    ...programmeFaculties.map(p => p.faculty).filter(Boolean),
                    ...facultyUnits.map(u => u.name)
                ])).sort();

                return distinctNames.map((name, index) => ({
                    id: `FAC-${index + 1}`,
                    name,
                    code: name.split(' ').map(w => w[0]).join('').toUpperCase()
                }));
            },
            ['tag:meta_faculties']
        );

        res.json(faculties);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch faculties', error: error?.message });
    }
};

export const getCadres = async (req: Request, res: Response) => {
    try {
        const cadres = await getCachedQuery(
            'redis:db:meta:cadres',
            86400, // 24 hours
            async () => {
                return Object.values(Cadre).map(val => ({
                    code: val,
                    title: val.charAt(0) + val.slice(1).toLowerCase().replace('_', ' '),
                    description: `NOUN ${val} Cadre Staff Designation`
                }));
            },
            ['tag:meta_cadres']
        );

        res.json(cadres);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch cadres', error: error?.message });
    }
};

export const getProgrammesCatalog = async (req: Request, res: Response) => {
    try {
        const programmes = await getCachedQuery(
            'redis:db:meta:programmes',
            86400, // 24 hours
            async () => {
                return prisma.academicProgramme.findMany({
                    orderBy: { title: 'asc' }
                });
            },
            ['tag:meta_programmes']
        );

        res.json(programmes);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch academic programmes', error: error?.message });
    }
};
