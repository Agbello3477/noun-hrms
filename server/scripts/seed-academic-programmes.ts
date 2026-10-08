import dotenv from 'dotenv';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `../.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { PrismaClient, Cadre, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ACADEMIC_TAXONOMY, SAMPLE_COURSES } from '../src/constants/academicTaxonomy';

const prisma = new PrismaClient();

export async function seedAcademicHierarchy() {
  console.log('🏛️ Seeding National Open University of Nigeria Academic Taxonomy (146 Programmes)...');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  let totalProgrammesCount = 0;

  // 1. Seed Faculties, Departments, and Programmes
  for (const facultyData of ACADEMIC_TAXONOMY) {
    // Upsert Dean user account if provided
    let deanUserId: string | null = null;
    if (facultyData.deanEmail) {
      const deanUser = await prisma.user.upsert({
        where: { email: facultyData.deanEmail },
        update: { role: Role.UNIT_HEAD },
        create: {
          email: facultyData.deanEmail,
          password: defaultPasswordHash,
          name: `Dean, ${facultyData.name}`,
          role: Role.UNIT_HEAD,
          staffProfile: {
            create: {
              staffId: `DEAN-${facultyData.id.toUpperCase()}`,
              surname: 'Dean',
              otherNames: facultyData.name.replace('Faculty of ', ''),
              title: 'Prof.',
              rank: 'Professor / Dean of Faculty',
              cadre: Cadre.ACADEMIC,
              currentAcademicRank: 'PROFESSOR',
              status: 'ACTIVE',
              accountStatus: 'CLEARED_ACTIVE',
            },
          },
        },
      });
      deanUserId = deanUser.id;
    }

    // Upsert Faculty
    await prisma.faculty.upsert({
      where: { id: facultyData.id },
      update: {
        facultyCode: facultyData.facultyCode,
        name: facultyData.name,
        deanId: deanUserId,
      },
      create: {
        id: facultyData.id,
        facultyCode: facultyData.facultyCode,
        name: facultyData.name,
        deanId: deanUserId,
      },
    });

    // Upsert Departments
    for (const deptData of facultyData.departments) {
      let hodUserId: string | null = null;
      if (deptData.hodEmail) {
        const hodUser = await prisma.user.upsert({
          where: { email: deptData.hodEmail },
          update: { role: Role.UNIT_HEAD },
          create: {
            email: deptData.hodEmail,
            password: defaultPasswordHash,
            name: `HOD, ${deptData.name}`,
            role: Role.UNIT_HEAD,
            staffProfile: {
              create: {
                staffId: `HOD-${deptData.id}`,
                surname: 'HOD',
                otherNames: deptData.name,
                title: 'Dr.',
                rank: 'Senior Lecturer / Head of Department',
                cadre: Cadre.ACADEMIC,
                currentAcademicRank: 'SENIOR_LECTURER',
                status: 'ACTIVE',
                accountStatus: 'CLEARED_ACTIVE',
              },
            },
          },
        });
        hodUserId = hodUser.id;
      }

      await prisma.department.upsert({
        where: { id: deptData.id },
        update: {
          facultyId: facultyData.id,
          name: deptData.name,
          hodId: hodUserId,
        },
        create: {
          id: deptData.id,
          facultyId: facultyData.id,
          name: deptData.name,
          hodId: hodUserId,
        },
      });

      // Upsert Programmes
      for (const prog of deptData.programmes) {
        totalProgrammesCount++;
        await prisma.academicProgramme.upsert({
          where: { id: prog.id },
          update: {
            programmeCode: prog.programmeCode,
            name: prog.name,
            degreeTitle: prog.degreeTitle,
            programmeDescription: prog.programmeDescription,
            departmentId: deptData.id,
            facultyId: facultyData.id,
            level: prog.level,
            isActive: true,
            title: prog.name,
            code: prog.programmeCode,
            facultyName: facultyData.name,
          },
          create: {
            id: prog.id,
            programmeCode: prog.programmeCode,
            name: prog.name,
            degreeTitle: prog.degreeTitle,
            programmeDescription: prog.programmeDescription,
            departmentId: deptData.id,
            facultyId: facultyData.id,
            level: prog.level,
            isActive: true,
            title: prog.name,
            code: prog.programmeCode,
            facultyName: facultyData.name,
          },
        });
      }
    }
  }

  // 2. Seed Academic Courses
  console.log('📚 Seeding Sample Academic Courses...');
  for (const course of SAMPLE_COURSES) {
    await prisma.academicCourse.upsert({
      where: { courseCode: course.courseCode },
      update: {
        courseTitle: course.courseTitle,
        creditUnits: course.creditUnits,
        lectureHours: course.lectureHours,
        tutorialHours: course.tutorialHours,
        practicalHours: course.practicalHours,
        programmeId: course.programmeId,
        departmentId: course.departmentId,
        semester: course.semester,
        session: course.session,
        level: course.level,
      },
      create: {
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        creditUnits: course.creditUnits,
        lectureHours: course.lectureHours,
        tutorialHours: course.tutorialHours,
        practicalHours: course.practicalHours,
        programmeId: course.programmeId,
        departmentId: course.departmentId,
        semester: course.semester,
        session: course.session,
        level: course.level,
      },
    });
  }

  console.log(`✅ Academic Taxonomy Ingestion Complete! Total Programmes Seeded: ${totalProgrammesCount}`);
}

if (require.main === module) {
  seedAcademicHierarchy()
    .catch((e) => {
      console.error('Error during academic seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
