export interface OfficialLeaveBooklet {
  id?: string;
  leaveApplicationId?: string;
  staffProfileId?: string;
  referenceNo?: string;

  // ── PART A: Staff Particulars & Leave Period (Items 1 - 17) ──
  leaveYear: number;                       // 1. Leave Year
  staffNo: string;                         // 2. Staff No
  fullName: string;                        // 3. Full Name: (Surname first)
  surname: string;
  otherNames: string;
  designation: string;                     // 4. Designation / Rank
  salaryScale: string;                     // 5. Salary Scale (e.g. CONUASS 05, CONTISS 08)
  dateOfAppointment: string;               // 6. Date of Appointment
  facultyDeptStudyCenter: string;          // 7. Faculty / Department / Study Center
  location: string;                        // 8. Location / Station
  phoneNo: string;                         // 9. Phone No
  officialEmail: string;                   // 10. Official Email
  dateResumedPreviousLeave: string;        // 11. Date Resumed Duty from previous Leave
  dateProceedingOnLeave: string;           // 12. Date Proceeding on Leave
  dateLeaveEnds: string;                   // 13. Date Leave Ends
  dateOfResumption: string;                // 14. Date of Resumption of duty
  staffSignature: string;                  // 15. Staff Signature (Base64 SVG/PNG or Stamp)
  staffSignatureDate: string;              // 16. Date
  reliefOfficerName?: string;              // 17. person responsible for duties during absence (if applicable)
  reliefOfficerStaffId?: string;
  reliefOfficerRank?: string;
  reliefOfficerDepartment?: string;

  // ── PART B: Immediate Supervisor / HOD Recommendation (Items 18 - 19) ──
  supervisorComment?: string;              // 18. comment by the Immediate Supervisor (HOD in the case of Academic Staff)
  supervisorName?: string;
  supervisorDesignation?: string;
  supervisorSignature?: string;            // 19. Signature
  supervisorSignatureDate?: string;        // 19. Date

  // ── PART C: Principal Officer / Dean / Director / Head of Unit (Items 20 - 21) ──
  deanDirectorComment?: string;            // 20. Comment by Principal Officer, Dean, Director or Head of Unit
  deanDirectorName?: string;
  deanDirectorTitle?: string;
  deanDirectorSignature?: string;          // 21. Signature
  deanDirectorSignatureDate?: string;      // 21. Date

  // ── PART D: Director of Human Resources (Items 22 - 24) ──
  directorHrComment?: string;              // 22. Comment by the Director (HR)
  directorHrSignature?: string;            // 23. Signature of Director / HR
  directorHrSignatureDate?: string;        // 24. Date
  directorHrName?: string;

  // ── PART E: The University Registrar (Items 25 - 26) ──
  registrarComment?: string;               // 25. comment(s) by the Registrar
  registrarSignature?: string;             // 26. Signature
  registrarSignatureDate?: string;         // 26. Date
  registrarName?: string;

  // Metadata & Workflow Status
  status:
    | 'DRAFT'
    | 'PENDING_SUPERVISOR'
    | 'PENDING_DEAN_DIRECTOR'
    | 'PENDING_HR_DIRECTOR'
    | 'PENDING_REGISTRAR'
    | 'APPROVED'
    | 'REJECTED';
  leaveType?: string;
  workingDays?: number;
  qrVerificationCode?: string;
  createdAt?: string;
  updatedAt?: string;
}
