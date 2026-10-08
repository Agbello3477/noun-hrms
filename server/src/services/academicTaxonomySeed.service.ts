import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import { ProgrammeLevel, AcademicSemester, Cadre, Role } from '@prisma/client';
import { ACADEMIC_TAXONOMY, SAMPLE_COURSES } from '../constants/academicTaxonomy';

/**
 * Ensures the full NOUN Academic Structure (9 Faculties, 36+ Departments, 146 Academic Programmes)
 * is seeded and synchronized in the database upon server startup.
 */
export async function ensureAcademicTaxonomy(): Promise<void> {
  try {
    const existingProgCount = await prisma.academicProgramme.count();
    if (existingProgCount >= 146) {
      console.log(`[Academic Taxonomy Seeder] ✅ All 146 Academic Programmes already present in database (Count: ${existingProgCount}).`);
      return;
    }

    console.log(`[Academic Taxonomy Seeder] Ingesting/updating Academic Taxonomy (Found ${existingProgCount}/146 Programmes)...`);

    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    let seededCount = 0;

    for (const facultyData of ACADEMIC_TAXONOMY) {
      // Upsert Dean account
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
          seededCount++;
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

    // Seed sample academic courses
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

    console.log(`[Academic Taxonomy Seeder] ✅ Ingested/synchronized ${seededCount} academic programmes into database.`);
  } catch (error: any) {
    console.error('[Academic Taxonomy Seeder] ⚠️ Error during startup academic taxonomy sync:', error?.message || error);
  }
}
