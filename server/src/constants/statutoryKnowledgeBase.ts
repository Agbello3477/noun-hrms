/**
 * NOUN Statutory Knowledge Base & Institutional Repository
 * Pre-curated, grounded knowledge texts covering all statutory regulatory documents:
 * 1. NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)
 * 2. NOUN Rules and Regulations Governing Conditions of Service of Junior Staff (June 2024)
 * 3. NOUN Updated Scheme of Service (Senior Non-Teaching & Academic, May 2024)
 * 4. NOUN Academic Programme Taxonomy (146 programmes across 14 faculties)
 * 5. NOUN-HRMS End-User & Administrative Manual (Maker-Checker, WAF, Telemetry, Docket routing)
 */

export interface StatutoryDocumentChunk {
  id: string;
  cadre: 'ACADEMIC' | 'SENIOR_ADMIN' | 'JUNIOR_STAFF' | 'GENERAL';
  section: 'LEAVE' | 'DISCIPLINE' | 'PROMOTIONS' | 'EXIT' | 'SALARIES' | 'WORKLOAD' | 'MANUAL' | 'GENERAL';
  sourceDocument: string;
  pageNumber: number;
  citationRef: string;
  title: string;
  content: string;
}

export const STATUTORY_KNOWLEDGE_CHUNKS: StatutoryDocumentChunk[] = [
  // =========================================================================
  // 1.0 SENIOR STAFF CONDITIONS OF SERVICE (JUNE 2024) - LEAVE
  // =========================================================================
  {
    id: 'snr-leave-5-1-1',
    cadre: 'GENERAL',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 24,
    citationRef: 'Section 5.1.1',
    title: 'Annual Leave Entitlements for Senior Staff and Principal Officers',
    content: `Per Section 5.1.1 of the Senior Staff Conditions of Service (June 2024):
Annual Leave is granted to staff per calendar year based on grade levels:
1. Principal Officers (Vice-Chancellor, Deputy Vice-Chancellors, Registrar, Bursar, University Librarian): Exactly 42 working days.
2. Academic Staff (CONUASS 01 to 07): Exactly 30 working days per annum.
3. Senior Administrative and Technical Staff (CONTISS 06 to 15): Exactly 30 working days per annum.
4. Annual leave must be planned with the Head of Department or Unit Head and approved by the Registrar through the Directorate of Human Resources.
5. All leave applications must be processed through the NOUN-HRMS digital leave portal with HOD vetting and Registry authorization.`
  },
  {
    id: 'snr-leave-5-1-4',
    cadre: 'SENIOR_ADMIN',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 26,
    citationRef: 'Section 5.1.4',
    title: 'Casual Leave, Leave Carryover, and Deferred Leave Provisions',
    content: `Per Section 5.1.4 and Section 5.1.5 of the Senior Staff Conditions of Service (June 2024):
1. Casual Leave: A maximum of two (2) working days at a time may be granted by the Head of Department/Unit, not exceeding seven (7) working days in any calendar year with Registrar/VC approval. Casual leave shall NOT be granted if the staff member has unexhausted annual leave.
2. Leave Carryover & Expiry: Unused annual leave for any given year lapses on December 31st unless formal approval for deferment is granted by the Registrar upon recommendation of the HOD.
3. Deferred Leave upon Exit: A maximum of two (2) deferred annual leaves may be accumulated towards terminal leave or encashment upon official retirement or resignation.`
  },
  {
    id: 'snr-leave-5-1-7',
    cadre: 'GENERAL',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 28,
    citationRef: 'Section 5.1.7 & 5.1.8',
    title: 'Maternity, Nursing Break, and Paternity Leave Provisions',
    content: `Per Section 5.1.7 and Section 5.1.8 of the Senior Staff Conditions of Service (June 2024):
1. Maternity Leave: A female staff member is entitled to sixteen (16) weeks maternity leave with full pay. The leave must commence not later than four (4) weeks prior to the expected date of delivery (EDD) upon submission of a certified medical certificate from a recognized university clinic or government hospital.
2. Nursing Mothers Concession: Upon resumption from maternity leave, nursing mothers are entitled to two (2) hours daily off-duty time for nursing until the infant attains the age of six (6) months.
3. Paternity Leave: Married male staff are entitled to a maximum of fourteen (14) working days paternity leave with full pay upon delivery of a spouse's child, grantable once every two (2) calendar years upon submission of the birth notification.`
  },

  // =========================================================================
  // 1.1 SENIOR STAFF CONDITIONS OF SERVICE - DISCIPLINE
  // =========================================================================
  {
    id: 'snr-disc-8-2-1',
    cadre: 'GENERAL',
    section: 'DISCIPLINE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 42,
    citationRef: 'Section 8.2.1',
    title: 'Disciplinary Procedures, Queries, and Response Deadlines',
    content: `Per Section 8.2.1 and Section 8.2.3 of the Senior Staff Conditions of Service (June 2024):
1. Disciplinary Query: Any act of misconduct, dereliction of duty, absenteeism, or insubordination shall prompt a formal written query from the Head of Unit, Dean, or Registrar.
2. Mandatory 24-Hour Response Window: A staff member served with a written query MUST submit a formal written representation/response within exactly twenty-four (24) hours of receipt.
3. Three-Query Rule: Issuance of a third (3rd) unabsorbed written query within any twelve (12) month period constitutes a Final Disciplinary Warning and automatic referral to the Senior Staff Disciplinary Committee (SSDC).
4. Registry Disciplinary Gate: Any unabsorbed or pending disciplinary query registered on a staff member's docket immediately disqualifies them from promotion screening and vetting.`
  },
  {
    id: 'snr-disc-8-4-1',
    cadre: 'GENERAL',
    section: 'DISCIPLINE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 46,
    citationRef: 'Section 8.4.1',
    title: 'Serious Misconduct, Interdiction, and Suspension Rules',
    content: `Per Section 8.4.1 of the Senior Staff Conditions of Service (June 2024):
1. Serious / Gross Misconduct: Includes financial misappropriation, examination malpractice, sexual harassment, insubordination to Council, and unauthorized disclosure of confidential university records.
2. Interdiction: When a prima facie case of serious misconduct is established, the Registrar/Vice-Chancellor may place the staff on interdiction. During interdiction, the staff receives fifty percent (50%) of consolidated salary.
3. Reinstatement or Dismissal: If exonerated by the Senior Staff Disciplinary Committee and ratified by Council, all withheld emoluments are refunded in full. If found culpable, disciplinary penalties range from demotion to immediate summary dismissal.`
  },

  // =========================================================================
  // 1.2 STATUTORY RETIREMENT RULES
  // =========================================================================
  {
    id: 'snr-exit-9-1-1',
    cadre: 'GENERAL',
    section: 'EXIT',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 55,
    citationRef: 'Section 9.1.1 & 9.1.2',
    title: 'Statutory Retirement Age and Voluntary Exit Guidelines',
    content: `Per Section 9.1.1 and Section 9.1.2 of the Senior Staff Conditions of Service (June 2024):
1. Professorial & Reader Cadre Retirement: Academic Staff in the professorial rank (Professor and Associate Professor / Reader) retire statutorily upon attaining exactly seventy-five (75) years of age.
2. Non-Professorial Academic & Senior Administrative Staff: Non-professorial academic staff, senior administrative officers, and technical personnel retire upon attaining sixty-five (65) years of age or completing thirty-five (35) years of pensionable public service, whichever occurs earlier.
3. Voluntary Retirement: A confirmed staff member may seek voluntary retirement upon attaining fifty (50) years of age, subject to giving three (3) months formal written notice or paying three months salary in lieu of notice.`
  },

  // =========================================================================
  // 2.0 JUNIOR STAFF CONDITIONS OF SERVICE (JUNE 2024)
  // =========================================================================
  {
    id: 'jnr-leave-4-1-1',
    cadre: 'JUNIOR_STAFF',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Junior Staff (June 2024)',
    pageNumber: 18,
    citationRef: 'Section 4.1.1',
    title: 'Junior Staff Leave Entitlements (CONTISS 01 - 05)',
    content: `Per Section 4.1.1 of the Junior Staff Conditions of Service (June 2024):
1. CONTISS 01 to 02: Fourteen (14) working days annual leave.
2. CONTISS 03 to 05: Twenty-one (21) working days annual leave.
3. Casual Leave: Junior staff may be granted up to three (3) days casual leave by the immediate supervisor/HOD, and up to five (5) days by the Registrar in cases of urgent compassionate grounds.
4. Annual leave must be taken within the operational leave cycle and cannot be monetized during active employment.`
  },
  {
    id: 'jnr-promo-6-1-1',
    cadre: 'JUNIOR_STAFF',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Junior Staff (June 2024)',
    pageNumber: 30,
    citationRef: 'Section 6.1.1',
    title: 'Junior Staff Promotion & Waiting Period Guidelines',
    content: `Per Section 6.1.1 of the Junior Staff Conditions of Service (June 2024):
1. Statutory Waiting Period: Junior Staff on CONTISS 01 to 05 must serve a minimum of three (3) statutory calendar years on their current grade before becoming eligible for promotion consideration.
2. Annual Performance Evaluation Report (APER): A minimum benchmark score of 50% across the preceding three years is strictly required.
3. Disciplinary Clearance: Candidate must be free of active queries and adverse disciplinary records.
4. Confirmation of Appointment: Staff must have obtained official confirmation of appointment (minimum 2 years of probationary service).`
  },

  // =========================================================================
  // 3.0 NOUN UPDATED SCHEME OF SERVICE (MAY 2024) - ACADEMIC CADRE
  // =========================================================================
  {
    id: 'sch-acad-lecturer2',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 12,
    citationRef: 'Scheme of Service Section 1.1 - Lecturer II',
    title: 'Scheme of Service: Lecturer II Promotion & Appointment Requirements',
    content: `As stipulated under Scheme of Service Section 1.1 for Academic Cadre (May 2024):
- Rank: Lecturer II / Research Fellow II (CONUASS 03)
- Waiting Period: Minimum 3 years on CONUASS 02 (Assistant Lecturer).
- Qualification: Master's Degree in relevant discipline OR Bachelor's Degree with verifiable proof of ongoing Ph.D. registration.
- Publication Benchmark: Minimum 10 points (6.0-10.0 verified publication points).
- Output Constraints: Maximum 2 course materials allowed towards point evaluation.
- Governance: Internal Faculty Board and Appointments & Promotions Committee (A&PC) evaluation.`
  },
  {
    id: 'sch-acad-lecturer1',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 14,
    citationRef: 'Scheme of Service Section 1.2 - Lecturer I',
    title: 'Scheme of Service: Lecturer I Promotion Requirements',
    content: `As stipulated under Scheme of Service Section 1.2 for Academic Cadre (May 2024):
- Rank: Lecturer I / Research Fellow I (CONUASS 04)
- Waiting Period: Minimum 3 years on CONUASS 03 (Lecturer II).
- Qualification: Master's Degree in relevant discipline with evidence of advanced Ph.D. progress, or earned Ph.D.
- Publication Benchmark: Minimum 16 cumulative points (with at least 12 new verified points).
- Output Constraints: Maximum 2 course materials allowed towards point evaluation.
- Governance: Recommended by Departmental A&PC, reviewed by Faculty Board, and approved by Central Academic A&PC.`
  },
  {
    id: 'sch-acad-snrlecturer',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 16,
    citationRef: 'Scheme of Service Section 1.3 - Senior Lecturer',
    title: 'Scheme of Service: Senior Lecturer Promotion Requirements',
    content: `As stipulated under Scheme of Service Section 1.3 for Academic Cadre (May 2024):
- Rank: Senior Lecturer / Senior Research Fellow (CONUASS 05)
- Waiting Period: Minimum 3 years on CONUASS 04 (Lecturer I).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY. No staff without a Ph.D. shall be promoted to Senior Lecturer.
- Publication Benchmark: Minimum 34 cumulative publication points (with at least 24 verified points in peer-reviewed journals and conference proceedings).
- Output Constraints: Course materials are EXCLUDED from minimum point scoring for Senior Lecturer.
- Governance: Faculty Vetting, Central A&PC evaluation, and satisfactory teaching and administrative assessment.`
  },
  {
    id: 'sch-acad-reader',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 18,
    citationRef: 'Scheme of Service Section 1.4 - Reader (Associate Professor)',
    title: 'Scheme of Service: Reader / Associate Professor Requirements',
    content: `As stipulated under Scheme of Service Section 1.4 for Academic Cadre (May 2024):
- Rank: Reader / Associate Professor (CONUASS 06)
- Waiting Period: Minimum 3 years on CONUASS 05 (Senior Lecturer).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY.
- Publication Benchmark: Minimum 49 cumulative publication points (comprising high-impact journal articles, books, and proceedings).
- Offshore Requirement: Minimum twenty percent (20%) of publications must be in reputable offshore / international indexed journals.
- Governance: Positive external assessment reports from three independent external assessors of professorial standing, Central A&PC approval, and Council ratification.`
  },
  {
    id: 'sch-acad-prof',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 20,
    citationRef: 'Scheme of Service Section 1.5 - Professor',
    title: 'Scheme of Service: Professor (Full Chair) Promotion Requirements',
    content: `As stipulated under Scheme of Service Section 1.5 for Academic Cadre (May 2024):
- Rank: Professor / Research Professor (CONUASS 07)
- Waiting Period: Minimum 3 years on CONUASS 06 (Reader / Associate Professor).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY.
- Publication Benchmark: Minimum 70 cumulative publication points (demonstrating sustained research leadership and scholarship).
- Geographical & Authorship Distribution: Minimum thirty percent (30%) offshore publications AND minimum thirty percent (30%) sole or principal/lead authorship.
- Governance: Unanimous positive external assessments by renowned external assessors, Central A&PC recommendation, Senate notification, and Governing Council ratification.`
  },

  // =========================================================================
  // 3.1 NOUN UPDATED SCHEME OF SERVICE - SENIOR ADMINISTRATIVE CADRE
  // =========================================================================
  {
    id: 'sch-admin-cadres',
    cadre: 'SENIOR_ADMIN',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 32,
    citationRef: 'Scheme of Service Section 3.1 & 3.2 - Senior Administrative',
    title: 'Scheme of Service: Administrative Officer Progression & Directorate Grades',
    content: `As stipulated under Scheme of Service Section 3.1 for Administrative Officer Cadre (May 2024):
1. CONTISS 06 to 09 (e.g. Admin Officer II to Senior Admin Officer): Minimum 3 years statutory waiting period on current grade.
2. CONTISS 09 and above (e.g. Principal Admin Officer CONTISS 11, Deputy Registrar CONTISS 14): Minimum 4 years statutory waiting period.
3. Directorate & Established Positions (CONTISS 14 - Deputy Registrar, CONTISS 15 - Registrar): These are established quota posts requiring an official vacancy declaration by the Registrar/Vice-Chancellor before selection interviews can be conducted.
4. Prerequisites: Confirmed permanent appointment, satisfactory APER rating (minimum 50%), professional membership (e.g., NIM, ANUPA, CIPM), and clean disciplinary record.`
  },

  // =========================================================================
  // 4.0 ACADEMIC TAXONOMY & TEACHING WORKLOAD CAPS
  // =========================================================================
  {
    id: 'sch-workload-caps',
    cadre: 'ACADEMIC',
    section: 'WORKLOAD',
    sourceDocument: 'NOUN Academic Policy & Teaching Workload Distribution Guidelines (2024)',
    pageNumber: 8,
    citationRef: 'Workload Guidelines Section 4.2',
    title: 'Statutory Teaching Workload Caps and Administrative Rebates',
    content: `Per Workload Guidelines Section 4.2 of the Academic Policy (2024):
1. Maximum Teaching Credit Unit (CU) Caps per Semester:
   - Professor: 6 to 8 Credit Units
   - Associate Professor (Reader): 8 to 10 Credit Units
   - Senior Lecturer: 10 to 12 Credit Units
   - Lecturer I & Lecturer II: 10 to 12 Credit Units
   - Assistant Lecturer / Graduate Assistant: 12 to 14 Credit Units
2. Administrative Rebates:
   - Dean of Faculty / Director of Academic Directorate: 6 Credit Units rebate
   - Head of Department (HOD): 6 Credit Units rebate
   - Departmental Examination Officer / Programme Coordinator: 3 Credit Units rebate
3. Enforcement: Overloaded allocations (> cap minus rebate) are flagged for unbundling; underloaded staff (< 6 CU without approved rebate) are flagged for reallocation.`
  },
  {
    id: 'sch-academic-taxonomy',
    cadre: 'ACADEMIC',
    section: 'GENERAL',
    sourceDocument: 'NOUN Academic Programme Taxonomy (2024)',
    pageNumber: 2,
    citationRef: 'Academic Taxonomy Directory 2024',
    title: 'NOUN Academic Programme Structure (146 Programmes across Faculties)',
    content: `Per NOUN Academic Programme Taxonomy Directory (2024):
The National Open University of Nigeria operates 146 accredited programmes across faculties including:
- Faculty of Agricultural Sciences (Agricultural Economics, Animal Science, Crop Science, Soil Science, Aquaculture)
- Faculty of Arts (English, French, History & Diplomatic Studies, Religious Studies, Philosophy, Linguistics)
- Faculty of Education (Educational Administration, Guidance & Counselling, Early Childhood, Science Education)
- Faculty of Health Sciences (Nursing Science, Public Health, Environmental Health)
- Faculty of Law (LL.B Commercial Law, Public Law, Jurisprudence)
- Faculty of Management Sciences (Accounting, Business Admin, Public Admin, Entrepreneurship, Banking & Finance)
- Faculty of Sciences (Computer Science, Information Technology, Mathematics, Chemistry, Physics, Biology)
- Faculty of Social Sciences (Economics, Political Science, Mass Communication, Criminology, Peace Studies)
- Postgraduate School / Specialised Centres (ACETEL, CEAG&S, CDRM).`
  },

  // =========================================================================
  // 5.0 NOUN-HRMS END-USER & ADMINISTRATIVE MANUAL
  // =========================================================================
  {
    id: 'man-maker-checker',
    cadre: 'GENERAL',
    section: 'MANUAL',
    sourceDocument: 'NOUN-HRMS End-User & Administrative Manual (2024)',
    pageNumber: 15,
    citationRef: 'Manual Section 2.1 - Maker-Checker Governance',
    title: 'Maker-Checker Dual-Control Authorization Architecture',
    content: `Per Manual Section 2.1 of the NOUN-HRMS End-User & Administrative Manual:
1. Principle: High-impact organizational actions (staff role elevation, salary adjustment, disciplinary docketing, leave authorization) require dual-control separation of duty.
2. Imputer Stage (Registry / HR Officer): Drafts and submits the proposed record with mandatory supporting justification and uploaded docket attachment.
3. Authorizer Stage (Registrar / Executive Director): Reviews the imputed changes in the Registrar Cockpit. Can approve, query with remarks, or reject.
4. Non-Self Approval: An imputer cannot approve their own submitted transaction. Every approval emits an immutable entry into AuthorizationAuditTrail.`
  },
  {
    id: 'man-docket-stepper',
    cadre: 'GENERAL',
    section: 'MANUAL',
    sourceDocument: 'NOUN-HRMS End-User & Administrative Manual (2024)',
    pageNumber: 22,
    citationRef: 'Manual Section 3.4 - Institutional Docket Stepper',
    title: 'Institutional Application Docket Routing and 4-Step Stepper',
    content: `Per Manual Section 3.4 of the NOUN-HRMS End-User & Administrative Manual:
Official applications (Study Leave, Sabbatical, Inter-University Transfer, Conversion) follow a 4-step institutional stepper:
- Stage 1: SUBMITTED (Applicant lodges form with digital folio number, e.g. NOUN/APP/2026/00142).
- Stage 2: DIRECTOR_VETTING (Department Director or Dean reviews, appends recommendation, and forwards).
- Stage 3: REGISTRY_DOCKETING (Registry Clerk verfies eligibility, checks APER/Query history, and attaches docket).
- Stage 4: REGISTRAR_APPROVAL (Registrar grants executive approval or refers to VC/Council).
SLA Timers: Maximum 48 hours per staging gate before automatic escalation alerts are dispatched to Unit Admins.`
  },
  {
    id: 'man-file-requisition',
    cadre: 'GENERAL',
    section: 'MANUAL',
    sourceDocument: 'NOUN-HRMS End-User & Administrative Manual (2024)',
    pageNumber: 35,
    citationRef: 'Manual Section 4.2 - File Requisition & Custody',
    title: 'Personnel File Requisition, Custody Tracking & Release Steps',
    content: `Per Manual Section 4.2 of the NOUN-HRMS End-User & Administrative Manual:
How to lodge and authorize a physical/digital personnel file requisition:
1. Requisition Lodging: Staff/Officer submits request via File Requisition module stating purpose and required duration.
2. Registry Folio Acknowledgment: Registry records request and generates registry folio reference.
3. Registrar Authorization: Registrar approves custody release in the Registrar Cockpit.
4. Physical Dispatch / Digital Token: Registry issues dispatch receipt number (NOUN/DISPATCH/YYYY/XXXXX) or short-lived encrypted digital access token.
5. Return & Re-Archiving: File returned to central registry vaults; receiving officer signs off, closing the audit loop in FileCustodyAuditTrail.`
  }
];
