/**
 * NOUN Statutory Knowledge Base & Institutional Repository
 * Pre-curated, grounded knowledge texts covering all statutory regulatory documents:
 * 1. NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)
 * 2. NOUN Rules and Regulations Governing Conditions of Service of Junior Staff (June 2024)
 * 3. NOUN Updated Scheme of Service (Senior Non-Teaching & Academic, May 2024)
 * 4. National Open University Act (Cap N63 LFN 2004 / Amendment Act No. 19, 2018)
 * 5. NOUN Academic Programme Taxonomy (146 programmes across 14 faculties)
 * 6. NOUN-HRMS End-User & Administrative Manual (Maker-Checker, WAF, Telemetry, Docket routing)
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
  // 1.0 APPOINTMENTS, PROBATION & CONFIRMATION (3-YEAR HARD DROP RULE)
  // =========================================================================
  {
    id: 'snr-prob-hard-drop',
    cadre: 'GENERAL',
    section: 'GENERAL',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 12,
    citationRef: 'Section 2.1 & 2.2 - Appointments, Probation and Confirmation',
    title: 'Appointments, 2-Year Probation, 3-Year Hard Drop Rule, and Confirmation Prerequisites',
    content: `Per Section 2.1 and Section 2.2 of the Conditions of Service for Senior Staff (June 2024) and Junior Staff (June 2024):
1. Probation Period: All first appointments to established pensionable posts are subject to a two (2) year probation period.
2. Extension of Probation: The probation period may be extended for good cause by not more than one (1) year for Senior Staff or six (6) months for Junior Staff.
3. The 3-Year Hard Drop Rule: If an officer's appointment is not confirmed after three (3) years of service, the appointment must be terminated immediately.
4. Prerequisite Restrictions: An unconfirmed staff member is strictly ineligible for promotion consideration, study leave, or institutional training sponsorship (other than in-house workshops).`
  },
  {
    id: 'snr-spousal-colocation',
    cadre: 'GENERAL',
    section: 'GENERAL',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 15,
    citationRef: 'Section 3.8 - Spousal Co-Location Restriction',
    title: 'Spousal Co-Location Restriction in Same Unit, Directorate, or Study Centre',
    content: `Per Section 3.8 of the Senior Staff Conditions of Service (June 2024):
1. Spousal Co-Location Restriction: Husband and wife shall not be deployed or posted to work in the same unit, directorate, division, or study centre.
2. Vice-Chancellor Exemption: No exception to this restriction is permitted without the explicit written approval of the Vice-Chancellor.`
  },
  {
    id: 'snr-general-sec-1-4',
    cadre: 'GENERAL',
    section: 'GENERAL',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 5,
    citationRef: 'Section 1.4 - Unlisted Scenarios and Discretionary Matters',
    title: 'Referral of Unlisted Scenarios to Registrar via HOD (Section 1.4 Zero Hallucination Rule)',
    content: `Per Section 1.4 of the Conditions of Service for Senior Staff (June 2024):
Any institutional case, unique contingency, discretionary matter, or administrative scenario not explicitly covered in these Conditions of Service shall be referred to the Registrar through the Head of Department (HOD) for official determination and transmission to the Vice-Chancellor or Governing Council.`
  },

  // =========================================================================
  // 2.0 LEAVE ENTITLEMENTS & LAPSING RULES
  // =========================================================================
  {
    id: 'snr-leave-5-1-1',
    cadre: 'GENERAL',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 24,
    citationRef: 'Section 5.1.1',
    title: 'Annual Leave Entitlements, Working Days Calculation, and Principal Officers',
    content: `Per Section 5.1.1 of the Senior Staff Conditions of Service (June 2024):
Annual Leave is granted to staff per calendar year calculated strictly on working days (excluding weekends and statutory public holidays):
1. CONTISS 01 to 02: 14 working days per annum.
2. CONTISS 03 to 05: 21 working days per annum.
3. CONTISS 06 to 15 & CONUASS 01 to 07: 30 working days per annum.
4. Principal Officers (Vice-Chancellor, Deputy Vice-Chancellors, Registrar, Bursar, University Librarian): 42 working days per annum.
5. Planning & Approval: Annual leave must be planned with the Head of Department or Unit Head and approved by the Registrar through the NOUN-HRMS digital leave workflow.`
  },
  {
    id: 'snr-leave-casual-deferment',
    cadre: 'GENERAL',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 26,
    citationRef: 'Section 5.1.4 & 5.1.5',
    title: 'Casual Leave, Leave Carryover, and Deferred Leave Provisions',
    content: `Per Section 5.1.4 and Section 5.1.5 of the Senior Staff Conditions of Service (June 2024):
1. Casual Leave: Maximum two (2) working days at a time may be granted by the Head of Department/Unit, not exceeding seven (7) working days in any calendar year with Registrar/VC approval for Senior Staff (max 3 working days by HOD / 5 days by Registrar for Junior Staff). Casual leave shall NOT be granted if the staff member has unexhausted annual leave.
2. Leave Lapsing & Deferment: Annual leave not utilized by December 31st lapses automatically unless formal approval for deferment is granted by the Registrar. Non-principal officers can defer a maximum of two (2) annual leaves towards retirement or resignation. Principal Officers may defer unspent leave until expiration of tenure.`
  },
  {
    id: 'snr-leave-maternity-paternity',
    cadre: 'GENERAL',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 28,
    citationRef: 'Section 5.1.7 & 5.1.8',
    title: 'Maternity Leave, Nursing Breaks, and Paternity Leave Provisions',
    content: `Per Section 5.1.7 and Section 5.1.8 of the Senior Staff Conditions of Service (June 2024):
1. Maternity Leave: A female staff member is entitled to sixteen (16) weeks maternity leave with full pay. The leave must commence not later than four (4) weeks prior to the expected date of delivery (EDD) upon submission of a certified medical certificate.
2. Nursing Mothers Concession: Upon resumption from maternity leave, nursing mothers receive two (2) hours daily off-duty time for nursing until the infant attains the age of six (6) months.
3. Paternity Leave: Married male staff are entitled to a maximum of fourteen (14) working days paternity leave with full pay upon delivery of a spouse's child (restricted to one spouse, not more than once every two calendar years).`
  },
  {
    id: 'snr-leave-research-sabbatical',
    cadre: 'ACADEMIC',
    section: 'LEAVE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 30,
    citationRef: 'Section 5.1.9 & 5.1.10',
    title: 'Research Leave and Sabbatical Leave Provisions',
    content: `Per Section 5.1.9 and Section 5.1.10 of the Senior Staff Conditions of Service (June 2024):
1. Research Leave: Academic staff are entitled to a maximum of twenty-six (26) working days research leave per annum.
2. Sabbatical Leave: One (1) year sabbatical leave is available for academic staff (Senior Lecturer and above) or administrative staff (CONTISS 13 and above) after six (6) years of continuous service.`
  },

  // =========================================================================
  // 3.0 TRAINING BONDS & POST-SERVICE COMMITMENTS
  // =========================================================================
  {
    id: 'snr-training-bonds',
    cadre: 'GENERAL',
    section: 'GENERAL',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 38,
    citationRef: 'Section 6.3 - Training Bonds and Post-Service Obligations',
    title: 'Training Bonds, Study Leave Commitments, and Refund Obligations',
    content: `Per Section 6.3 of the Senior Staff Conditions of Service (June 2024):
1. Full-Time Study Leave: Requires a post-training service bond of twice the duration of the leave (up to a maximum of 5 years).
2. Part-Time Study Leave: Requires a bond of one (1) year per year of study (maximum 3 to 5 years).
3. Prohibition & Refund: Staff under bond are strictly prohibited from resigning, withdrawing service, or proceeding on sabbatical/other leave until fulfilling the bond or making full refund of all salaries, allowances, and tuition paid during the sponsorship period.`
  },

  // =========================================================================
  // 4.0 DISCIPLINARY PROCEDURES & HALF-SALARY AUTOMATIONS
  // =========================================================================
  {
    id: 'snr-disc-8-2-1',
    cadre: 'GENERAL',
    section: 'DISCIPLINE',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 42,
    citationRef: 'Section 8.2 & 8.4 - Disciplinary Procedures and Salary Adjustments',
    title: 'Disciplinary Queries, 24-Hour Response, 3rd Query Rule, Suspension & Interdiction Half-Salary',
    content: `Per Section 8.2 and Section 8.4 of the Senior Staff Conditions of Service (June 2024):
1. Mandatory 24-Hour Response Window: A staff member served with a written query for misconduct MUST submit a formal written representation within minimum twenty-four (24) hours of receipt.
2. Three-Query Rule: Issuance of a third (3rd) unabsorbed written query within any twelve (12) month period constitutes a Final Disciplinary Warning and triggers automatic referral to the Senior Staff Disciplinary Committee (SSDC). Any unabsorbed query blocks promotion vetting.
3. Internal Suspension: During internal suspension pending investigation, staff is placed on 50% half salary. Withheld 50% is refunded in full if cleared; forfeited if recall is on compassionate grounds without full exoneration.
4. Interdiction: When an officer is charged with criminal misconduct or serious offense, interdiction is applied with 50% half salary. Restored in full upon complete acquittal; dismissed with forfeiture upon conviction.`
  },

  // =========================================================================
  // 5.0 STATUTORY RETIREMENT AGES
  // =========================================================================
  {
    id: 'snr-exit-9-1-1',
    cadre: 'GENERAL',
    section: 'EXIT',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Senior Staff (June 2024)',
    pageNumber: 55,
    citationRef: 'Section 9.1.1 & 9.1.2 - Statutory Retirement',
    title: 'Statutory Retirement Ages: Professorial (70 Yrs / 75 Yrs Contract) vs Other Staff (65 Yrs / 35 Yrs Service)',
    content: `Per Section 9.1.1 and Section 9.1.2 of the Senior Staff Conditions of Service (June 2024):
1. Professorial Cadre (Professors & Readers / Associate Professors): Retire statutorily upon attaining exactly seventy (70) years of age. A contract extension up to seventy-five (75) years of age may be granted under special institutional need approved by Council.
2. Non-Professorial Academic & Other Staff: Non-professorial academic staff, senior administrative officers, technical personnel, and junior staff retire upon attaining sixty-five (65) years of age or completing thirty-five (35) years of pensionable public service, whichever occurs earlier.
3. Voluntary Retirement: A confirmed staff member may seek voluntary retirement upon attaining fifty (50) years of age, subject to giving three (3) months formal written notice or paying three months salary in lieu of notice.`
  },

  // =========================================================================
  // 6.0 STATUTORY WAITING PERIODS FOR PROMOTION (ALL CADRES)
  // =========================================================================
  {
    id: 'sch-promotion-waiting-periods',
    cadre: 'GENERAL',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 8,
    citationRef: 'Scheme of Service - Statutory Promotion Waiting Periods',
    title: 'Statutory Promotion Waiting Periods and General APER Prerequisites',
    content: `Per the NOUN Updated Scheme of Service (May 2024):
1. Academic Cadre (CONUASS 1 to 7): Minimum waiting period of three (3) years on existing rank, subject to fulfilling scholarship and publication requirements.
2. Junior Staff (CONTISS 1 to 5): Minimum waiting period of three (3) years on existing grade.
3. Senior Administrative & Technical Staff (CONTISS 6 to 9): Minimum waiting period of three (3) years.
4. Senior Administrative & Professional Staff (CONTISS 9 to 13 and above): Minimum statutory waiting period of four (4) years.
5. Establishment Posts (CONTISS 14 & 15 - Deputy Registrar, Deputy Bursar, Directors): Not subject to automatic progression; strictly dependent on an official vacancy declared by Management/Council.
6. General Prerequisites: Candidate must score at least 50% in the Annual Performance Evaluation Report (APER) across preceding years and have zero unabsorbed disciplinary queries.`
  },

  // =========================================================================
  // 7.0 ACADEMIC PUBLICATION & PROMOTION POINT MATRIX (2024 CRITERIA)
  // =========================================================================
  {
    id: 'sch-acad-lecturer2',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 12,
    citationRef: 'Scheme of Service Section 1.1 - Assistant Lecturer to Lecturer II',
    title: 'Scheme of Service: Assistant Lecturer to Lecturer II Promotion Criteria',
    content: `As stipulated under Scheme of Service Section 1.1 for Academic Cadre (May 2024):
- Rank: Lecturer II / Research Fellow II (CONUASS 03)
- Waiting Period: Minimum three (3) years on CONUASS 02 (Assistant Lecturer).
- Qualification: Master's Degree in relevant discipline OR Bachelor's Degree with verifiable proof of ongoing Ph.D. registration.
- Publication Benchmark: Minimum 10 points (journals, refereed conference proceedings, and course materials).
- Output Constraints: Maximum 2 course materials allowed towards point evaluation.
- Governance: Recommended by Departmental A&PC and approved by Faculty Board / Central Academic A&PC.`
  },
  {
    id: 'sch-acad-lecturer1',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 14,
    citationRef: 'Scheme of Service Section 1.2 - Lecturer II to Lecturer I',
    title: 'Scheme of Service: Lecturer II to Lecturer I Promotion Criteria',
    content: `As stipulated under Scheme of Service Section 1.2 for Academic Cadre (May 2024):
- Rank: Lecturer I / Research Fellow I (CONUASS 04)
- Waiting Period: Minimum three (3) years on CONUASS 03 (Lecturer II).
- Qualification: Master's Degree with evidence of advanced Ph.D. registration / progress, or earned Doctorate (Ph.D.).
- Publication Benchmark: Minimum 16 points (journals, refereed conference proceedings, and course materials).
- Output Constraints: Maximum 2 course materials allowed towards point evaluation.
- Governance: Recommended by Departmental A&PC, reviewed by Faculty Board, and approved by Central Academic A&PC.`
  },
  {
    id: 'sch-acad-snrlecturer',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 16,
    citationRef: 'Scheme of Service Section 1.3 - Lecturer I to Senior Lecturer',
    title: 'Scheme of Service: Lecturer I to Senior Lecturer Promotion Criteria',
    content: `As stipulated under Scheme of Service Section 1.3 for Academic Cadre (May 2024):
- Rank: Senior Lecturer / Senior Research Fellow (CONUASS 05)
- Waiting Period: Minimum three (3) years on CONUASS 04 (Lecturer I).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY. No candidate without a Ph.D. shall be promoted to Senior Lecturer.
- Publication Benchmark: Minimum 34 cumulative publication points (journals, refereed conference proceedings, and books).
- Output Constraints: Course materials capped at a maximum of 2.
- Governance: Faculty Vetting, Central A&PC evaluation, and satisfactory teaching and administrative assessment.`
  },
  {
    id: 'sch-acad-reader',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 18,
    citationRef: 'Scheme of Service Section 1.4 - Senior Lecturer to Reader (Associate Professor)',
    title: 'Scheme of Service: Senior Lecturer to Reader / Associate Professor Criteria',
    content: `As stipulated under Scheme of Service Section 1.4 for Academic Cadre (May 2024):
- Rank: Reader / Associate Professor (CONUASS 06)
- Waiting Period: Minimum three (3) years on CONUASS 05 (Senior Lecturer).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY.
- Publication Benchmark: Minimum 49 cumulative publication points (books, proceedings, journals; max 2 course materials).
- Offshore Requirement: Minimum twenty percent (20%) of publications must be in international/foreign peer-reviewed journals.
- Google Scholar Visibility (from 2025): Minimum 8 points / 80 citations (0.1 point per citation).
- Governance: Positive external assessment reports from three (3) independent external assessors of professorial standing, Central A&PC approval, and Council ratification.`
  },
  {
    id: 'sch-acad-prof',
    cadre: 'ACADEMIC',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Updated Scheme of Service (May 2024)',
    pageNumber: 20,
    citationRef: 'Scheme of Service Section 1.5 - Reader to Professor (Full Chair)',
    title: 'Scheme of Service: Reader to Professor (Full Chair) Promotion Criteria',
    content: `As stipulated under Scheme of Service Section 1.5 for Academic Cadre (May 2024):
- Rank: Professor / Research Professor (CONUASS 07)
- Waiting Period: Minimum three (3) years on CONUASS 06 (Reader / Associate Professor).
- Qualification: Earned Doctorate (Ph.D.) is MANDATORY.
- Publication Benchmark: Cumulative minimum 70 publication points (books, proceedings, journals).
- Geographical & Authorship Distribution: Minimum thirty percent (30%) in international/foreign journals AND minimum thirty percent (30%) scored as sole or lead/corresponding author.
- Google Scholar Visibility (from 2025): Minimum 10 points / 100 citations (0.1 point per citation).
- Governance: Unanimous positive external assessments by renowned external assessors, Central A&PC recommendation, Senate notification, and Governing Council ratification.`
  },

  // =========================================================================
  // 8.0 SENIOR ADMINISTRATIVE & JUNIOR CADRE PROMOTION CRITERIA
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
3. Directorate & Established Positions (CONTISS 14 - Deputy Registrar, CONTISS 15 - Registrar): These are established quota posts requiring an official vacancy declaration by Management/Council before selection interviews can be conducted.
4. Prerequisites: Confirmed permanent appointment, satisfactory APER rating (minimum 50%), professional membership (e.g., NIM, ANUPA, CIPM), and clean disciplinary record.`
  },
  {
    id: 'jnr-promo-6-1-1',
    cadre: 'JUNIOR_STAFF',
    section: 'PROMOTIONS',
    sourceDocument: 'NOUN Rules and Regulations Governing Conditions of Service of Junior Staff (June 2024)',
    pageNumber: 30,
    citationRef: 'Section 6.1.1 - Junior Staff Promotion',
    title: 'Junior Staff Promotion, APER Score, and Waiting Period Guidelines',
    content: `Per Section 6.1.1 of the Junior Staff Conditions of Service (June 2024):
1. Statutory Waiting Period: Junior Staff on CONTISS 01 to 05 must serve a minimum of three (3) statutory calendar years on their current grade before becoming eligible for promotion consideration.
2. Annual Performance Evaluation Report (APER): A minimum benchmark score of 50% across the preceding three years is strictly required.
3. Disciplinary Clearance: Candidate must be free of active queries and adverse disciplinary records.
4. Confirmation of Appointment: Staff must have obtained official confirmation of appointment (minimum 2 years of probationary service).`
  },

  // =========================================================================
  // 9.0 ACADEMIC TAXONOMY & TEACHING WORKLOAD CAPS
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
  // 10.0 NOUN-HRMS END-USER & ADMINISTRATIVE MANUAL
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
- Stage 3: REGISTRY_DOCKETING (Registry Clerk verifies eligibility, checks APER/Query history, and attaches docket).
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
