import { PrismaClient, ProgrammeLevel, AcademicSemester, Cadre, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface SeedFaculty {
  id: string;
  facultyCode: string;
  name: string;
  deanEmail?: string;
  departments: {
    id: string;
    name: string;
    hodEmail?: string;
    programmes: {
      id: string;
      programmeCode: string;
      name: string;
      degreeTitle: string;
      programmeDescription: string;
      level: ProgrammeLevel;
    }[];
  }[];
}

export const ACADEMIC_TAXONOMY: SeedFaculty[] = [
  {
    id: 'agr',
    facultyCode: 'F01',
    name: 'Faculty of Agricultural Sciences',
    deanEmail: 'dean.agric@noun.edu.ng',
    departments: [
      {
        id: 'AEE',
        name: 'Agricultural Economics and Extension',
        hodEmail: 'hod.aee@noun.edu.ng',
        programmes: [
          {
            id: 'AGR201',
            programmeCode: 'P010101',
            name: 'B.Agric Agricultural Economics and Agro-Business',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Comprehensive training in agricultural economics, farm management, marketing, and agribusiness entrepreneurship in open and distance learning context.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR202',
            programmeCode: 'P010102',
            name: 'B.Agric Agricultural Extension and Rural Development',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Training in participatory rural appraisal, extension methodologies, and agricultural innovation adoption.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR701',
            programmeCode: 'P010103',
            name: 'PGD Agricultural Economics and Extension',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate diploma providing bridge competencies in agricultural economics and rural advisory services.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'AGR801',
            programmeCode: 'P010104',
            name: 'M.Sc. Agricultural Economics',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced research and econometric modeling in agricultural production, resource economics, and policy.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'AGR901',
            programmeCode: 'P010105',
            name: 'Ph.D. Agricultural Economics',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research and dissertation in agricultural economics and extension policy.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'ASF',
        name: 'Animal Science and Fisheries',
        hodEmail: 'hod.asf@noun.edu.ng',
        programmes: [
          {
            id: 'AGR203',
            programmeCode: 'P010201',
            name: 'B.Agric Animal Science',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Scientific study of livestock nutrition, genetics, breeding, and husbandry.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR204',
            programmeCode: 'P010202',
            name: 'B.Agric Aquaculture and Fisheries Management',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Aquatic ecosystem management, fish breeding, fish feed technology, and aquaculture operations.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR802',
            programmeCode: 'P010203',
            name: 'M.Sc. Animal Science',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master level specialization in ruminant/non-ruminant nutrition and physiology.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'AGR902',
            programmeCode: 'P010204',
            name: 'Ph.D. Animal Science',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral investigation in animal breeding, genetics, and biotechnology.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'CRP',
        name: 'Crop and Soil Sciences',
        hodEmail: 'hod.crp@noun.edu.ng',
        programmes: [
          {
            id: 'AGR205',
            programmeCode: 'P010301',
            name: 'B.Agric Crop Production',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Principles of agronomy, crop physiology, crop protection, and sustainable farming systems.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR206',
            programmeCode: 'P010302',
            name: 'B.Agric Soil and Land Resources Management',
            degreeTitle: 'B.Agric',
            programmeDescription: 'Soil chemistry, pedology, fertility management, and soil conservation.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'AGR803',
            programmeCode: 'P010303',
            name: 'M.Sc. Crop Science',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Postgraduate specialization in plant breeding, genetics, and weed management.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'AGR903',
            programmeCode: 'P010304',
            name: 'Ph.D. Crop Science',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Original research in crop improvement, biotic stress resilience, and food security.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
    ],
  },
  {
    id: 'art',
    facultyCode: 'F02',
    name: 'Faculty of Arts',
    deanEmail: 'dean.arts@noun.edu.ng',
    departments: [
      {
        id: 'LNG',
        name: 'Languages and Linguistics',
        hodEmail: 'hod.languages@noun.edu.ng',
        programmes: [
          {
            id: 'ART201',
            programmeCode: 'P020101',
            name: 'B.A. English',
            degreeTitle: 'B.A.',
            programmeDescription: 'Comprehensive curriculum in English language studies, literary criticism, stylistics, and creative writing.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'ART202',
            programmeCode: 'P020102',
            name: 'B.A. French',
            degreeTitle: 'B.A.',
            programmeDescription: 'French linguistics, francophone literature, and professional translation.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'ART203',
            programmeCode: 'P020103',
            name: 'B.A. Arabic Language and Literature',
            degreeTitle: 'B.A.',
            programmeDescription: 'Arabic syntax, morphology, classical and modern Arabic literature.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'ART801',
            programmeCode: 'P020104',
            name: 'M.A. English',
            degreeTitle: 'M.A.',
            programmeDescription: 'Advanced seminars in English syntactic theory, sociolinguistics, and African literature.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'ART901',
            programmeCode: 'P020105',
            name: 'Ph.D. English',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctor of Philosophy thesis in English literature or applied English linguistics.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'RST',
        name: 'Religious Studies',
        hodEmail: 'hod.religions@noun.edu.ng',
        programmes: [
          {
            id: 'ART207',
            programmeCode: 'P020201',
            name: 'B.A. Christian Religious Studies',
            degreeTitle: 'B.A.',
            programmeDescription: 'Biblical studies, Christian ethics, church history, and theology.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'ART208',
            programmeCode: 'P020202',
            name: 'B.A. Islamic Studies',
            degreeTitle: 'B.A.',
            programmeDescription: 'Islamic jurisprudence (Fiqh), Hadith sciences, Quranic exegesis, and Islamic civilization.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'ART802',
            programmeCode: 'P020203',
            name: 'M.A. Islamic Studies',
            degreeTitle: 'M.A.',
            programmeDescription: 'Advanced studies in Islamic thought, ethics, and contemporary jurisprudential issues.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'ART803',
            programmeCode: 'P020204',
            name: 'M.A. Christian Religious Studies',
            degreeTitle: 'M.A.',
            programmeDescription: 'Advanced hermeneutics, systematic theology, and comparative religious traditions.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'ART902',
            programmeCode: 'P020205',
            name: 'Ph.D. Religious Studies',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research in religious dialogue, philosophy of religion, and sacred texts.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
    ],
  },
  {
    id: 'cmp',
    facultyCode: 'F03',
    name: 'Faculty of Computing',
    deanEmail: 'dean.computing@noun.edu.ng',
    departments: [
      {
        id: 'CSI',
        name: 'Computer Science',
        hodEmail: 'hod.cs@noun.edu.ng',
        programmes: [
          {
            id: 'CMP201',
            programmeCode: 'P030101',
            name: 'B.Sc. Computer Science',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Theoretical foundations of computation, algorithms, compiler construction, software systems, and artificial intelligence.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'CMP701',
            programmeCode: 'P030102',
            name: 'PGD Information Technology',
            degreeTitle: 'PGD',
            programmeDescription: 'Conversion postgraduate diploma for non-computing graduates into enterprise IT and software development.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'CMP801',
            programmeCode: 'P030103',
            name: 'M.Sc. Information Technology',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced enterprise architectures, distributed database engineering, cloud computing, and IT project governance.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'CMP802',
            programmeCode: 'P030104',
            name: 'M.Sc. Computer Science',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced algorithms, machine learning, high-performance distributed computing, and computer vision.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'CMP901',
            programmeCode: 'P030105',
            name: 'Ph.D. Computer Science',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Original doctoral contributions to computational theory, neural networks, natural language processing, and cybersecurity.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'INF',
        name: 'Information Systems and Cybersecurity',
        hodEmail: 'hod.cyber@noun.edu.ng',
        programmes: [
          {
            id: 'CMP202',
            programmeCode: 'P030201',
            name: 'B.Sc. Information Technology',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Network administration, web architectures, enterprise database management, and business intelligence systems.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'CMP203',
            programmeCode: 'P030202',
            name: 'B.Sc. Cybersecurity',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Ethical hacking, digital forensics, cryptographic protocols, cloud security, and defensive cyber operations.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'CMP204',
            programmeCode: 'P030203',
            name: 'B.Sc. Data Science',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Statistical computing, big data engineering, predictive modeling, data visualization, and deep learning analytics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'CMP803',
            programmeCode: 'P030204',
            name: 'M.Sc. Cybersecurity',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced threat intelligence, sovereign critical infrastructure protection, malware analysis, and ISO 27001 auditing.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
      {
        id: 'SFE',
        name: 'Software Engineering',
        hodEmail: 'hod.software@noun.edu.ng',
        programmes: [
          {
            id: 'CMP205',
            programmeCode: 'P030301',
            name: 'B.Sc. Software Engineering',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Full-lifecycle software design, agile engineering practices, microservices, verification & testing, and CI/CD pipelines.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
        ],
      },
    ],
  },
  {
    id: 'edu',
    facultyCode: 'F04',
    name: 'Faculty of Education',
    deanEmail: 'dean.education@noun.edu.ng',
    departments: [
      {
        id: 'EAS',
        name: 'Educational Foundations and Administration',
        hodEmail: 'hod.foundations@noun.edu.ng',
        programmes: [
          {
            id: 'EDU201',
            programmeCode: 'P040101',
            name: 'B.Ed. Educational Management',
            degreeTitle: 'B.Ed.',
            programmeDescription: 'Institutional administration, educational policy analysis, human capital planning, and school supervision.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU202',
            programmeCode: 'P040102',
            name: 'B.Ed. Guidance and Counselling',
            degreeTitle: 'B.Ed.',
            programmeDescription: 'Psychological assessment, career guidance, student therapy, and behavioral intervention in learning institutions.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU701',
            programmeCode: 'P040103',
            name: 'PGDE Postgraduate Diploma in Education',
            degreeTitle: 'PGDE',
            programmeDescription: 'Professional teaching credential qualifying university graduates for pedagogical practice and TRCN registration.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'EDU801',
            programmeCode: 'P040104',
            name: 'M.Ed. Educational Administration and Planning',
            degreeTitle: 'M.Ed.',
            programmeDescription: 'Master level specialization in educational economics, institutional governance, and quality metrics.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'EDU901',
            programmeCode: 'P040105',
            name: 'Ph.D. Educational Administration and Planning',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research into tertiary education policy, distance learning governance, and national development.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'STE',
        name: 'Science and Technology Education',
        hodEmail: 'hod.sciedu@noun.edu.ng',
        programmes: [
          {
            id: 'EDU205',
            programmeCode: 'P040201',
            name: 'B.Sc.(Ed.) Computer Science',
            degreeTitle: 'B.Sc.(Ed.)',
            programmeDescription: 'Pedagogical training integrated with core computer science and instructional media technology.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU206',
            programmeCode: 'P040202',
            name: 'B.Sc.(Ed.) Biology',
            degreeTitle: 'B.Sc.(Ed.)',
            programmeDescription: 'Secondary and tertiary biology pedagogy, laboratory methods, and educational psychology.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU207',
            programmeCode: 'P040203',
            name: 'B.Sc.(Ed.) Chemistry',
            degreeTitle: 'B.Sc.(Ed.)',
            programmeDescription: 'Chemical science instruction, curriculum design, laboratory micro-teaching, and safety.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU208',
            programmeCode: 'P040204',
            name: 'B.Sc.(Ed.) Physics',
            degreeTitle: 'B.Sc.(Ed.)',
            programmeDescription: 'Physics pedagogy, experimental instrumentation, and conceptual learning frameworks.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU209',
            programmeCode: 'P040205',
            name: 'B.Sc.(Ed.) Mathematics',
            degreeTitle: 'B.Sc.(Ed.)',
            programmeDescription: 'Mathematical pedagogy, logic and problem solving heuristics in secondary education.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU803',
            programmeCode: 'P040206',
            name: 'M.Ed. Science Education',
            degreeTitle: 'M.Ed.',
            programmeDescription: 'Advanced research in STEM educational methodologies and multimedia instructional systems.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
      {
        id: 'LST',
        name: 'Library and Information Science',
        hodEmail: 'hod.library@noun.edu.ng',
        programmes: [
          {
            id: 'EDU215',
            programmeCode: 'P040301',
            name: 'B.LIS Library and Information Science',
            degreeTitle: 'B.LIS',
            programmeDescription: 'Digital cataloguing, metadata standards, archival preservation, and electronic information services.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'EDU804',
            programmeCode: 'P040302',
            name: 'M.LIS Library and Information Science',
            degreeTitle: 'M.LIS',
            programmeDescription: 'Master of Library and Information Science with focus on digital repositories and academic metrics.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
    ],
  },
  {
    id: 'hsc',
    facultyCode: 'F05',
    name: 'Faculty of Health Sciences',
    deanEmail: 'dean.health@noun.edu.ng',
    departments: [
      {
        id: 'NRS',
        name: 'Nursing Science',
        hodEmail: 'hod.nursing@noun.edu.ng',
        programmes: [
          {
            id: 'HSC201',
            programmeCode: 'P050101',
            name: 'B.N.Sc. Nursing Science',
            degreeTitle: 'B.N.Sc.',
            programmeDescription: 'Evidence-based nursing practice, clinical therapeutics, community health nursing, and patient care management.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'HSC701',
            programmeCode: 'P050102',
            name: 'PGD Nursing Science',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate clinical nursing diploma for certified nurses transitioning into advanced practice.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'HSC801',
            programmeCode: 'P050103',
            name: 'M.Sc. Nursing Science',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master level specialization in nursing leadership, advanced medical-surgical nursing, and education.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'HSC901',
            programmeCode: 'P050104',
            name: 'Ph.D. Nursing Science',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research in healthcare systems, chronic disease epidemiology, and clinical care innovations.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'PBH',
        name: 'Public Health',
        hodEmail: 'hod.publichealth@noun.edu.ng',
        programmes: [
          {
            id: 'HSC202',
            programmeCode: 'P050201',
            name: 'B.Sc. Public Health',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Epidemiology, biostatistics, environmental sanitation, communicable disease surveillance, and health economics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'HSC702',
            programmeCode: 'P050202',
            name: 'PGD Public Health',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate diploma in public health policy, field epidemiology, and global health intervention.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'HSC802',
            programmeCode: 'P050203',
            name: 'M.Sc. Public Health',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master of Science in Public Health focusing on outbreak response, maternal/child health, and health system strengthening.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'HSC902',
            programmeCode: 'P050204',
            name: 'Ph.D. Public Health',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research in global epidemiology, universal health coverage mechanisms, and health informatics.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'EHS',
        name: 'Environmental Health Science',
        hodEmail: 'hod.ehs@noun.edu.ng',
        programmes: [
          {
            id: 'HSC203',
            programmeCode: 'P050301',
            name: 'B.Sc. Environmental Health Science',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Water sanitation, occupational health and safety, hazardous waste management, and environmental toxicology.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
        ],
      },
    ],
  },
  {
    id: 'law',
    facultyCode: 'F06',
    name: 'Faculty of Law',
    deanEmail: 'dean.law@noun.edu.ng',
    departments: [
      {
        id: 'CML',
        name: 'Commercial and Property Law',
        hodEmail: 'hod.commerciallaw@noun.edu.ng',
        programmes: [
          {
            id: 'LAW201',
            programmeCode: 'P060101',
            name: 'LL.B Law',
            degreeTitle: 'LL.B',
            programmeDescription: 'Comprehensive legal education covering constitutional law, law of contract, criminal law, land law, torts, equity & trusts, jurisprudence, and international law.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'LAW701',
            programmeCode: 'P060102',
            name: 'PGD Legislative Drafting',
            degreeTitle: 'PGD',
            programmeDescription: 'Specialized postgraduate diploma in drafting statutory instruments, bills, and regulatory compliance frameworks.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'LAW801',
            programmeCode: 'P060103',
            name: 'LL.M Master of Laws',
            degreeTitle: 'LL.M',
            programmeDescription: 'Master of Laws in corporate governance, intellectual property, maritime law, and international human rights law.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'LAW901',
            programmeCode: 'P060104',
            name: 'Ph.D. Law',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Original doctoral dissertation advancing legal scholarship in constitutionalism, commercial dispute resolution, or cyber jurisprudence.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'PPL',
        name: 'Public and Private Law',
        hodEmail: 'hod.publiclaw@noun.edu.ng',
        programmes: [
          {
            id: 'LAW202',
            programmeCode: 'P060201',
            name: 'LL.B Commercial Law Specialization',
            degreeTitle: 'LL.B',
            programmeDescription: 'Focused law degree module emphasizing corporate finance, bankruptcy, arbitration, and taxation law.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
        ],
      },
    ],
  },
  {
    id: 'msc',
    facultyCode: 'F07',
    name: 'Faculty of Management Sciences',
    deanEmail: 'dean.mgmt@noun.edu.ng',
    departments: [
      {
        id: 'ACC',
        name: 'Financial Studies / Accounting',
        hodEmail: 'hod.accounting@noun.edu.ng',
        programmes: [
          {
            id: 'MSC201',
            programmeCode: 'P070101',
            name: 'B.Sc. Accounting',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Financial reporting, auditing & assurance, taxation, cost accounting, forensic accounting, and public sector accounting (IPSAS).',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC202',
            programmeCode: 'P070102',
            name: 'B.Sc. Banking and Finance',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Monetary economics, capital market operations, financial risk management, and commercial banking practice.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC701',
            programmeCode: 'P070103',
            name: 'PGD Financial Management',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate diploma in corporate financial strategy, investment analysis, and working capital management.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'MSC801',
            programmeCode: 'P070104',
            name: 'M.Sc. Accounting',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced empirical research in auditing quality, corporate financial disclosure, and international accounting standards.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'MSC901',
            programmeCode: 'P070105',
            name: 'Ph.D. Accounting',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctor of Philosophy thesis examining behavioral accounting, auditing independence, or taxation efficiency.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'BAD',
        name: 'Business Administration',
        hodEmail: 'hod.busadmin@noun.edu.ng',
        programmes: [
          {
            id: 'MSC203',
            programmeCode: 'P070201',
            name: 'B.Sc. Business Administration',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Principles of management, strategic planning, human resource management, and operations research.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC204',
            programmeCode: 'P070202',
            name: 'B.Sc. Marketing',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Brand management, digital marketing analytics, consumer behavior, and sales channel optimization.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC803',
            programmeCode: 'P070203',
            name: 'MBA Master of Business Administration',
            degreeTitle: 'MBA',
            programmeDescription: 'Executive and general management MBA with concentrations in finance, human resource management, and corporate strategy.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'MSC804',
            programmeCode: 'P070204',
            name: 'M.Sc. Business Administration',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Scholarly research into organizational behavior, supply chain resilience, and corporate governance in Africa.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'MSC902',
            programmeCode: 'P070205',
            name: 'Ph.D. Business Administration',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral thesis in strategic agility, multinational enterprise management, or corporate renewal.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'PAD',
        name: 'Public Administration',
        hodEmail: 'hod.pubadmin@noun.edu.ng',
        programmes: [
          {
            id: 'MSC205',
            programmeCode: 'P070301',
            name: 'B.Sc. Public Administration',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Civil service administrative systems, public policy formulation, administrative law, and local government administration.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC805',
            programmeCode: 'P070302',
            name: 'MPA Master of Public Administration',
            degreeTitle: 'MPA',
            programmeDescription: 'Professional master degree for senior civil servants and public sector leadership.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'MSC903',
            programmeCode: 'P070303',
            name: 'Ph.D. Public Administration',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research into civil service reform, intergovernmental relations, and public accountability frameworks.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'ENT',
        name: 'Entrepreneurship Studies',
        hodEmail: 'hod.entrepreneurship@noun.edu.ng',
        programmes: [
          {
            id: 'MSC206',
            programmeCode: 'P070401',
            name: 'B.Sc. Entrepreneurship and Business Management',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Incubation of startup enterprises, venture capital financing, innovation management, and family business governance.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'MSC807',
            programmeCode: 'P070402',
            name: 'M.Sc. Entrepreneurship',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Postgraduate research in SME growth dynamics, social entrepreneurship, and innovation ecosystems.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
    ],
  },
  {
    id: 'sci',
    facultyCode: 'F08',
    name: 'Faculty of Sciences',
    deanEmail: 'dean.sciences@noun.edu.ng',
    departments: [
      {
        id: 'BIO',
        name: 'Biological Sciences',
        hodEmail: 'hod.biology@noun.edu.ng',
        programmes: [
          {
            id: 'SCI201',
            programmeCode: 'P080101',
            name: 'B.Sc. Biology',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Cellular biology, genetics, ecology, botany, invertebrate zoology, and developmental biology.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI202',
            programmeCode: 'P080102',
            name: 'B.Sc. Microbiology',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Bacteriology, virology, immunology, industrial fermentation, and microbial genetics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI203',
            programmeCode: 'P080103',
            name: 'B.Sc. Biotechnology',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Recombinant DNA technology, tissue culture, bioprocess engineering, and bioinformatics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI801',
            programmeCode: 'P080104',
            name: 'M.Sc. Biology',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master of Science in environmental biology, entomology, or applied parasitology.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
      {
        id: 'CHM',
        name: 'Chemical Sciences',
        hodEmail: 'hod.chemistry@noun.edu.ng',
        programmes: [
          {
            id: 'SCI204',
            programmeCode: 'P080201',
            name: 'B.Sc. Chemistry',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Organic synthesis, inorganic chemistry, physical chemistry, analytical spectroscopy, and industrial chemistry.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI205',
            programmeCode: 'P080202',
            name: 'B.Sc. Biochemistry',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Enzymology, molecular biology, metabolic pathways, nutritional biochemistry, and clinical diagnostics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI802',
            programmeCode: 'P080203',
            name: 'M.Sc. Chemistry',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced organic synthesis, petroleum chemistry, and polymer science.',
            level: ProgrammeLevel.MASTERS,
          },
        ],
      },
      {
        id: 'PHY',
        name: 'Physics',
        hodEmail: 'hod.physics@noun.edu.ng',
        programmes: [
          {
            id: 'SCI206',
            programmeCode: 'P080301',
            name: 'B.Sc. Physics',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Classical mechanics, electromagnetism, quantum mechanics, solid state physics, and thermodynamics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI207',
            programmeCode: 'P080302',
            name: 'B.Sc. Physics with Electronics',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Digital signal processing, microelectronics, semiconductor physics, and communication systems.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
        ],
      },
      {
        id: 'MTH',
        name: 'Mathematics',
        hodEmail: 'hod.maths@noun.edu.ng',
        programmes: [
          {
            id: 'SCI208',
            programmeCode: 'P080401',
            name: 'B.Sc. Mathematics',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Real and complex analysis, abstract algebra, differential equations, topology, and numerical analysis.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI209',
            programmeCode: 'P080402',
            name: 'B.Sc. Mathematics and Computer Science',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Dual-discipline curriculum combining discrete mathematics, graph theory, and algorithmic complexity.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SCI803',
            programmeCode: 'P080403',
            name: 'M.Sc. Mathematics',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced functional analysis, fluid dynamics modeling, and stochastic processes.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SCI901',
            programmeCode: 'P080404',
            name: 'Ph.D. Mathematics',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctor of Philosophy thesis in pure mathematics, applied mathematical physics, or optimization theory.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'ENV',
        name: 'Environmental Sciences',
        hodEmail: 'hod.envsci@noun.edu.ng',
        programmes: [
          {
            id: 'SCI211',
            programmeCode: 'P080501',
            name: 'B.Sc. Environmental Science and Resource Management',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'EIA environmental impact assessments, GIS remote sensing, biodiversity conservation, and climate change adaptation.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
        ],
      },
    ],
  },
  {
    id: 'ssc',
    facultyCode: 'F09',
    name: 'Faculty of Social Sciences',
    deanEmail: 'dean.socsci@noun.edu.ng',
    departments: [
      {
        id: 'ECO',
        name: 'Economics',
        hodEmail: 'hod.economics@noun.edu.ng',
        programmes: [
          {
            id: 'SSC201',
            programmeCode: 'P090101',
            name: 'B.Sc. Economics',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Microeconomic theory, macroeconomics, econometrics, public finance, monetary economics, and development economics.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC701',
            programmeCode: 'P090102',
            name: 'PGD Economics',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate diploma in quantitative economic analysis and macroeconomic policy.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'SSC801',
            programmeCode: 'P090103',
            name: 'M.Sc. Economics',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced econometric modeling, international trade policy, and macroeconomic forecasting.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SSC901',
            programmeCode: 'P090104',
            name: 'Ph.D. Economics',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research into monetary transmission mechanisms, fiscal policy sustainability, and poverty reduction.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'MAC',
        name: 'Mass Communication',
        hodEmail: 'hod.masscomm@noun.edu.ng',
        programmes: [
          {
            id: 'SSC202',
            programmeCode: 'P090201',
            name: 'B.Sc. Mass Communication',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Print journalism, broadcast media production, public relations, advertising, media law and ethics, and multimedia communication.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC802',
            programmeCode: 'P090202',
            name: 'M.Sc. Mass Communication',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Scholarly investigation of communication theories, digital media consumption patterns, and international media diplomacy.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SSC902',
            programmeCode: 'P090203',
            name: 'Ph.D. Mass Communication',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctor of Philosophy thesis in health communication campaigns, media framing, or political communication.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'POL',
        name: 'Political Science',
        hodEmail: 'hod.polsci@noun.edu.ng',
        programmes: [
          {
            id: 'SSC205',
            programmeCode: 'P090301',
            name: 'B.Sc. Political Science',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Comparative politics, political theory, Nigerian government and politics, international relations, and public administration.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC206',
            programmeCode: 'P090302',
            name: 'B.Sc. International Relations',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Foreign policy analysis, multilateral diplomacy, international organizations, and global security.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC803',
            programmeCode: 'P090303',
            name: 'M.Sc. Political Science',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Advanced seminars in political economy, electoral systems, and democratization in developing states.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SSC903',
            programmeCode: 'P090304',
            name: 'Ph.D. Political Science',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research into federalism, democratic institutions, and conflict dynamics.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'PCR',
        name: 'Peace Studies and Conflict Resolution',
        hodEmail: 'hod.peacestudies@noun.edu.ng',
        programmes: [
          {
            id: 'SSC207',
            programmeCode: 'P090401',
            name: 'B.Sc. Peace Studies and Conflict Resolution',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Conflict analysis, mediation and alternative dispute resolution (ADR), peacekeeping operations, and humanitarian interventions.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC703',
            programmeCode: 'P090402',
            name: 'PGD Peace Studies and Conflict Resolution',
            degreeTitle: 'PGD',
            programmeDescription: 'Postgraduate diploma in peacebuilding, arms control, and communal conflict mediation.',
            level: ProgrammeLevel.POSTGRADUATE_DIPLOMA,
          },
          {
            id: 'SSC804',
            programmeCode: 'P090403',
            name: 'M.Sc. Peace Studies and Conflict Resolution',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master of Science in security sector reform, transitional justice, and countering violent extremism.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SSC904',
            programmeCode: 'P090404',
            name: 'Ph.D. Peace and Conflict Studies',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral thesis in asymmetric warfare, climate security conflicts, or post-conflict reconstruction.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
      {
        id: 'SOC',
        name: 'Sociology, Criminology and Security Studies',
        hodEmail: 'hod.sociology@noun.edu.ng',
        programmes: [
          {
            id: 'SSC208',
            programmeCode: 'P090501',
            name: 'B.Sc. Sociology',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Sociological theories, social stratification, demography, urban sociology, and research methodologies.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC209',
            programmeCode: 'P090502',
            name: 'B.Sc. Criminology and Security Studies',
            degreeTitle: 'B.Sc.',
            programmeDescription: 'Theories of crime, penal systems, law enforcement operations, victimology, and intelligence analysis.',
            level: ProgrammeLevel.UNDERGRADUATE,
          },
          {
            id: 'SSC805',
            programmeCode: 'P090503',
            name: 'M.Sc. Criminology and Security Studies',
            degreeTitle: 'M.Sc.',
            programmeDescription: 'Master level specialization in organized crime, border security governance, and correctional rehabilitation.',
            level: ProgrammeLevel.MASTERS,
          },
          {
            id: 'SSC905',
            programmeCode: 'P090504',
            name: 'Ph.D. Criminology and Security Studies',
            degreeTitle: 'Ph.D.',
            programmeDescription: 'Doctoral research in policing reform, terrorism financing, or criminal justice system evaluation.',
            level: ProgrammeLevel.DOCTORATE,
          },
        ],
      },
    ],
  },
];

export const SAMPLE_COURSES = [
  // Faculty of Computing - Computer Science (CSI)
  { courseCode: 'CMP 101', courseTitle: 'Introduction to Computer Science', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 100 },
  { courseCode: 'CMP 102', courseTitle: 'Introduction to Problem Solving and Algorithms', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.SECOND_SEMESTER, session: '2026/2027', level: 100 },
  { courseCode: 'CMP 201', courseTitle: 'Computer Programming I (Python & Java)', creditUnits: 3, lectureHours: 2, tutorialHours: 0, practicalHours: 2, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'CMP 202', courseTitle: 'Data Structures and Algorithms', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 2, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.SECOND_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'CMP 301', courseTitle: 'Operating Systems and Systems Programming', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 300 },
  { courseCode: 'CMP 302', courseTitle: 'Database Design and Management Systems', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 2, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.SECOND_SEMESTER, session: '2026/2027', level: 300 },
  { courseCode: 'CMP 401', courseTitle: 'Artificial Intelligence and Expert Systems', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 400 },
  { courseCode: 'CMP 402', courseTitle: 'Software Engineering Methodologies', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'CMP201', departmentId: 'CSI', semester: AcademicSemester.SECOND_SEMESTER, session: '2026/2027', level: 400 },
  { courseCode: 'CMP 801', courseTitle: 'Advanced Distributed Systems', creditUnits: 3, lectureHours: 3, tutorialHours: 0, practicalHours: 0, programmeId: 'CMP802', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 800 },
  { courseCode: 'CMP 901', courseTitle: 'Doctoral Seminar in Advanced Computing', creditUnits: 3, lectureHours: 3, tutorialHours: 0, practicalHours: 0, programmeId: 'CMP901', departmentId: 'CSI', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 900 },

  // Faculty of Agricultural Sciences - AEE
  { courseCode: 'AEE 201', courseTitle: 'Principles of Agricultural Economics', creditUnits: 2, lectureHours: 2, tutorialHours: 0, practicalHours: 0, programmeId: 'AGR201', departmentId: 'AEE', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'AEE 301', courseTitle: 'Farm Management and Production Economics', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'AGR201', departmentId: 'AEE', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 300 },
  { courseCode: 'AEE 401', courseTitle: 'Agricultural Extension Education & Communication', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 2, programmeId: 'AGR202', departmentId: 'AEE', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 400 },

  // Faculty of Arts - LNG
  { courseCode: 'ENG 101', courseTitle: 'English Grammar and Composition I', creditUnits: 2, lectureHours: 2, tutorialHours: 0, practicalHours: 0, programmeId: 'ART201', departmentId: 'LNG', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 100 },
  { courseCode: 'ENG 201', courseTitle: 'Introduction to Phonology and Phonetics', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'ART201', departmentId: 'LNG', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },

  // Faculty of Law - CML
  { courseCode: 'LAW 201', courseTitle: 'Nigerian Legal System and Constitutional Law I', creditUnits: 4, lectureHours: 3, tutorialHours: 1, practicalHours: 0, programmeId: 'LAW201', departmentId: 'CML', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'LAW 301', courseTitle: 'Commercial Law and Sale of Goods', creditUnits: 4, lectureHours: 3, tutorialHours: 1, practicalHours: 0, programmeId: 'LAW201', departmentId: 'CML', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 300 },

  // Faculty of Management Sciences - ACC
  { courseCode: 'ACC 201', courseTitle: 'Financial Accounting I', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'MSC201', departmentId: 'ACC', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'ACC 301', courseTitle: 'Cost and Management Accounting', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'MSC201', departmentId: 'ACC', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 300 },

  // Faculty of Social Sciences - ECO
  { courseCode: 'ECO 201', courseTitle: 'Principles of Microeconomics I', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'SSC201', departmentId: 'ECO', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 200 },
  { courseCode: 'ECO 301', courseTitle: 'Advanced Macroeconomics and Policy', creditUnits: 3, lectureHours: 2, tutorialHours: 1, practicalHours: 0, programmeId: 'SSC201', departmentId: 'ECO', semester: AcademicSemester.FIRST_SEMESTER, session: '2026/2027', level: 300 },
];

export async function seedAcademicHierarchy() {
  console.log('🏛️ Seeding National Open University of Nigeria Academic Taxonomy...');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

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
  console.log('📚 Seeding Academic Courses...');
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

  console.log('✅ Academic Taxonomy, Programmes, and Courses seeding complete!');
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
