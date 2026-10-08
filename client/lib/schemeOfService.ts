/**
 * National Open University of Nigeria (NOUN) Official Scheme of Service
 * Master Cadre, Post, Salary Scale, Qualifications & Promotion Progression Taxonomy
 */

export interface SchemePostDefinition {
  post: string;
  salaryScale: string;
  scaleType: 'CONUASS' | 'CONTISS';
  gradeLevel: number;
  minYearsWaiting: number;
  qualifications: string;
  nextGrade: string | null;
  nextSalaryScale?: string | null;
}

export interface SchemeCadreDefinition {
  cadre: string;
  category: 'ACADEMIC' | 'ADMINISTRATIVE' | 'BURSARY' | 'TECHNICAL' | 'HEALTH' | 'LEARNER_SUPPORT' | 'MEDIA_PRESS' | 'SECURITY';
  posts: SchemePostDefinition[];
}

export const NOUN_SCHEME_OF_SERVICE: SchemeCadreDefinition[] = [
  // 1.0 ACADEMIC CADRE
  {
    cadre: 'Academic Cadre',
    category: 'ACADEMIC',
    posts: [
      {
        post: 'Graduate Assistant / Assistant Research Officer / Assistant Librarian',
        salaryScale: 'CONUASS 01',
        scaleType: 'CONUASS',
        gradeLevel: 1,
        minYearsWaiting: 2,
        qualifications: 'A good honours degree not normally below 2nd Class Upper Division, subject to showing adequate aptitude for teaching and or research.',
        nextGrade: 'Assistant Lecturer / Assist. Research Fellow / Librarian II',
        nextSalaryScale: 'CONUASS 02'
      },
      {
        post: 'Assistant Lecturer / Assist. Research Fellow / Librarian II',
        salaryScale: 'CONUASS 02',
        scaleType: 'CONUASS',
        gradeLevel: 2,
        minYearsWaiting: 3,
        qualifications: "Direct appointment of candidate with Master's degree in relevant field plus NYSC. Promotion avenue for Graduate Assistant with at least 3 years experience.",
        nextGrade: 'Lecturer II / Research Fellow II / Librarian I',
        nextSalaryScale: 'CONUASS 03'
      },
      {
        post: 'Lecturer II / Research Fellow II / Librarian I',
        salaryScale: 'CONUASS 03',
        scaleType: 'CONUASS',
        gradeLevel: 3,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with Doctorate (Ph.D) in relevant field or Masters with 3 years post-graduation. Promotion avenue for Assistant Lecturer with at least 3 years experience.',
        nextGrade: 'Lecturer I / Research Fellow I / Senior Librarian',
        nextSalaryScale: 'CONUASS 04'
      },
      {
        post: 'Lecturer I / Research Fellow I / Senior Librarian',
        salaryScale: 'CONUASS 04',
        scaleType: 'CONUASS',
        gradeLevel: 4,
        minYearsWaiting: 3,
        qualifications: 'Ph.D with at least 3 years teaching/research experience and scholarly publications. Promotion avenue for Lecturer II with at least 3 years experience.',
        nextGrade: 'Senior Lecturer / Senior Research Fellow / Principal Librarian',
        nextSalaryScale: 'CONUASS 05'
      },
      {
        post: 'Senior Lecturer / Senior Research Fellow / Principal Librarian',
        salaryScale: 'CONUASS 05',
        scaleType: 'CONUASS',
        gradeLevel: 5,
        minYearsWaiting: 3,
        qualifications: 'Ph.D with minimum 6 years teaching/research experience, scholarly publications and ability to initiate research projects. Promotion avenue for Lecturer I with 3 years experience.',
        nextGrade: 'Reader / Associate Professor / Deputy Librarian',
        nextSalaryScale: 'CONUASS 06'
      },
      {
        post: 'Reader / Associate Professor / Deputy Librarian',
        salaryScale: 'CONUASS 06',
        scaleType: 'CONUASS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Ph.D with minimum 9 years teaching/research experience, outstanding scholarly publications and external assessment. Promotion avenue for Senior Lecturer with 3 years experience.',
        nextGrade: 'Professor / Research Professor',
        nextSalaryScale: 'CONUASS 07'
      },
      {
        post: 'Professor / Research Professor',
        salaryScale: 'CONUASS 07',
        scaleType: 'CONUASS',
        gradeLevel: 7,
        minYearsWaiting: 0,
        qualifications: 'Ph.D with minimum 12 years teaching/research experience, exceptional scholarly research and international external peer review.',
        nextGrade: null,
        nextSalaryScale: null
      },
      {
        post: 'University Librarian',
        salaryScale: 'CONUASS 07',
        scaleType: 'CONUASS',
        gradeLevel: 7,
        minYearsWaiting: 0,
        qualifications: 'Principal Officer appointment with requisite university library leadership experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 2.0 ACADEMIC PLANNING OFFICERS CADRE
  {
    cadre: 'Academic Planning Officers Cadre',
    category: 'ACADEMIC',
    posts: [
      {
        post: 'Asst. Academic Planning Officer / Statistician II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with B.A., B.Sc., B.Ed. in Education/Admin/Statistics/Mathematics.',
        nextGrade: 'Academic Planning Officer II / Statistician I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Academic Planning Officer II / Statistician I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Direct appointment with Master's Degree or BL, or Bachelor's with 3 years administrative experience.",
        nextGrade: 'Academic Planning Officer I / Senior Statistician',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Academic Planning Officer I / Senior Statistician',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Master's/BL with 3 years experience or Bachelor's with 6 years experience or Ph.D.",
        nextGrade: 'Principal Academic Planning Officer / Principal Statistician',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Senior Academic Planning Officer / Principal Statistician',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Master's/BL with 6 years or Bachelor's with 9 years or Ph.D with 3 years experience.",
        nextGrade: 'Principal Academic Planning Officer / Chief Statistician',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Principal Academic Planning Officer / Chief Statistician',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Promotion plus 12 or more years cognate academic planning experience.',
        nextGrade: 'Deputy Director, Academic Planning',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director, Academic Planning / Deputy Statistician',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Promotion plus 15 or more years experience, subject to vacancy.',
        nextGrade: 'Director, Academic Planning',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director, Academic Planning',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Promotion plus 18 years experience or appointment of NOUN staff not below rank of Professor.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 3.1 ADMINISTRATIVE OFFICER CADRE
  {
    cadre: 'Administrative Officer Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Administrative Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment of candidate possessing a good honours degree from a recognised university.',
        nextGrade: 'Administrative Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Administrative Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Degree with 3 years experience or Master's or BL. Promotion avenue for AO II with 3 years experience.",
        nextGrade: 'Assistant Registrar',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Assistant Registrar',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Degree with 6 years or Master's/BL with 3 years or Ph.D. Promotion avenue for AO I with 3 years experience.",
        nextGrade: 'Senior Assistant Registrar',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Senior Assistant Registrar',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Degree with 9 years or Master's/BL with 6 years or Ph.D with 3 years experience. Promotion for AR with 4 years.",
        nextGrade: 'Principal Assistant Registrar',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Principal Assistant Registrar',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Degree with 12 years or Master's/BL with 9 years or Ph.D with 6 years. Promotion for SAR with 4 years.",
        nextGrade: 'Deputy Registrar',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Registrar',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: "Degree with 15 years or Master's/BL with 12 years or Ph.D with 9 years. Promotion for PAR with 4 years subject to vacancy.",
        nextGrade: 'Director',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Promotion avenue for Deputy Registrar with 10 years experience or direct appointment with Ph.D and 4 years managerial experience.',
        nextGrade: null,
        nextSalaryScale: null
      },
      {
        post: 'Registrar',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: "Principal Officer. Master's degree with 15 years university administrative experience.",
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 3.2 EXECUTIVE OFFICER CADRE
  {
    cadre: 'Executive Officer Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Executive Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: "OND in relevant field with 2 years experience or HSC/GCE 'A' Level with 4 years experience.",
        nextGrade: 'Higher Executive Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Executive Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND/ACIS in relevant field. Promotion avenue for EO with 3 years experience.',
        nextGrade: 'Senior Executive Officer II',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Executive Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'University degree/HND with 2 years experience. Promotion avenue for HEO with 3 years experience.',
        nextGrade: 'Principal Executive Officer II',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Executive Officer II',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 4 years experience. Promotion for SEO with 3 years. Terminal point for OND holders.',
        nextGrade: 'Principal Executive Officer I',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Executive Officer I',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 6 years experience. Promotion for PEO II with 4 years experience.',
        nextGrade: 'Assistant Chief Executive Officer (ACEO)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Executive Officer (ACEO)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Qualifications as PEO I with 8 years experience. Promotion for PEO I with 4 years experience.',
        nextGrade: 'Chief Executive Officer (CEO)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Executive Officer (CEO)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Qualifications as ACEO with 12 years post-qualification experience. Promotion for ACEO with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 3.3 SECRETARIAL OFFICER CADRE
  {
    cadre: 'Secretarial Officer Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Confidential Secretary II',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'WASC/GCE O/Level plus RSA 100/50 wpm shorthand/typing with 4 years stenographic experience.',
        nextGrade: 'Confidential Secretary I',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Confidential Secretary I',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: '120/50 wpm RSA with 6 years experience or B.Sc/HND Secretarial Studies. Promotion for CS II with 3 years.',
        nextGrade: 'Senior Confidential Secretary',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Confidential Secretary',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: '120/50 wpm with 8 years experience. Promotion for CS I with 3 years satisfactory service.',
        nextGrade: 'Principal Confidential Secretary II',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Confidential Secretary II',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: '120/50 wpm with 8 years experience. Promotion for Senior Confidential Secretary with 3 years service.',
        nextGrade: 'Principal Confidential Secretary I',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Confidential Secretary I',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: '120/50 wpm plus 15 years experience or graduate with proven ability. Promotion for PCS II with 4 years.',
        nextGrade: 'Assistant Chief Confidential Secretary',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Confidential Secretary',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Promotion avenue for Principal Confidential Secretary I with minimum 4 years satisfactory service.',
        nextGrade: 'Chief Confidential Secretary',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Confidential Secretary',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Promotion avenue for Assistant Chief Confidential Secretary with minimum 4 years satisfactory service.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 3.4 SECRETARIAL ASSISTANT CADRE
  {
    cadre: 'Secretarial Assistant Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Senior Secretarial Assistant II',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Secondary Class IV / Modern III plus RSA 50 wpm in Typewriting plus 4 years computer operator experience.',
        nextGrade: 'Senior Secretarial Assistant I',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Senior Secretarial Assistant I',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Promotion avenue for Senior Computer Operator II on completion of minimum 3 years satisfactory service.',
        nextGrade: 'Chief Secretarial Assistant',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Chief Secretarial Assistant',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 0,
        qualifications: 'Promotion avenue for Senior Computer Operator I on completion of minimum 3 years satisfactory service.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 3.5 TRANSPORT OFFICER CADRE
  {
    cadre: 'Transport Officer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Transport Supervisor',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Primary School Leaving Certificate plus Driver/Mechanic Trade Test Grade III plus 15 years experience.',
        nextGrade: 'Senior Transport Supervisor',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Senior Transport Supervisor',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Trade Test III with 18 years experience or degree in Transport Tech. Promotion for Transport Supervisor.',
        nextGrade: 'Principal Transport Supervisor',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Principal Transport Supervisor',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Trade Test III plus 18 years experience or degree in Transport Tech plus NITT certificate.',
        nextGrade: 'Assistant Chief Transport Supervisor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Assistant Chief Transport Supervisor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 4,
        qualifications: 'Promotion for Principal Transport Supervisor with 4 years waiting period. Must be Chartered (NITT).',
        nextGrade: 'Chief Transport Supervisor',
        nextSalaryScale: 'CONTISS 10'
      },
      {
        post: 'Chief Transport Supervisor',
        salaryScale: 'CONTISS 10',
        scaleType: 'CONTISS',
        gradeLevel: 10,
        minYearsWaiting: 0,
        qualifications: 'Promotion for Assistant Chief Transport Supervisor with 4 years waiting period, subject to vacancy. Must be Chartered.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 4.1 STUDENT COUNSELLOR CADRE
  {
    cadre: 'Student Counsellor Cadre',
    category: 'LEARNER_SUPPORT',
    posts: [
      {
        post: 'Counsellor II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Good honours degree in Psychology, Guidance & Counselling or Counselling Psychology plus NYSC.',
        nextGrade: 'Counsellor I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Counsellor I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Promotion for Counsellor II with 3 years service or direct appointment with Master's degree in Guidance & Counselling.",
        nextGrade: 'Senior Counsellor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Counsellor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Post-graduate degree with 3 years university counselling/teaching experience plus publications. Promotion for Counsellor I with 4 years.',
        nextGrade: 'Principal Counsellor',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Counsellor',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Post-graduate degree with 6 years experience. Promotion for Senior Counsellor with 4 years. Membership of CASSON/APROCON.',
        nextGrade: 'Chief Counsellor',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Counsellor',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Post-graduate degree with 9 years experience. Promotion for Principal Counsellor with 4 years experience.',
        nextGrade: 'Deputy Director (Counselling)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Counselling)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: "Master's degree with 12 years experience. Promotion for Chief Counsellor with 4 years experience.",
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.1 ACCOUNTANT CADRE
  {
    cadre: 'Accountant Cadre',
    category: 'BURSARY',
    posts: [
      {
        post: 'Accountant II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. Accountancy or HND in Accounting or Professional exam Part I ACA, ACCA, ANAN or equivalent.',
        nextGrade: 'Accountant I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Accountant I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 3 years experience or ANAN final. Promotion for Accountant II with 3 years.',
        nextGrade: 'Senior Accountant',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Accountant',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'B.Sc/HND with 6 years experience or professional qualification (ICAN/ANAN/ACCA). Promotion for Accountant I with 3 years.',
        nextGrade: 'Principal Accountant',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Accountant',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'B.Sc/HND with 9 years experience or professional ICAN/ANAN/ACCA with 4 years. Terminal point without professional qualification.',
        nextGrade: 'Chief Accountant',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Accountant',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'B.Sc. Accountancy with 12 years experience plus professional ICAN/ANAN/ACCA with 6 years. Promotion for Principal Accountant with 4 years.',
        nextGrade: 'Deputy Bursar',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Bursar',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with ICAN/ANAN/ACCA and 15 years post-qualification cognate experience. Promotion for Chief Accountant with 4 years.',
        nextGrade: 'Bursar',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Bursar',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Principal Officer. B.Sc/HND in Accountancy with ICAN/ANAN/ACCA and 18 years post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.2 EXECUTIVE OFFICERS (ACCOUNTS) CADRE
  {
    cadre: 'Executive Officers (Accounts) Cadre',
    category: 'BURSARY',
    posts: [
      {
        post: 'Executive Officer (Accounts)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'National Diploma in Accounting with 3 years relevant post-qualification experience.',
        nextGrade: 'Higher Executive Officer (Accounts)',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Executive Officer (Accounts)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'ND in Accounting with 6 years experience. Promotion for Executive Officer (Accounts) with 3 years.',
        nextGrade: 'Senior Executive Officer (Accounts)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Executive Officer (Accounts)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'ND with 9 years experience. Promotion for HEO (Accounts) with 3 years.',
        nextGrade: 'Principal Executive Officer II (Accounts)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Executive Officer II (Accounts)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 0,
        qualifications: 'Promotion for SEO (Accounts) with 3 years experience. Terminal point for OND holders.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.3 STORE OFFICER CADRE (B.SC HOLDERS)
  {
    cadre: 'Store Officer Cadre (B.Sc Holders)',
    category: 'BURSARY',
    posts: [
      {
        post: 'Stores Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: "Bachelor's degree in Purchasing & Supply or equivalent.",
        nextGrade: 'Stores Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Stores Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Bachelor's degree with 4 years experience. Promotion for Stores Officer II.",
        nextGrade: 'Senior Stores Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Stores Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Bachelor's degree with 7 years experience. Promotion for Stores Officer I.",
        nextGrade: 'Principal Stores Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Stores Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Bachelor's degree with 9 years experience. Terminal point without professional qualification.",
        nextGrade: 'Deputy Chief Stores Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Deputy Chief Stores Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Bachelor's degree with 14 years experience plus CIMPN certification.",
        nextGrade: 'Chief Stores Officer',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Chief Stores Officer',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'University degree with 15 years experience and CIMPN certification.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.4 STORE OFFICER CADRE (HND HOLDERS)
  {
    cadre: 'Store Officer Cadre (HND Holders)',
    category: 'BURSARY',
    posts: [
      {
        post: 'Assistant Stores Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'National Diploma in Purchasing & Supply with 3 years experience.',
        nextGrade: 'Higher Stores Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Stores Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND in Purchasing & Supply / Accounting / Business Management.',
        nextGrade: 'Store Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Store Officer I (HND)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'ND with 7 years or HND with 3 years experience.',
        nextGrade: 'Senior Stores Officer (HND)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Stores Officer (HND)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 4,
        qualifications: 'ND with 6 years experience plus CIMPN Certificate. Terminal point for ND.',
        nextGrade: 'Principal Stores Officer (HND)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Stores Officer (HND)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'HND with 9 years experience. Terminal point without professional qualification.',
        nextGrade: 'Assistant Chief Stores Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Stores Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'HND with 12 years experience. Promotion for Principal Stores Officer.',
        nextGrade: 'Deputy Chief Stores Officer (HND)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Deputy Chief Stores Officer (HND)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'HND with 14 years experience. Terminal point for HND qualification.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.5 INTERNAL AUDIT CADRE
  {
    cadre: 'Internal Audit Cadre',
    category: 'BURSARY',
    posts: [
      {
        post: 'Auditor II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. or HND in Accounting or equivalent.',
        nextGrade: 'Auditor I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Auditor I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'B.Sc./HND in Accounting with 3 years experience. Promotion for Auditor II.',
        nextGrade: 'Senior Internal Auditor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Internal Auditor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'B.Sc./HND with 5 years experience or ACA/CNA. Promotion for Auditor I.',
        nextGrade: 'Principal Internal Auditor',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Internal Auditor',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'B.Sc./HND with 6 years or ACA/CNA. Terminal point without professional qualification.',
        nextGrade: 'Chief Internal Auditor',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Internal Auditor',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Full professional membership (ACCA, ACA, CNA, CPA) plus 10 years experience.',
        nextGrade: 'Deputy Director (Audit)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Audit)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Qualifications as Chief Internal Auditor with 12 years experience.',
        nextGrade: 'Director (Audit)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Audit)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'B.Sc./HND Accounting with full professional membership plus 15 years post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 5.6 INTERNAL AUDIT EXECUTIVE CADRE
  {
    cadre: 'Internal Audit Executive Cadre',
    category: 'BURSARY',
    posts: [
      {
        post: 'Higher Executive Officer (Audit)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND & other discipline.',
        nextGrade: 'Senior Executive Officer (Audit)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Executive Officer (Audit)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'HND with 3 years experience. Promotion for HEO (Audit).',
        nextGrade: 'Principal Executive Officer II (Audit)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Executive Officer II (Audit)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'HND with 8 years audit experience. Promotion for SEO (Audit).',
        nextGrade: 'Principal Executive Officer I (Audit)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Executive Officer I (Audit)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'HND with 12 years audit experience. Promotion for PEO II (Audit).',
        nextGrade: 'Assistant Chief Executive Officer (Audit)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Executive Officer (Audit)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'HND with 16 years experience. Promotion for PEO I (Audit).',
        nextGrade: 'Chief Executive Officer (Audit)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Executive Officer (Audit)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'HND with 20 years audit experience. Promotion for ACEO (Audit).',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 6.0 LEGAL OFFICER CADRE
  {
    cadre: 'Legal Officer Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Legal Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment of candidate with LLB and BL.',
        nextGrade: 'Senior Legal Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Legal Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'LLB and BL with at least 3 years legal practice experience.',
        nextGrade: 'Principal Legal Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Legal Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'LLB and BL with at least 6 years legal experience.',
        nextGrade: 'Assistant Chief Legal Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Assistant Chief Legal Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'LLB and BL with at least 9 years legal experience.',
        nextGrade: 'Deputy Chief Legal Officer',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Chief Legal Officer',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'LLB and BL with at least 12 years legal experience.',
        nextGrade: 'Chief Legal Officer',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Chief Legal Officer',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'LLB and BL with at least 15 years university/corporate legal practice experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 7.1 SYSTEM PROGRAMMER CADRE
  {
    cadre: 'System Programmer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Systems Programmer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree/HND in Computer Science.',
        nextGrade: 'Systems Programmer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Systems Programmer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree in Computer Science with 2 years programming experience.',
        nextGrade: 'Senior Systems Programmer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Systems Programmer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree in Computer Science with 6 years experience or higher degree with 3 years.',
        nextGrade: 'Principal System Programmer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal System Programmer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Higher degree in Computer Science with 9 years experience or HND with 12 years.',
        nextGrade: 'Chief System Programmer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief System Programmer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Higher degree in Computer Science with 12 years professional experience.',
        nextGrade: 'Deputy Director (Programming)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Programming)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Ph.D. degree in Computer Science plus 15 years administrative experience.',
        nextGrade: 'Director (ICT)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (ICT)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Ph.D in Computer Science with 18 years extensive ICT management experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 7.2 SYSTEM ANALYSTS CADRE
  {
    cadre: 'System Analysts Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'System Analyst II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree in Computer Science/Informatics.',
        nextGrade: 'Systems Analyst I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Systems Analyst I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree in Computer Science plus 2 years Data Processing experience.',
        nextGrade: 'Senior Systems Analyst',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Systems Analyst',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree with formal training in Systems Analysis plus 2 years analysis and design experience.',
        nextGrade: 'Principal Systems Analyst',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Systems Analyst',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree in Computer Science with 6 years professional experience in Computer Applications.',
        nextGrade: 'Chief Systems Analyst',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Systems Analyst',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Degree in Computer Science with 8 years experience in large systems implementation.',
        nextGrade: 'Deputy Director (Systems Analysis)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Systems Analysis)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Degree with 10 years extensive experience in computer applications and 2 years administrative.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 7.3 OPERATORS CADRE
  {
    cadre: 'Operators Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Data Analyst I / Machine Room Supervisor',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'City & Guilds with 3-4 years experience in data processing.',
        nextGrade: 'Data Controller / Senior Machine Room Supervisor',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Data Controller / Senior Machine Room Supervisor',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND in Data Processing with 5 years experience.',
        nextGrade: 'Asst. Operations Manager',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Asst. Operations Manager',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 2 years or City & Guilds with 6 years experience in operations.',
        nextGrade: 'Operations Manager',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Operations Manager',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND in Data Processing with 4 years or City & Guilds with 7 years.',
        nextGrade: 'Principal Operations Manager',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Operations Manager',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 6 years experience in operations management/data control.',
        nextGrade: 'Chief Operations Manager',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Operations Manager',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Degree/HND with 6 years experience in Operations Management. Promotion for POM with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 7.4 HARDWARE/NETWORK ENGINEER CADRE
  {
    cadre: 'Hardware/Network Engineer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Hardware/Network Engineer Grade II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree in Electrical/Electronics Engineering registrable with COREN plus NYSC.',
        nextGrade: 'Hardware/Network Engineer Grade I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Hardware/Network Engineer Grade I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'COREN registration plus 3 years post-qualification experience.',
        nextGrade: 'Hardware/Network Senior Engineer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Hardware/Network Senior Engineer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'COREN registered Engineer with 6 years post-qualification experience.',
        nextGrade: 'Hardware/Network Principal Engineer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Hardware/Network Principal Engineer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 9 years post-qualification experience.',
        nextGrade: 'Deputy Chief Hardware/Network Engineer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Deputy Chief Hardware/Network Engineer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 12 years experience. Promotion for Principal Engineer.',
        nextGrade: 'Chief Hardware/Network Engineer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Hardware/Network Engineer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 12 years experience. Promotion for Principal Engineer.',
        nextGrade: 'Deputy Director (Hardware/Network)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Hardware/Network)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 15 years experience. Promotion for Chief Engineer with 4 years.',
        nextGrade: 'Director (Hardware/Network)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Hardware/Network)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'COREN registered Engineer with 18 years of post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.1 ARCHITECT CADRE
  {
    cadre: 'Architect Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Architect II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree registrable with NIA plus NYSC discharge.',
        nextGrade: 'Architect I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Architect I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'B.Arch/M.Sc Arch registrable with NIA with 3 years experience.',
        nextGrade: 'Senior Architect',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Architect',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Registered architect with 6 years post-qualification experience.',
        nextGrade: 'Principal Architect',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Architect',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Registered Architect with 9 years experience. Promotion for Senior Architect with 4 years.',
        nextGrade: 'Deputy Chief Architect',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Deputy Chief Architect',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'B.Arch/M.Sc Arch plus ARCON membership with 9 years experience.',
        nextGrade: 'Chief Architect',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Architect',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Registered architect with 12 years experience. Promotion for Principal Architect.',
        nextGrade: 'Deputy Director, Physical Planning',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director, Physical Planning',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Registered Architect with 15 years experience. Promotion for Chief Architect.',
        nextGrade: 'Director (Physical Planning)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Physical Planning)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Registered Architect with at least 18 years post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 9.2 QUANTITY SURVEYORS CADRE
  {
    cadre: 'Quantity Surveyors Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Quantity Surveyor Grade II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 2,
        qualifications: 'Degree in Quantity Surveying or RICS/NIQS final examination.',
        nextGrade: 'Quantity Surveyor Grade I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Quantity Surveyor Grade I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 2,
        qualifications: 'Confirmed QS Grade II after 2-year pupillage or direct with 3 years cognate experience.',
        nextGrade: 'Senior Quantity Surveyor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Quantity Surveyor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Confirmed QS Grade I with 2 years or direct appointment with 5 years experience.',
        nextGrade: 'Principal Quantity Surveyor',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Quantity Surveyor',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'NIQS registration plus 9 years experience. Promotion for QS Grade I with 4 years.',
        nextGrade: 'Deputy Chief Surveyor',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Deputy Chief Surveyor',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'NIQS registered with 12 years cognate experience.',
        nextGrade: 'Chief Quantity Surveyor',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Quantity Surveyor',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'B.Sc./HND in Estate Management/QS with NIVS/NIQS plus 10 years experience.',
        nextGrade: 'Deputy Director (Quantity Surveying)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Quantity Surveying)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Direct appointment with 15 years experience or promotion for Chief QS with 4 years.',
        nextGrade: 'Director of Physical Planning & Development',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director of Physical Planning & Development',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: '18 years post-qualification cognate experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.3 ENGINEERS CADRE (Civil, Electrical, Mechanical)
  {
    cadre: 'Engineers Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Engineer Grade II (Civil/Elec/Mech)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree in Engineering (Civil, Electrical or Mechanical) registrable with COREN plus NYSC.',
        nextGrade: 'Engineer Grade I (Civil/Elec/Mech)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Engineer Grade I (Civil/Elec/Mech)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'COREN registration plus 3 years post-qualification experience. Promotion for Engineer II.',
        nextGrade: 'Senior Engineer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Engineer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'COREN registered Engineer with 6 years experience. Promotion for Engineer I.',
        nextGrade: 'Principal Engineer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Engineer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 9 years experience. Promotion for Senior Engineer with 4 years.',
        nextGrade: 'Deputy Chief Engineer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Deputy Chief Engineer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 12 years experience.',
        nextGrade: 'Chief Engineer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Engineer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 12 years experience. Promotion for Principal Engineer with 4 years.',
        nextGrade: 'Deputy Director (Engineering)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Engineering)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'COREN registered Engineer with 15 years experience. Promotion for Chief Engineer with 4 years.',
        nextGrade: 'Director (Engineering Services)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Engineering Services)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'COREN Registered Engineer plus 18 years of post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.4 ESTATE OFFICER CADRE
  {
    cadre: 'Estate Officer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Assistant Estate Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'OND/ONC in Estate Management with 3 years experience.',
        nextGrade: 'Estate Officer Grade II',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Estate Officer Grade II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. or HND in Estate Management registerable with NIVS.',
        nextGrade: 'Estate Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Estate Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'B.Sc./HND in Estate Management with NIVS. Promotion for Estate Officer II.',
        nextGrade: 'Senior Estate Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Estate Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'B.Sc./HND with NIVS. Promotion for Estate Officer I with 3 years.',
        nextGrade: 'Principal Estate Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Estate Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'B.Sc./HND in Estate Management with NIVS plus 6 years post-qualification.',
        nextGrade: 'Assistant Chief Estate Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Estate Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'B.Sc./HND with NIVS plus 9 years. Promotion for Principal Estate Officer with 4 years.',
        nextGrade: 'Deputy Chief Estate Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Deputy Chief Estate Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'B.Sc./HND in Estate Management with NIVS plus 10 years experience. Terminal for HND.',
        nextGrade: 'Chief Estate Officer',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Chief Estate Officer',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'B.Sc. in Estate Management with NIVS plus 15 years experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.5 PLANNING OFFICER CADRE
  {
    cadre: 'Planning Officer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Planner II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. in Urban & Regional Planning or Town Planning registerable with NITP.',
        nextGrade: 'Planner I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Planner I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. in Urban & Regional Planning with NITP. Promotion for Planner II.',
        nextGrade: 'Senior Planner',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Planner',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'NITP registration plus 3 years post-qualification experience.',
        nextGrade: 'Principal Planner',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Planner',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Promotion avenue for Senior Planner with at least 4 years waiting period.',
        nextGrade: 'Chief Planner',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Planner',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Promotion avenue for Principal Planner with at least 4 years waiting period.',
        nextGrade: 'Deputy Director (Town Planning)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Town Planning)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Promotion for Chief Planner with at least 4 years waiting period, subject to vacancy.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.6 PLANNING OFFICER CADRE (EXECUTIVE)
  {
    cadre: 'Planning Officer Cadre (Executive)',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Executive Officer (Planning)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'OND in Urban & Regional Planning with 3 years experience.',
        nextGrade: 'Higher Executive Officer (Planning)',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Executive Officer (Planning)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND in Urban & Regional Planning registerable with NITP.',
        nextGrade: 'Senior Executive Officer (Planning)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Executive Officer (Planning)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Promotion for HEO (Planning) with 3 years.',
        nextGrade: 'Principal Executive Officer II (Planning)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Executive Officer II (Planning)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Direct with NITP plus 3 years or promotion for SEO (Planning) with 3 years.',
        nextGrade: 'Principal Executive Officer I (Planning)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Executive Officer I (Planning)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Promotion for PEO II (Planning) with at least 4 years waiting period.',
        nextGrade: 'Assistant Chief Executive Officer (Planning)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Executive Officer (Planning)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'B.Sc. in Urban & Regional Planning. Promotion for PEO I (Planning) with 4 years.',
        nextGrade: 'Chief Executive Officer (Planning)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Executive Officer (Planning)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Promotion for ACEO (Planning) with 4 years. Terminal for HND.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.7 PROJECT OFFICER CADRE
  {
    cadre: 'Project Officer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Project Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. in Urban & Regional Planning or Town Planning with NITP.',
        nextGrade: 'Project Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Project Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'B.Sc. with NITP. Promotion for Project Officer II with 3 years.',
        nextGrade: 'Senior Project Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Project Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'NITP registration with 3 years post-qualification. Promotion for Project Officer I.',
        nextGrade: 'Principal Project Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Project Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Promotion for Senior Project Officer with at least 4 years waiting period.',
        nextGrade: 'Chief Project Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Project Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Promotion for Principal Project Officer with 4 years waiting period.',
        nextGrade: 'Deputy Director (Projects)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Projects)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Promotion for Chief Project Officer with at least 4 years waiting period.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 8.8 ARTISAN CADRE
  {
    cadre: 'Artisan Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Workshop Supervisor',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Primary School Leaving Certificate plus Trade Test Class I with 12 years experience.',
        nextGrade: 'Senior Workshop Supervisor',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Senior Workshop Supervisor',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 0,
        qualifications: 'Primary School Leaving Certificate with Trade Test and advanced management training.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 9.0 PROCUREMENT OFFICER CADRE
  {
    cadre: 'Procurement Officer Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Procurement Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Honours degree in Engineering/Architecture/QS/Estate Management or Management/Marketing/Economics.',
        nextGrade: 'Procurement Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Procurement Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree with 3 years experience. Promotion for Procurement Officer II with 3 years.',
        nextGrade: 'Senior Procurement Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Procurement Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree with 6 years experience. Promotion for Procurement Officer I with 4 years.',
        nextGrade: 'Principal Procurement Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Procurement Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree with 9 years experience. Must be member of relevant Professional Body (CIPSMN).',
        nextGrade: 'Chief Procurement Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Procurement Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Degree with 15 years Postgraduate experience and professional qualification (CIPSMN).',
        nextGrade: 'Deputy Director (Procurement)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Procurement)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Degree with 18 years experience and CIPSMN membership. Promotion for Chief Procurement Officer.',
        nextGrade: 'Director (Procurement)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Procurement)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Appointment of candidate with 18+ years procurement executive experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 10.1 TECHNICAL OFFICER – CARTOGRAPHER CADRE
  {
    cadre: 'Technical Officer – Cartographer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Technical Officer (Cartographer)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: "GCE 'A' Level or OND or Full Technological Certificate of City & Guilds plus 3 years experience.",
        nextGrade: 'Higher Technical Officer (Cartographer)',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Technical Officer (Cartographer)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND in Engineering or allied subject. Promotion for Technical Officer.',
        nextGrade: 'Senior Technical Officer (Cartographer)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Technical Officer (Cartographer)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: '7 years experience. Promotion for Higher Technical Officer.',
        nextGrade: 'Principal Technical Officer II (Cartographer)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Technical Officer II (Cartographer)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: '9-11 years cognate experience. Promotion for Senior Technical Officer.',
        nextGrade: 'Principal Technical Officer I (Cartographer)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Technical Officer I (Cartographer)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'HND with 9 years experience. Promotion for PTO II with 4 years satisfactory service.',
        nextGrade: 'Assistant Chief Technical Officer (Cartographer)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Technical Officer (Cartographer)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'HND with 10 years experience. Promotion for PTO I with 4 years service.',
        nextGrade: 'Chief Technical Officer (Cartographer)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Technical Officer (Cartographer)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'HND with 12 years experience. Promotion for ACTO with 4 years service.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 10.2 SCIENCE LABORATORY TECHNOLOGIST CADRE
  {
    cadre: 'Science Laboratory Technologist Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Senior Assistant Technologist',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'OND, ANIST, AIST in Science Laboratory Technology.',
        nextGrade: 'Technologist II',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Technologist II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree or Diploma registerable with IMLT of Nigeria or NIST. Promotion for Senior Assistant Technologist.',
        nextGrade: 'Technologist I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Technologist I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Qualifications as for Tech II plus 3 years experience. Promotion for Technologist II with 3 years.',
        nextGrade: 'Senior Technologist',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Technologist',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Qualifications as for Tech I plus 6 years experience. Promotion for Technologist I with 3 years.',
        nextGrade: 'Principal Technologist',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Technologist',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: '9 years laboratory experience or Fellowship/M.Sc plus 6 years. Promotion for Senior Technologist with 4 years.',
        nextGrade: 'Assistant Chief Technologist',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Technologist',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: '12 years post-qualification experience. Promotion for Principal Technologist with 4 years.',
        nextGrade: 'Chief Technologist',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Technologist',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: '13 years post-qualification experience or 9 years university lab experience plus Fellowship/M.Sc.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 10.3 TECHNICAL OFFICERS CADRE (HND)
  {
    cadre: 'Technical Officers Cadre (HND)',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Technical Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'OND/ND with 2 years or Grade I Trade Test with 7 years or FTC with 5 years experience.',
        nextGrade: 'Higher Technical Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Technical Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND/HNC in relevant engineering/technical field. Promotion for Technical Officer with 4 years.',
        nextGrade: 'Senior Technical Officer',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Technical Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'HND/HNC with 4 years experience. Promotion for HTO with 4 years.',
        nextGrade: 'Principal Technical Officer II',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Technical Officer II',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'HND/HNC with 6 years experience. Terminal point for ND candidates.',
        nextGrade: 'Principal Technical Officer I',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Technical Officer I',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'HND/HNC with 9 years experience. Promotion for PTO II with 4 years.',
        nextGrade: 'Assistant Chief Technical Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Technical Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'HND/HNC with 10 years experience. Promotion for PTO I with 4 years.',
        nextGrade: 'Chief Technical Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Technical Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'HND/HNC with 12 years experience. Promotion for ACTO with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 11.1 PUBLIC HEALTH CADRE
  {
    cadre: 'Public Health Cadre',
    category: 'HEALTH',
    posts: [
      {
        post: 'Health Sister',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Registered Nurse and Midwife Certificate plus Diploma in Public Health Nursing.',
        nextGrade: 'Senior Health Sister',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Health Sister',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Health Sister with 3 years cognate experience. Promotion for Health Sister with 4 years.',
        nextGrade: 'Principal Health Sister / Matron',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Health Sister / Matron',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Health Sister with 7 years cognate experience. Promotion for Senior Health Sister with 4 years.',
        nextGrade: 'Assistant Chief Health Sister / Senior Matron',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Health Sister / Senior Matron',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Health Sister with 10 years experience. Promotion for Principal Health Sister with 4 years.',
        nextGrade: 'Chief Health Sister / Chief Matron',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Health Sister / Chief Matron',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Health Sister with 13 years experience. Promotion for Assistant Chief Health Sister with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 11.2 PHARMACIST CADRE
  {
    cadre: 'Pharmacist Cadre',
    category: 'HEALTH',
    posts: [
      {
        post: 'Pharmacist Grade II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree in Pharmacy registerable with Pharmacists Council of Nigeria plus 1 year pupillage.',
        nextGrade: 'Pharmacist Grade I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Pharmacist Grade I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Pharmacist with 3 years experience. Promotion for Pharmacist Grade II with 3 years.',
        nextGrade: 'Senior Pharmacist',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Pharmacist',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Registered Pharmacist with 5 years experience. Promotion for Pharmacist Grade I with 3 years.',
        nextGrade: 'Principal Pharmacist',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Pharmacist',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Registered Pharmacist with 9 years experience. Promotion for Senior Pharmacist with 4 years.',
        nextGrade: 'Assistant Chief Pharmacist',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Assistant Chief Pharmacist',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Registered Pharmacist with 10 years experience. Promotion for Principal Pharmacist with 4 years.',
        nextGrade: 'Chief Pharmacist',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Chief Pharmacist',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Registered Pharmacist with 12 years experience. Promotion for Assistant Chief Pharmacist with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 11.3 NURSING OFFICER CADRE
  {
    cadre: 'Nursing Officer Cadre',
    category: 'HEALTH',
    posts: [
      {
        post: 'Staff Nurse/Midwife / Nursing Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'NRN and NRM Certificate duly registered with Nursing and Midwifery Council of Nigeria with 4 years experience.',
        nextGrade: 'Nursing Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Nursing Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Nursing Officer II with 3 years on the post. Promotion for Nursing Officer II.',
        nextGrade: 'Senior Nursing Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Nursing Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Nursing Officer with 10 years post-qualification in SCM/NRN. Promotion for Nursing Officer I with 3 years.',
        nextGrade: 'Principal Nursing Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Nursing Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Nursing Officer with 14 years experience. Promotion for Senior Nursing Officer with 4 years.',
        nextGrade: 'Assistant Chief Nursing Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Nursing Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Nursing Officer with 17 years experience. Promotion for Principal Nursing Officer with 4 years.',
        nextGrade: 'Chief Nursing Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Nursing Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Nursing Officer with 17+ years experience and 4 years as Assistant Chief Nursing Officer.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 11.4 MEDICAL OFFICER CADRE
  {
    cadre: 'Medical Officer Cadre',
    category: 'HEALTH',
    posts: [
      {
        post: 'Medical Officer II',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'MBBS/MBChB with 1-year Housemanship and full registration with Medical and Dental Council of Nigeria (MDCN).',
        nextGrade: 'Medical Officer I',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Medical Officer I',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Medical Officer II with 3 years post-registration experience. Promotion for MO II with 3 years.',
        nextGrade: 'Senior Medical Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Senior Medical Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Medical Officer with 6 years post-registration experience or specialist with 6 years in specialty.',
        nextGrade: 'Principal Medical Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Principal Medical Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Medical Officer with 10 years experience or specialist with 10 years in specialty.',
        nextGrade: 'Chief Medical Officer',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Chief Medical Officer',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Medical Officer with 15 years post-registration experience or specialist with 10 years in specialty.',
        nextGrade: 'Director of Health Services',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director of Health Services',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Medical Officer with 18+ years experience with specialist standing and environmental/clinical leadership.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 11.5 MEDICAL PHOTOGRAPHERS/ARTIST CADRE
  {
    cadre: 'Medical Photographers/Artist Cadre',
    category: 'HEALTH',
    posts: [
      {
        post: 'Medical Photographer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'City & Guilds in Applied Photography / AIMBI / Diploma in Applied Graphics.',
        nextGrade: 'Higher Medical Photographer/Artist',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Medical Photographer/Artist',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Medical Photographer with 3 years post-qualification experience.',
        nextGrade: 'Senior Medical Photographer/Artist',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Medical Photographer/Artist',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Medical Photographer with 6 years post-qualification experience.',
        nextGrade: 'Principal Medical Photographer/Artist',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Medical Photographer/Artist',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 4,
        qualifications: 'Medical Photographer with 9 years post-qualification experience.',
        nextGrade: 'Asst. Chief Medical Photographer/Artist',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Asst. Chief Medical Photographer/Artist',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Medical Photographer with 12 years post-qualification experience.',
        nextGrade: 'Chief Medical Photographer/Artist',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Chief Medical Photographer/Artist',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Medical Photographer with 15 years post-qualification experience.',
        nextGrade: 'Photographic Director/Artist',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Photographic Director/Artist',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Medical Photographer with 15+ years experience and executive media portfolio.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 12.0 LIBRARY OFFICER CADRE
  {
    cadre: 'Library Officer Cadre',
    category: 'ACADEMIC',
    posts: [
      {
        post: 'Library Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'WASC plus Diploma in Library Studies from a recognised University.',
        nextGrade: 'Higher Library Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Library Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Diploma in Library Studies with 3 years experience. Promotion for Library Officer.',
        nextGrade: 'Senior Library Officer',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Library Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Diploma in Library Studies with 5 years experience. Promotion for HLO.',
        nextGrade: 'Principal Library Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Library Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 4,
        qualifications: 'Diploma in Library Studies with 7 years experience. Promotion for SLO with 4 years.',
        nextGrade: 'Assistant Chief Library Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Assistant Chief Library Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Diploma in Library Studies with 9 years experience. Promotion for PLO with 4 years.',
        nextGrade: 'Chief Library Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Chief Library Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 0,
        qualifications: 'Diploma in Library Studies with 11 years experience. Promotion for ACLO with 4 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 13.1 EDITORIAL OFFICER CADRE (NOUN PRESS)
  {
    cadre: 'Editorial Officer Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Assistant Editor',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Honours degree in any field with demonstrated oral/written English proficiency and computer application.',
        nextGrade: 'Editor II',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Editor II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: "Degree with 3 years experience or Master's. Promotion for Assistant Editor with 3 years.",
        nextGrade: 'Editor I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Editor I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Degree with 6 years or Master's with 3 years experience. Promotion for Editor II with 3 years.",
        nextGrade: 'Senior Editor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Editor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Degree with 9 years or Master's with 6 years or Ph.D with 3 years. Promotion for Editor I.",
        nextGrade: 'Principal Editor',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Editor',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Degree with 12 years or Master's with 9 years or Ph.D with 6 years. Promotion for Senior Editor with 4 years.",
        nextGrade: 'Chief Editor',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Editor',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Degree with 15 years or Master's with 12 years or Ph.D with 9 years. Promotion for Principal Editor.",
        nextGrade: 'Deputy Director (Editorial/Press)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Editorial/Press)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: "Degree with 15 years or Master's with 12 years or Ph.D with 9 years. Promotion for Chief Editor with 4 years.",
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 13.2 BINDERY OFFICER CADRE (NOUN PRESS)
  {
    cadre: 'Bindery Officer Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Bindery Officer',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'WASC plus ND in Printing Technology with 3 years experience.',
        nextGrade: 'Higher Bindery Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Bindery Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'ND with 6 years or HND with 3 years in Printing Technology. Promotion for Bindery Officer.',
        nextGrade: 'Senior Bindery Officer',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Bindery Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'ND with 9 years or HND with 3 years experience. Promotion for Higher Bindery Officer.',
        nextGrade: 'Principal Bindery Officer II',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Bindery Officer II',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Promotion avenue for Senior Bindery Officer with at least 3 years experience.',
        nextGrade: 'Principal Bindery Officer I',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Bindery Officer I',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'HND with 9 years experience. Promotion for PBO II with 3 years. Four years waiting period.',
        nextGrade: 'Assistant Chief Bindery Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Bindery Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'HND with 12 years experience. Promotion for PBO I with 3 years. Four years waiting period.',
        nextGrade: 'Chief Bindery Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Bindery Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'HND with 15 years experience. Promotion for Assistant Bindery Officer with 3 years. Four years waiting period.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 13.3 WEB/CONTENT DEVELOPER CADRE
  {
    cadre: 'Web/Content Developer Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Web/Content Developer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree in Computer Science/Informatics and Web-Content Designing.',
        nextGrade: 'Web/Content Developer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Web/Content Developer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree in Computer Science with 3 years programming experience including NYSC.',
        nextGrade: 'Senior Web/Content Developer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Web/Content Developer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree in Computer Science with 6 years experience. Advanced degree is advantage.',
        nextGrade: 'Principal Web/Content Developer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Web/Content Developer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree in Computer Science with 8 years experience. Four years waiting period.',
        nextGrade: 'Chief Web/Content Developer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Web/Content Developer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Master's degree in Computer Science with 11 years experience in large application systems.",
        nextGrade: 'Deputy Manager Web/Content Developer',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Manager Web/Content Developer',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Ph.D or higher in Computer Science with 15 years extensive web application experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 13.4 GRAPHICS/INSTRUCTIONAL DESIGNER CADRE
  {
    cadre: 'Graphics/Instructional Designer Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Graphics Design II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND in Computer Graphics / Information or related discipline.',
        nextGrade: 'Graphics Design I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Graphics Design I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND in Computer Graphics with 3 years program experience including NYSC.',
        nextGrade: 'Senior Graphics Design/Instructional Designer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Graphics Design/Instructional Designer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 6 years experience in Computer Graphics. Advanced degree is advantage.',
        nextGrade: 'Principal Graphics/Instructional Designer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Graphics/Instructional Designer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 9 years professional experience. Four years waiting period.',
        nextGrade: 'Chief Graphics/Instructional Designer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Graphics/Instructional Designer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Master's degree or HND in Computer Graphics with 11 years experience in audio visuals.",
        nextGrade: 'Deputy Manager (Graphics/Instructional Design)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Manager (Graphics/Instructional Design)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Degree/HND with 10 years experience. Masters in Educational Technology is added advantage.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 14.0 PROTOCOL SERVICES
  {
    cadre: 'Protocol Services Cadre',
    category: 'ADMINISTRATIVE',
    posts: [
      {
        post: 'Protocol Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Good honours degree in any field of study from a recognised University.',
        nextGrade: 'Protocol Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Protocol Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Degree with 3 years experience or Master's degree. Promotion for Protocol Officer II with 3 years.",
        nextGrade: 'Senior Protocol Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Protocol Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Degree with 6 years or Master's with 3 years or Ph.D. Promotion for Protocol Officer I with 3 years.",
        nextGrade: 'Principal Protocol Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Protocol Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Degree with 9 years or Master's with 6 years or Ph.D with 3 years. Promotion for Senior Protocol Officer with 4 years.",
        nextGrade: 'Chief Protocol Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Protocol Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Degree with 12 years or Master's with 9 years or Ph.D with 6 years. Promotion for Principal Protocol Officer with 4 years.",
        nextGrade: 'Deputy Director (Protocol)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Protocol)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: "Degree with 15 years or Master's with 12 years or Ph.D with 9 years. Promotion for Deputy Director with 4 years.",
        nextGrade: 'Director (Protocol)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Protocol)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Ph.D with managerial experience or promotion for Deputy Director with 4 years fixed tenure.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 15.0 MEDIA OFFICER CADRE
  {
    cadre: 'Media Officer Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Media Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Good honours degree in Mass Communication, English, Journalism, Marketing or Advertising.',
        nextGrade: 'Media Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Media Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with 3 years experience. Promotion for Media Officer II with 3 years.',
        nextGrade: 'Senior Media Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Media Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with 6 years experience. Promotion for Media Officer I with 4 years.',
        nextGrade: 'Principal Media Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Media Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Direct appointment with 9 years experience. Promotion for Senior Media Officer with 4 years.',
        nextGrade: 'Chief Media Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Media Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Degree with 12 years or Ph.D with 6 years experience. Promotion for Principal Media Officer with 4 years.',
        nextGrade: 'Deputy Director (Media)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Media)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Degree with 15 years or Ph.D with 9 years experience. Promotion for Principal Media Officer with 4 years.',
        nextGrade: 'Director (Media)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Media)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'By Appointment or as Deputy Director.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 15.1 EXECUTIVE OFFICER (MEDIA) CADRE
  {
    cadre: 'Executive Officer (Media) Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Executive Officer (Media)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: "OND in relevant field or 'A' Level with 4 years experience.",
        nextGrade: 'Higher Executive Officer (Media)',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Executive Officer (Media)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND in relevant field. Promotion for EO with 3 years.',
        nextGrade: 'Senior Executive Officer (Media)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Executive Officer (Media)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 2 years experience. Promotion for HEO with 3 years.',
        nextGrade: 'Principal Executive Officer II (Media)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Executive Officer II (Media)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 3-4 years experience. Terminal for OND candidates.',
        nextGrade: 'Principal Executive Officer I (Media)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Executive Officer I (Media)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 6 years experience. Promotion for PEO II with 4 years.',
        nextGrade: 'Assistant Chief Executive Officer (Media)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Executive Officer (Media)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Qualifications as PEO I with 8 years experience. Promotion for PEO I with 4 years.',
        nextGrade: 'Chief Executive Officer (Media)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Executive Officer (Media)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Qualifications as ACEO with 12 years post-qualification experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 15.2 TECHNICAL OFFICER (MEDIA) CADRE
  {
    cadre: 'Technical Officer (Media) Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Technical Officer (Media)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'ND/NCE with 3 years or Full Technological Certificate with 5 years experience.',
        nextGrade: 'Higher Technical Officer (Media)',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Technical Officer (Media)',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'HND in Engineering or relevant allied subject. Promotion for Technical Officer.',
        nextGrade: 'Senior Technical Officer (Media)',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Technical Officer (Media)',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: '7 years experience. Promotion for HTO with 3 years experience.',
        nextGrade: 'Principal Technical Officer II (Media)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Technical Officer II (Media)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: '9-11 years cognate experience. Promotion for Senior Technical Officer.',
        nextGrade: 'Principal Technical Officer I (Media)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Technical Officer I (Media)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Direct with 15 years experience. Promotion for PTO II.',
        nextGrade: 'Assistant Chief Technical Officer (Media)',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Technical Officer (Media)',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Direct with 19 years experience. Promotion for PTO I.',
        nextGrade: 'Chief Technical Officer (Media)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Technical Officer (Media)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Direct with 23 years experience. Promotion for Assistant Chief Technical Officer.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 15.3 TECHNICAL OFFICER (NON-LINEAR EDITOR) CADRE
  {
    cadre: 'Technical Officer (Non-Linear Editor) Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Non-Linear Editor II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree in Mass Communication, Journalism, English, Performing Arts, Cinematography, Film and TV Production.',
        nextGrade: 'Non-Linear Editor I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Non-Linear Editor I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with 3 years cognate experience. Promotion for Non-Linear Editor II with 3 years.',
        nextGrade: 'Senior Non-Linear Editor',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Non-Linear Editor',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment with 6 years experience. Promotion for Non-Linear Editor I with 4 years.',
        nextGrade: 'Principal Non-Linear Editor',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Non-Linear Editor',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Direct appointment with 9 years experience. Promotion for Senior Non-Linear Editor.',
        nextGrade: 'Chief Non-Linear Editor',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Non-Linear Editor',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Direct appointment with 12 years experience. Promotion for Principal Non-Linear Editor.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 16.0 SPORT COACH CADRE
  {
    cadre: 'Sport Coach Cadre',
    category: 'LEARNER_SUPPORT',
    posts: [
      {
        post: 'Assistant Coach',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'Certificate/Diploma in Physical Education or NCE with 2 years coaching experience.',
        nextGrade: 'Sports Coach II',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Sports Coach II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Degree in Physical Education or NCE/Diploma with 3 years coaching experience.',
        nextGrade: 'Sports Coach I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Sports Coach I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree with 2 years or NCE/Diploma with 5 years coaching experience in specific sport.',
        nextGrade: 'Senior Sports Coach',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Sports Coach',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree with 3 years or NCE/Diploma with 7 years coaching experience.',
        nextGrade: 'Principal Sports Coach II',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Sports Coach II',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree with 4 years or NCE/Diploma with 10 years experience. Promotion for Senior Sports Coach with 4 years.',
        nextGrade: 'Principal Sports Coach I',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Principal Sports Coach I',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Degree with 4 years or NCE/Diploma with 12 years experience. Promotion for Principal Coach II with 4 years.',
        nextGrade: 'Chief Coach',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Coach',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Degree in Physical Education with 6 years coaching or NCE/Diploma with 12 years. Promotion for Principal Coach I with 4 years.',
        nextGrade: 'Deputy Sports Director',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Sports Director',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Degree with 9 years or Diploma with 13 years sports administration. Promotion for Chief Coach with 4 years.',
        nextGrade: 'Sports Director',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Sports Director',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'Degree with 11 years or Diploma with 15 years administrative coaching experience.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 17.0 GRAPHICS ARTIST CADRE
  {
    cadre: 'Graphics Artist Cadre',
    category: 'MEDIA_PRESS',
    posts: [
      {
        post: 'Graphic Artist II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND in Computer Graphics.',
        nextGrade: 'Graphic Artist I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Graphic Artist I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND in Computer Graphics with 3 years experience including NYSC.',
        nextGrade: 'Senior Graphic Artist',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Graphic Artist',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 6 years experience. Promotion for Graphic Artist I.',
        nextGrade: 'Principal Graphic Artist',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Graphic Artist',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 9 years experience. Promotion for Senior Graphic Artist with 4 years.',
        nextGrade: 'Chief Graphic Artist',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Graphic Artist',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Master's degree or HND with 11 years experience in audio visual implementation.",
        nextGrade: 'Deputy Graphic Artist',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Graphic Artist',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Degree/HND with 10 years experience and administrative background. Masters in EdTech is advantage.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 18.0 INSTRUCTIONAL DESIGNER CADRE
  {
    cadre: 'Instructional Designer Cadre',
    category: 'ACADEMIC',
    posts: [
      {
        post: 'Instructional Designer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND in Computer Graphics / Educational Technology.',
        nextGrade: 'Instructional Designer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Instructional Designer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND with 3 years program experience including NYSC.',
        nextGrade: 'Senior Instructional Designer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Instructional Designer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 6 years experience in Instructional Design.',
        nextGrade: 'Principal Instructional Designer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Instructional Designer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 9 years professional experience. Four years waiting period.',
        nextGrade: 'Chief Instructional Designer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Instructional Designer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Master's degree or HND with 11 years experience in instructional media and learning management.",
        nextGrade: 'Deputy Manager (Instructional Design)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Manager (Instructional Design)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Degree/HND with 10 years experience and administrative background.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 19.0 LEARNING CONTENT TECHNOLOGIST CADRE
  {
    cadre: 'Learning Content Technologist Cadre',
    category: 'TECHNICAL',
    posts: [
      {
        post: 'Learning Content Technologist II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND in Computer Graphics / Content Systems.',
        nextGrade: 'Learning Content Technologist I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Learning Content Technologist I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 3 years program experience including NYSC.',
        nextGrade: 'Senior Learning Content Technologist',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Learning Content Technologist',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree/HND with 6 years experience in digital content technology.',
        nextGrade: 'Principal Learning Content Technologist',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Learning Content Technologist',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree/HND with 9 years professional experience. Four years waiting period.',
        nextGrade: 'Chief Learning Content Technologist',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Learning Content Technologist',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Master's degree or HND with 11 years experience in learning content systems.",
        nextGrade: 'Deputy Chief Learning Content Technologist',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Chief Learning Content Technologist',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'Degree/HND with 10 years experience and educational technology mastery.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 20.0 QUALITY ASSURANCE OFFICER CADRE
  {
    cadre: 'Quality Assurance Officer Cadre',
    category: 'ACADEMIC',
    posts: [
      {
        post: 'Quality Assurance Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Good degree in Educational Management/Planning/Business Admin/Mathematics/Accounting/Statistics/Economics/Computer Science.',
        nextGrade: 'Quality Assurance Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Quality Assurance Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: "Master's Degree with 3 years cognate experience. Promotion for QA Officer II with 3 years.",
        nextGrade: 'Senior Quality Assurance Officer',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Senior Quality Assurance Officer',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Master's Degree with 3 years cognate experience. Promotion for QA Officer I with 3 years.",
        nextGrade: 'Principal Quality Assurance Officer',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Quality Assurance Officer',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Master's Degree with at least 6 years working experience. Promotion for SQAO with 4 years.",
        nextGrade: 'Chief Quality Assurance Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Quality Assurance Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: 'Ph.D Degree with at least 6-8 years working experience. Promotion for PQAO with 4 years.',
        nextGrade: 'Deputy Director (Quality Assurance)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Quality Assurance)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 4,
        qualifications: 'Ph.D Degree with at least 10 years working experience. Promotion for CQAO with 4 years.',
        nextGrade: 'Director (Quality Assurance)',
        nextSalaryScale: 'CONTISS 15'
      },
      {
        post: 'Director (Quality Assurance)',
        salaryScale: 'CONTISS 15',
        scaleType: 'CONTISS',
        gradeLevel: 15,
        minYearsWaiting: 0,
        qualifications: 'By appointment (CONTISS 15 / CONUASS 07).',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 21.0 SECURITY OFFICER CADRE (ADMINISTRATIVE)
  {
    cadre: 'Security Officer Cadre (Administrative)',
    category: 'SECURITY',
    posts: [
      {
        post: 'Security Officer II',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'Direct appointment of candidate possessing a University degree in relevant field.',
        nextGrade: 'Security Officer I',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Security Officer I',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'University degree plus 3 years post qualification experience. Promotion for Security Officer II with 3 years.',
        nextGrade: 'Principal Security Officer II',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Security Officer II',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: "Degree with 6 years or Master's with 3 years or Ph.D. Promotion for Security Officer I with 3 years.",
        nextGrade: 'Principal Security Officer I',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Security Officer I',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: "Degree with 9 years or Master's with 6 years or Ph.D with 3 years. Promotion for PSO II with 4 years.",
        nextGrade: 'Chief Security Officer',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Security Officer',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 4,
        qualifications: "Degree with 12 years or Master's with 9 years or Ph.D with 6 years. Promotion for PSO I with 4 years.",
        nextGrade: 'Deputy Director (Security)',
        nextSalaryScale: 'CONTISS 14'
      },
      {
        post: 'Deputy Director (Security)',
        salaryScale: 'CONTISS 14',
        scaleType: 'CONTISS',
        gradeLevel: 14,
        minYearsWaiting: 0,
        qualifications: 'University degree with 15+ years security administration experience in university setting.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  },

  // 21.1 SECURITY OFFICER CADRE (EXECUTIVE)
  {
    cadre: 'Security Officer Cadre (Executive)',
    category: 'SECURITY',
    posts: [
      {
        post: 'Chief Technical Assistant (Security)',
        salaryScale: 'CONTISS 06',
        scaleType: 'CONTISS',
        gradeLevel: 6,
        minYearsWaiting: 3,
        qualifications: 'OND or equivalent with 4 years post-qualification experience or SSCE with 6 years experience.',
        nextGrade: 'Higher Security Officer',
        nextSalaryScale: 'CONTISS 07'
      },
      {
        post: 'Higher Security Officer',
        salaryScale: 'CONTISS 07',
        scaleType: 'CONTISS',
        gradeLevel: 7,
        minYearsWaiting: 3,
        qualifications: 'University degree or HND. Promotion for Chief Technical Assistant (Security) with 3 years.',
        nextGrade: 'Senior Security Officer',
        nextSalaryScale: 'CONTISS 08'
      },
      {
        post: 'Senior Security Officer',
        salaryScale: 'CONTISS 08',
        scaleType: 'CONTISS',
        gradeLevel: 8,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND plus 3 years experience. Promotion for Higher Security Officer with 3 years.',
        nextGrade: 'Principal Security Officer II (Executive)',
        nextSalaryScale: 'CONTISS 09'
      },
      {
        post: 'Principal Security Officer II (Executive)',
        salaryScale: 'CONTISS 09',
        scaleType: 'CONTISS',
        gradeLevel: 9,
        minYearsWaiting: 3,
        qualifications: 'Degree or HND plus 6 years experience. Promotion for Senior Security Officer with 3 years.',
        nextGrade: 'Principal Security Officer I (Executive)',
        nextSalaryScale: 'CONTISS 11'
      },
      {
        post: 'Principal Security Officer I (Executive)',
        salaryScale: 'CONTISS 11',
        scaleType: 'CONTISS',
        gradeLevel: 11,
        minYearsWaiting: 4,
        qualifications: 'Degree or HND plus 9 years experience. Promotion for PSO II with 4 years.',
        nextGrade: 'Assistant Chief Security Officer',
        nextSalaryScale: 'CONTISS 12'
      },
      {
        post: 'Assistant Chief Security Officer',
        salaryScale: 'CONTISS 12',
        scaleType: 'CONTISS',
        gradeLevel: 12,
        minYearsWaiting: 4,
        qualifications: 'Degree or HND plus 10 years experience. Promotion for PSO I with 4 years.',
        nextGrade: 'Chief Security Officer (Executive)',
        nextSalaryScale: 'CONTISS 13'
      },
      {
        post: 'Chief Security Officer (Executive)',
        salaryScale: 'CONTISS 13',
        scaleType: 'CONTISS',
        gradeLevel: 13,
        minYearsWaiting: 0,
        qualifications: 'Degree or HND plus 12 years experience. Promotion for Assistant Chief Security Officer with 3 years.',
        nextGrade: null,
        nextSalaryScale: null
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a distinct sorted list of all 53 Cadres with zero duplicates.
 */
export const CADRE_LIST: string[] = Array.from(
  new Set(NOUN_SCHEME_OF_SERVICE.map((c) => c.cadre))
).sort((a, b) => a.localeCompare(b));

/**
 * Lookup map from Cadre Name -> List of Post definitions
 */
export const CADRE_POST_MAP: Record<string, SchemePostDefinition[]> = NOUN_SCHEME_OF_SERVICE.reduce(
  (acc, c) => {
    acc[c.cadre] = c.posts;
    return acc;
  },
  {} as Record<string, SchemePostDefinition[]>
);

/**
 * Retrieves all valid posts for a selected Cadre.
 */
export function getPostsByCadre(cadre: string): SchemePostDefinition[] {
  if (!cadre) return [];
  // Direct match
  if (CADRE_POST_MAP[cadre]) return CADRE_POST_MAP[cadre];
  
  // Fuzzy match case-insensitively
  const normalized = cadre.trim().toLowerCase();
  const matchedKey = Object.keys(CADRE_POST_MAP).find(
    (k) => k.toLowerCase() === normalized || k.toLowerCase().includes(normalized) || normalized.includes(k.toLowerCase())
  );
  return matchedKey ? CADRE_POST_MAP[matchedKey] : [];
}

/**
 * Resolves post details (Salary scale, grade level, min waiting years, next grade)
 */
export function getPostDefinition(cadre: string, postName: string): SchemePostDefinition | null {
  const posts = getPostsByCadre(cadre);
  if (!posts.length) {
    // Global search across all cadres
    for (const c of NOUN_SCHEME_OF_SERVICE) {
      const found = c.posts.find(
        (p) => p.post.toLowerCase() === postName.toLowerCase() || p.post.toLowerCase().includes(postName.toLowerCase())
      );
      if (found) return found;
    }
    return null;
  }
  const found = posts.find(
    (p) => p.post.toLowerCase() === postName.toLowerCase() || p.post.toLowerCase().includes(postName.toLowerCase())
  );
  return found || null;
}

/**
 * Gets Next Grade progression and waiting period for promotion engine
 */
export function getNextGradeProgression(cadre: string, currentPost: string): {
  nextGrade: string | null;
  nextSalaryScale: string | null;
  minYearsWaiting: number;
  qualifications: string | null;
} {
  const def = getPostDefinition(cadre, currentPost);
  if (!def) {
    return { nextGrade: null, nextSalaryScale: null, minYearsWaiting: 0, qualifications: null };
  }
  return {
    nextGrade: def.nextGrade,
    nextSalaryScale: def.nextSalaryScale || null,
    minYearsWaiting: def.minYearsWaiting,
    qualifications: def.qualifications,
  };
}
