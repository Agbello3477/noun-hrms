
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
    const csvPath = path.join(__dirname, 'data', 'List of Programme.csv');

    // Check if Data exists
    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found at:', csvPath);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    console.log(`Found ${records.length} programmes. Importing...`);

    for (const record of records as any[]) {
        // Expected columns: Faculty,Department,Programme Title,Code
        // Map CSV fields to Prisma model

        await prisma.academicProgramme.create({
            data: {
                title: record['Programme Title'],
                code: record['Code'] || null,
                faculty: record['Faculty']
            }
        });
        process.stdout.write('.');
    }

    console.log('\nSeeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
