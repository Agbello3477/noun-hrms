import { AcademicWorkloadEngine } from '../services/AcademicWorkloadEngine';

async function runTests() {
  console.log('🧪 Starting Academic Structure & Workload Allocation Engine Unit & Integration Tests...');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Test Cadre Normalization
  console.log('\n--- 1. Testing Cadre Normalization ---');
  assert(AcademicWorkloadEngine.normalizeCadre('Professor') === 'PROFESSOR', 'Normalize "Professor"');
  assert(AcademicWorkloadEngine.normalizeCadre('Associate Professor') === 'ASSOCIATE_PROFESSOR', 'Normalize "Associate Professor"');
  assert(AcademicWorkloadEngine.normalizeCadre('Reader') === 'ASSOCIATE_PROFESSOR', 'Normalize "Reader"');
  assert(AcademicWorkloadEngine.normalizeCadre('Senior Lecturer') === 'SENIOR_LECTURER', 'Normalize "Senior Lecturer"');
  assert(AcademicWorkloadEngine.normalizeCadre('Lecturer I') === 'LECTURER_I', 'Normalize "Lecturer I"');
  assert(AcademicWorkloadEngine.normalizeCadre('Lecturer II') === 'LECTURER_II', 'Normalize "Lecturer II"');
  assert(AcademicWorkloadEngine.normalizeCadre('Assistant Lecturer') === 'ASSISTANT_LECTURER', 'Normalize "Assistant Lecturer"');

  // 2. Test Weekly Contact Hours Calculation
  // Contact = Lecture + Tutorial + (0.5 * Practical)
  console.log('\n--- 2. Testing Contact Hours Calculation ---');
  assert(AcademicWorkloadEngine.calculateContactHours(2, 1, 0) === 3, 'Lecture 2 + Tutorial 1 + Practical 0 = 3 hrs');
  assert(AcademicWorkloadEngine.calculateContactHours(2, 0, 4) === 4, 'Lecture 2 + Tutorial 0 + Practical 4 = 4 hrs (2 practicals = 1 contact)');
  assert(AcademicWorkloadEngine.calculateContactHours(3, 1, 2) === 5, 'Lecture 3 + Tutorial 1 + Practical 2 = 5 hrs');

  // 3. Test ODL Effective Teaching Equivalent (ETE) Calculation
  // ETE = Base Credit Units + max(0, (Enrolled - 200) / 500) * 0.5
  console.log('\n--- 3. Testing ODL Effective Teaching Equivalent (ETE) ---');
  assert(AcademicWorkloadEngine.calculateCourseETE(3, 150) === 3.0, 'Cohort <= 200 has ETE equal to base CU (3.0)');
  assert(AcademicWorkloadEngine.calculateCourseETE(3, 200) === 3.0, 'Cohort 200 has ETE equal to base CU (3.0)');
  assert(AcademicWorkloadEngine.calculateCourseETE(3, 700) === 3.5, 'Cohort 700 has +0.5 ETE bonus (3 + (500/500)*0.5 = 3.5)');
  assert(AcademicWorkloadEngine.calculateCourseETE(3, 1200) === 4.0, 'Cohort 1200 has +1.0 ETE bonus (3 + (1000/500)*0.5 = 4.0)');

  // 4. Test Administrative Rebates
  console.log('\n--- 4. Testing Administrative Rebates ---');
  const hodRebate = AcademicWorkloadEngine.getAdministrativeRebate('HOD', null);
  assert(hodRebate.rebateCU === 3.0, 'HOD receives 3.0 CU statutory relief');

  const deanRebate = AcademicWorkloadEngine.getAdministrativeRebate('DEAN', null);
  assert(deanRebate.rebateCU === 6.0, 'Dean receives 6.0 CU statutory relief');

  const examRebate = AcademicWorkloadEngine.getAdministrativeRebate('EXAM_OFFICER', null);
  assert(examRebate.rebateCU === 2.0, 'Exam Officer receives 2.0 CU statutory relief');

  // 5. Test Assistant Lecturer Workload Evaluation (Standard 10-12 CU)
  console.log('\n--- 5. Testing Assistant Lecturer Workload Evaluation ---');
  const asstLecturerNormal = AcademicWorkloadEngine.evaluateStaffWorkload({
    staffProfileId: 'prof-01',
    staffName: 'Aliyu Musa',
    staffId: 'NOUN/AL/001',
    academicRank: 'ASSISTANT_LECTURER',
    session: '2026/2027',
    semester: 'FIRST_SEMESTER',
    allocations: [
      { courseId: 'c1', courseCode: 'CMP 101', courseTitle: 'Intro to CS', creditUnits: 3, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT', enrolledStudentsCount: 300 },
      { courseId: 'c2', courseCode: 'CMP 102', courseTitle: 'Algorithms', creditUnits: 3, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT', enrolledStudentsCount: 250 },
      { courseId: 'c3', courseCode: 'CMP 201', courseTitle: 'Programming I', creditUnits: 3, practicalHours: 2, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT', enrolledStudentsCount: 400 },
      { courseId: 'c4', courseCode: 'CMP 202', courseTitle: 'Data Structures', creditUnits: 2, role: 'CO_LECTURER', allocationStatus: 'DRAFT', enrolledStudentsCount: 200 },
    ],
  });
  assert(asstLecturerNormal.totalAssignedCreditUnits === 11, 'Total assigned CU = 11');
  assert(asstLecturerNormal.complianceStatus === 'NORMAL_LOAD', '11 CU is NORMAL_LOAD for Assistant Lecturer (10-12 range)');
  assert(asstLecturerNormal.statusColor === 'emerald', 'Status color is emerald');

  // 6. Test Senior Lecturer Workload Overload (> 10 CU + 3 CU = 13 CU)
  console.log('\n--- 6. Testing Senior Lecturer Overload Warning ---');
  const seniorLecturerOverload = AcademicWorkloadEngine.evaluateStaffWorkload({
    staffProfileId: 'prof-02',
    staffName: 'Dr. Fatima Ibrahim',
    staffId: 'NOUN/SL/002',
    academicRank: 'SENIOR_LECTURER',
    session: '2026/2027',
    semester: 'FIRST_SEMESTER',
    allocations: [
      { courseId: 'c1', courseCode: 'CMP 301', courseTitle: 'Operating Systems', creditUnits: 4, role: 'COURSE_COORDINATOR', allocationStatus: 'DRAFT' },
      { courseId: 'c2', courseCode: 'CMP 302', courseTitle: 'Databases', creditUnits: 4, role: 'COURSE_COORDINATOR', allocationStatus: 'DRAFT' },
      { courseId: 'c3', courseCode: 'CMP 401', courseTitle: 'AI', creditUnits: 3, role: 'COURSE_COORDINATOR', allocationStatus: 'DRAFT' },
      { courseId: 'c4', courseCode: 'CMP 801', courseTitle: 'Distributed Systems', creditUnits: 3, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT' },
    ],
  });
  assert(seniorLecturerOverload.totalAssignedCreditUnits === 14, 'Total assigned CU = 14');
  assert(seniorLecturerOverload.complianceStatus === 'WORKLOAD_OVERLOAD_WARNING', '14 CU triggers WORKLOAD_OVERLOAD_WARNING for Senior Lecturer (max is 10 + 3 = 13)');
  assert(seniorLecturerOverload.statusColor === 'red', 'Status color is red');
  assert(seniorLecturerOverload.overloadDeltaCU === 4, 'Overload delta is +4.0 CU over standard max');

  // 7. Test Under-allocated Professor with HOD Rebate
  console.log('\n--- 7. Testing Professor with Administrative Rebates ---');
  const profHod = AcademicWorkloadEngine.evaluateStaffWorkload({
    staffProfileId: 'prof-03',
    staffName: 'Prof. Adebayo Ogunlesi',
    staffId: 'NOUN/PR/003',
    academicRank: 'PROFESSOR',
    administrativeRole: 'HOD',
    session: '2026/2027',
    semester: 'FIRST_SEMESTER',
    allocations: [
      { courseId: 'c1', courseCode: 'CMP 901', courseTitle: 'Doctoral Seminar', creditUnits: 3, role: 'COURSE_COORDINATOR', allocationStatus: 'DRAFT' },
    ],
  });
  // Professor Cadre norm is 6-8 CU. With HOD rebate (3 CU), effective required range is 3-5 CU.
  assert(profHod.administrativeRebateCU === 3, 'HOD rebate of 3 CU applied');
  assert(profHod.effectiveRequiredMinCU === 3, 'Effective minimum CU is 3 (6 - 3)');
  assert(profHod.effectivePermissibleMaxCU === 5, 'Effective maximum CU is 5 (8 - 3)');
  assert(profHod.complianceStatus === 'NORMAL_LOAD', '3 CU with HOD rebate is NORMAL_LOAD');

  // 8. Test Course Material Development Credit
  console.log('\n--- 8. Testing Course Material Development Bonus ---');
  const lecturerCourseDev = AcademicWorkloadEngine.evaluateStaffWorkload({
    staffProfileId: 'prof-04',
    staffName: 'Chidinma Okafor',
    staffId: 'NOUN/L1/004',
    academicRank: 'LECTURER_I',
    session: '2026/2027',
    semester: 'FIRST_SEMESTER',
    allocations: [
      { courseId: 'c1', courseCode: 'CMP 201', courseTitle: 'Programming', creditUnits: 3, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT', courseMaterialCreditUnits: 3 },
      { courseId: 'c2', courseCode: 'CMP 202', courseTitle: 'Data Structures', creditUnits: 3, role: 'LEAD_LECTURER', allocationStatus: 'DRAFT' },
    ],
  });
  assert(lecturerCourseDev.totalAssignedCreditUnits === 6, 'Assigned teaching CU = 6');
  assert(lecturerCourseDev.totalCourseMaterialCreditUnits === 3, 'Course Material Development bonus = 3 CU');
  assert(lecturerCourseDev.complianceStatus === 'NORMAL_LOAD', '6 teaching CU + 3 material CU = 9 CU (within 8-10 normal range)');

  console.log(`\n========================================`);
  console.log(`🏁 Academic Workload Engine Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
