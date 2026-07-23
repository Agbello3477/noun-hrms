"use client";

import React, { useState, useEffect } from 'react';
import { 
    FileText, User, Calendar, Briefcase, Award, CheckCircle2, 
    ChevronLeft, ChevronRight, Save, Send, AlertCircle, Sparkles, Check, HelpCircle, Calculator,
    BookOpen, Layers, Target, FileSignature, Info, X
} from 'lucide-react';

interface KeyResponsibilityItem {
    id: string;
    description: string;
    importance: 'CRITICAL' | 'HIGHLY_DESIRABLE' | 'LOW_IMPORTANCE';
    achievementLevel: 'A' | 'B' | 'C' | 'D' | 'E';
}

interface QualificationItem {
    id: string;
    name: string;
    acquiredDuringPeriod: boolean;
}

interface AspectRatingItem {
    id: string;
    code: string;
    title: string;
    outstandingDesc: string;
    unsatisfactoryDesc: string;
    score: number; // 5 = A, 4 = B, 3 = C, 2 = D, 1 = E
}

interface RubricDetail {
    rating: string;
    desc: string;
}

interface OfficialAperFormProps {
    mode: 'STAFF' | 'HOD_REVIEW';
    session: any;
    profile: any;
    initialData?: any;
    onSubmit: (formData: any, isDraft: boolean) => Promise<void>;
    isSubmitting?: boolean;
}

export default function OfficialAperForm({
    mode,
    session,
    profile,
    initialData,
    onSubmit,
    isSubmitting = false
}: OfficialAperFormProps) {
    const periodYear = session?.year || new Date().getFullYear();
    const staffIdCode = profile?.staffId || profile?.user?.email?.split('@')[0] || 'NOUN/STAFF/001';

    const [currentPage, setCurrentPage] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>(1);
    const [isRubricPanelOpen, setIsRubricPanelOpen] = useState(false);
    const [selectedAspectRubric, setSelectedAspectRubric] = useState<string>('a');

    // ── PAGE 1: Personal Records (Part 1) ───────────────────────────────────
    const [page1, setPage1] = useState({
        title: profile?.title || 'Mr',
        surname: profile?.surname || '',
        firstName: profile?.otherNames?.split(' ')?.[0] || '',
        middleName: profile?.otherNames?.split(' ')?.slice(1)?.join(' ') || '',
        dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : '',
        dateOfFirstAppointment: profile?.dateOfFirstAppointment ? new Date(profile.dateOfFirstAppointment).toISOString().split('T')[0] : '',
        presentGradePostDate: profile?.rank ? `${profile.rank} (GL ${profile.level || '—'}/${profile.step || '1'})` : '',
        dateOfConfirmation: profile?.dateOfConfirmation ? new Date(profile.dateOfConfirmation).toISOString().split('T')[0] : '',
        dateOfLastPromotion: profile?.dateOfLastPromotion ? new Date(profile.dateOfLastPromotion).toISOString().split('T')[0] : '',
        schoolCentreDept: profile?.department || profile?.unit?.name || profile?.studyCenter?.name || 'NOUN HQ',
        periodInDept: '12 Months',
        actingAppointment: ''
    });

    const [qualifications, setQualifications] = useState<QualificationItem[]>([
        { id: 'q1', name: 'B.Sc. Business Administration', acquiredDuringPeriod: false },
        { id: 'q2', name: 'M.Sc. Human Resource Management', acquiredDuringPeriod: true }
    ]);

    // ── PAGE 2: Present Job & Responsibilities Rating ───────────────────────
    const [page2, setPage2] = useState({
        jobTitle: profile?.rank || 'Administrative Officer',
        keyResponsibilitiesOrder: '1. Oversee staff records and dossier archives.\n2. Coordinate APER appraisal workflow.\n3. Process staff leave and transfer requests.',
        communityService: 'Member, Campus Emergency Response & Welfare Committee.',
        adHocDuties: 'Secretary, 2026 Convocation Planning Committee.'
    });

    const [responsibilitiesTable, setResponsibilitiesTable] = useState<KeyResponsibilityItem[]>([
        { id: '1', description: 'Management of Staff Profile Dossiers', importance: 'CRITICAL', achievementLevel: 'A' },
        { id: '2', description: 'Processing Promotion & APER Documentation', importance: 'HIGHLY_DESIRABLE', achievementLevel: 'B' },
        { id: '3', description: 'Departmental Monthly Attendance Audit', importance: 'CRITICAL', achievementLevel: 'A' },
        { id: '4', description: 'Registry Archival Indexing', importance: 'LOW_IMPORTANCE', achievementLevel: 'C' }
    ]);

    // ── PAGE 3: Self Assessment & Performance Comments ────────────────────
    const [page3, setPage3] = useState({
        jobsDoneToSatisfaction: 'Successfully automated digital file requests and digitized staff dossiers, reducing response turnaround time.',
        causesOfSuccessOrLack: 'Strong team cooperation, institutional support from HR Admin, and access to automated HRMS portals.',
        needMoreTraining: 'Yes, advanced data analytics and strategic HR management training.',
        isEffectiveUseMade: 'YES',
        effectiveUseExpatiation: 'My skills in digital document archiving and administrative workflow optimization are fully utilized in my present registry role.',
        couldAbilitiesBeBetterUsed: 'NO',
        betterUsedExpatiation: 'I am currently placed in the optimal cadre where my professional qualifications and capabilities yield maximum institutional productivity.'
    });

    // ── PAGE 4: Part 2 (Reporting Officer / HOD Assessment) ────────────────
    const [page4, setPage4] = useState({
        agreeOnMainDuties: 'YES',
        disagreementNotes: 'Fully agreed on all assigned responsibilities and priority order.',
        effectivenessComments: 'The staff member has demonstrated exceptional dedication and exceeded expected performance benchmarks during the reporting period.',
        reportingOfficerName: 'Dr. A. O. Bello (HOD / Supervisor)',
        reportingOfficerRank: 'Associate Professor & HOD',
        overallRating: 'OUTSTANDING_A'
    });

    // ── PAGES 5, 6, 7: 20 Aspects of Performance (Aspects a through t) ──────
    const [aspectsPage5, setAspectsPage5] = useState<AspectRatingItem[]>([
        { id: 'a', code: '(a)', title: 'Foresight', outstandingDesc: 'Anticipates problems and develop solution in Advance', unsatisfactoryDesc: 'Rarely has solutions to problem', score: 5 },
        { id: 'b', code: '(b)', title: 'Focus', outstandingDesc: 'Gets straight to the root of a Problem', unsatisfactoryDesc: 'Never sees below the problem', score: 5 },
        { id: 'c', code: '(c)', title: 'Judgement', outstandingDesc: 'His/her decisions/proposals are consistently sound and well thought out', unsatisfactoryDesc: 'His/her judgement can not be relied upon and he/she often fails to respond to a new situation', score: 4 },
        { id: 'd', code: '(d)', title: 'Expression on paper', outstandingDesc: 'Written work always cogent, clear and well thought out', unsatisfactoryDesc: 'Ambiguous, clumsy and obscure', score: 5 },
        { id: 'e', code: '(e)', title: 'Oral Expression', outstandingDesc: 'Puts his/her point across convincing and concisely', unsatisfactoryDesc: 'Finds difficulty in expressing him/herself', score: 4 },
        { id: 'f', code: '(f)', title: 'Computer Appreciation', outstandingDesc: 'Highly Proficient', unsatisfactoryDesc: 'Lacks the ability to use the computer', score: 5 },
        { id: 'g', code: '(g)', title: 'Relation with Colleagues', outstandingDesc: 'Sensitive to other people\'s feelings; tactful and understanding of personal problems; earns great respect.', unsatisfactoryDesc: 'Ignores or belittles other people\'s feelings; intolerant; does not earn respect', score: 5 }
    ]);

    const [aspectsPage6, setAspectsPage6] = useState<AspectRatingItem[]>([
        { id: 'h', code: '(h)', title: 'Relation with the Public', outstandingDesc: 'Exceptionally effective in dealing with people of all types', unsatisfactoryDesc: 'Not very easy in his/her relationship with the Public', score: 5 },
        { id: 'i', code: '(i)', title: 'Acceptance of Responsibility', outstandingDesc: 'Seeks and accepts responsibility at all times', unsatisfactoryDesc: 'Avoids responsibility, will pass it on when possible', score: 5 },
        { id: 'j', code: '(j)', title: 'Reliability under pressure', outstandingDesc: 'Performs competently under pressure', unsatisfactoryDesc: 'Easily thrown off balance, not reliable even under normal circumstances', score: 4 },
        { id: 'k', code: '(k)', title: 'Drive and Determination', outstandingDesc: 'Wholehearted application too tasks; determined to carry task through to the end', unsatisfactoryDesc: 'Lack determination; easily baulked by minor set back', score: 5 },
        { id: 'l', code: '(l)', title: 'Application of professional/technical knowledge (if applicable)', outstandingDesc: 'Highly proficient in the practical application of professional/technical knowledge', unsatisfactoryDesc: 'Deficient in applying professional/technical knowledge to practical issues.', score: 5 },
        { id: 'm', code: '(m)', title: 'Management of staff (if applicable)', outstandingDesc: 'Organises and inspired staff to give their best', unsatisfactoryDesc: 'Inefficient in the use of staff; engenders low morale', score: 4 },
        { id: 'n', code: '(n)', title: 'Output of work', outstandingDesc: 'Gets a great deal done within given deadline', unsatisfactoryDesc: 'Sloppy in output; does not meet deadline', score: 5 }
    ]);

    const [aspectsPage7, setAspectsPage7] = useState<AspectRatingItem[]>([
        { id: 'o', code: '(o)', title: 'Quality of work', outstandingDesc: 'Maintains very high standard of work, virtually error free', unsatisfactoryDesc: 'Maintains consistently low standards of work, source of constant complaint', score: 5 },
        { id: 'p', code: '(p)', title: 'Punctuality', outstandingDesc: 'Regularly punctual at work', unsatisfactoryDesc: 'No regard for punctuality', score: 5 },
        { id: 'q', code: '(q)', title: 'Service to community', outstandingDesc: 'Always ready to serve', unsatisfactoryDesc: 'Avoids being involved', score: 4 },
        { id: 'r', code: '(r)', title: 'Initiative', outstandingDesc: 'Has ability to act on his/her own initiative', unsatisfactoryDesc: 'Lacks initiative', score: 5 },
        { id: 's', code: '(s)', title: 'General Attitude to work', outstandingDesc: 'Excellent Attitude to work', unsatisfactoryDesc: 'Poor Attitude', score: 5 },
        { id: 't', code: '(t)', title: 'Letter of Commendation', outstandingDesc: 'One letter of commendation is equal to one mark and up to a maximum of five letters of commendation', unsatisfactoryDesc: 'No commendation letters on record', score: 5 }
    ]);

    // ── PAGE 8: Part 2B Staff Certification & Training Needs (Item 18) ────────
    const [page8, setPage8] = useState({
        staffCertificationComments: 'I certify that I have seen the content of this report. I have discussed the ratings and evaluations with my HOD and HOD agrees with my progression.',
        headOfDeptName: 'Dr. A. O. Bello',
        staffLevel: profile?.level || '8',
        staffJobTitle: profile?.rank || 'Administrative Officer',
        certificationDate: new Date().toISOString().split('T')[0],
        trainingNeedsRaw: 'Advanced administrative database management training and workshop on public sector HR rules.',
        trainingNeedsExternal: 'NIM (Nigerian Institute of Management) Chartered Professional Certification Course.'
    });

    // ── PAGE 9: Next Job (Item 19), Promotability (Item 20), Potential (Item 21) ─
    const [page9, setPage9] = useState({
        nextJobSameGrade: 'YES',
        transferDifferentCadre: 'NO',
        nextJobJustification: 'Staff has demonstrated high efficiency in registry processes and will be suited to handle Senior Administrative duties in the Council Secretariat.',
        promotabilityStatus: 'WELL_SUITED', // WELL_SUITED / NOT_SUITED
        promotabilityGrade: 'Senior Administrative Officer',
        promotabilityComments: 'Highly recommended for promotion. Staff has consistently met all departmental targets with high integrity and competence.',
        longTermPotential: 'RISE_TWO_OR_MORE_GRADES' // UNLIKELY_TO_PROGRESS / RISE_ONE_GRADE / RISE_TWO_OR_MORE_GRADES
    });

    // ── PAGE 10: General Remarks (Item 22) ──────────────────────────────────
    const [page10, setPage10] = useState({
        overallPerformanceRating: '1', // 1: Outstanding, 2: Very Good, 3: Good, 4: Satisfactory, 5: Poor
        narrativeAppraisal: 'An exceptional officer with top-tier organizational and computing capabilities. Maintains high confidentiality, is extremely punctual, and earns absolute respect from colleagues.',
        adverseCommentsCommunicated: 'NO',
        hodSignatureName: 'Dr. A. O. Bello',
        hodGrade: 'GL 14',
        hodSignatureDate: new Date().toISOString().split('T')[0]
    });

    // ── PAGE 11: Future Targets (Item 23) ───────────────────────────────────
    const [futureTargets, setFutureTargets] = useState<string[]>([
        'Automate Registry incoming/outgoing mail tracking system',
        'Reduce average leave application processing cycle time to 48 hours',
        'Digitize remaining active archive staff dossiers GL 01 - 06',
        'Conduct monthly registry dossier audits for compliance',
        'Optimize APER session tracking database parameters',
        '', '', '', '', ''
    ]);

    // ── PAGE 12: Countersigning Officer\'s Report (Item 24) ──────────────────
    const [page12, setPage12] = useState({
        servedFrom: `${periodYear}-01-01`,
        servedTo: `${periodYear}-12-31`,
        countersignDisagreement: 'I concur with the HOD\'s assessment. This officer is an asset to the university and is fully ready for senior responsibilities.',
        observationFrequency: 'FREQUENTLY', // FREQUENTLY / OCCASIONALLY / SELDOM
        assessmentCommunicatedToStaff: 'YES',
        countersignName: 'Prof. M. A. Usman (Director, HR)',
        countersignGrade: 'GL 15 / Professor',
        countersignDate: new Date().toISOString().split('T')[0]
    });

    // ── PAGES 13, 14, 15: Reference Rubric Dictionary ───────────────────────
    const rubricDictionary: Record<string, { title: string; rubrics: RubricDetail[] }> = {
        a: {
            title: 'Foresight',
            rubrics: [
                { rating: 'A (5)', desc: 'Anticipates problems and develops solutions in advance' },
                { rating: 'B (4)', desc: 'Finds solution promptly to problems' },
                { rating: 'C (3)', desc: 'Grapples with problems as they arise' },
                { rating: 'D (2)', desc: 'Grapples with problems after they arise' },
                { rating: 'E (1)', desc: 'Rarely has solutions to problems' }
            ]
        },
        b: {
            title: 'Focus',
            rubrics: [
                { rating: 'A (5)', desc: 'Gets straight to the root of a problem' },
                { rating: 'B (4)', desc: 'Gets to the root of most problems' },
                { rating: 'C (3)', desc: 'Often gets to the root of a problem eventually' },
                { rating: 'D (2)', desc: 'Seldom sees below the surface of a problem' },
                { rating: 'E (1)', desc: 'Never sees below the surface of a problem' }
            ]
        },
        c: {
            title: 'Judgement',
            rubrics: [
                { rating: 'A (5)', desc: 'His/her decisions or proposals are consistently sound and well thought out' },
                { rating: 'B (4)', desc: 'He/she takes reasonable view on most matters and generally makes valuable contributions' },
                { rating: 'C (3)', desc: 'His/her view of a matter is nearly always sensible one and his/her contributions are normally adequate' },
                { rating: 'D (2)', desc: 'His/her judgement tends to be erratic and he/she seldom takes any constructive action' },
                { rating: 'E (1)', desc: 'His/her judgement cannot be relied upon and he/she often fails to respond to a new situation.' }
            ]
        },
        d: {
            title: 'Expression on Paper',
            rubrics: [
                { rating: 'A (5)', desc: 'Written work always clear, cogent and well thought out' },
                { rating: 'B (4)', desc: 'Generally expresses him/herself clearly and concisely' },
                { rating: 'C (3)', desc: 'Written work just good enough to get by' },
                { rating: 'D (2)', desc: 'Cannot express him/herself clearly on paper' },
                { rating: 'E (1)', desc: 'Ambiguous, clumsy and obscure' }
            ]
        },
        e: {
            title: 'Oral Expression',
            rubrics: [
                { rating: 'A (5)', desc: 'Puts his/her point across convincingly and concisely' },
                { rating: 'B (4)', desc: 'Puts his/her point across convincingly' },
                { rating: 'C (3)', desc: 'Expresses him/herself adequately' },
                { rating: 'D (2)', desc: 'Barely competent' },
                { rating: 'E (1)', desc: 'Finds difficulty in expressing him/herself.' }
            ]
        },
        f: {
            title: 'Computer Appreciation',
            rubrics: [
                { rating: 'A (5)', desc: 'Highly proficient' },
                { rating: 'B (4)', desc: 'Competent in use and application of computer' },
                { rating: 'C (3)', desc: 'Generally good in use of computer' },
                { rating: 'D (2)', desc: 'Barely competent' },
                { rating: 'E (1)', desc: 'Lacks the ability to use the computer' }
            ]
        },
        g: {
            title: 'Relations with Colleagues',
            rubrics: [
                { rating: 'A (5)', desc: 'Sensitive to other people’s feelings, tactful and understanding of personal problems; earns great respect.' },
                { rating: 'B (4)', desc: 'Is generally liked and respected' },
                { rating: 'C (3)', desc: 'Gets on well with most people' },
                { rating: 'D (2)', desc: 'Not very easy in his/her relationships' },
                { rating: 'E (1)', desc: 'Ignores or belittles other people’s feelings, intolerant, does not earn respect' }
            ]
        },
        h: {
            title: 'Relationship with Public',
            rubrics: [
                { rating: 'A (5)', desc: 'Exceptionally effective in dealing with people of all types' },
                { rating: 'B (4)', desc: 'Generally tactful and effective in dealing with the public' },
                { rating: 'C (3)', desc: 'Gets on well with members of the public' },
                { rating: 'D (2)', desc: 'Gets on well on occasion with members of the public' },
                { rating: 'E (1)', desc: 'Not very easy in his/her relationships with the public' }
            ]
        },
        i: {
            title: 'Acceptance of Responsibility',
            rubrics: [
                { rating: 'A (5)', desc: 'Seeks and accepts responsibility at all times' },
                { rating: 'B (4)', desc: 'Very willing to accept responsibility' },
                { rating: 'C (3)', desc: 'Accepts responsibility as it comes' },
                { rating: 'D (2)', desc: 'Inclined to refer up matters he/she could him/herself decide' },
                { rating: 'E (1)', desc: 'Avoids responsibility, will pass it on when possible.' }
            ]
        },
        j: {
            title: 'Reliability under pressure',
            rubrics: [
                { rating: 'A (5)', desc: 'Performs competently under pressure' },
                { rating: 'B (4)', desc: 'Performs reasonably well under pressure' },
                { rating: 'C (3)', desc: 'Manages to cope under pressure' },
                { rating: 'D (2)', desc: 'Seldom copes with problems under pressure' },
                { rating: 'E (1)', desc: 'Easily thrown off balance; not reliable even under normal circumstances.' }
            ]
        },
        k: {
            title: 'Drive and determination',
            rubrics: [
                { rating: 'A (5)', desc: 'Whole hearted application to task; determined to carry task through the end' },
                { rating: 'B (4)', desc: 'Unbending in his/her application to task' },
                { rating: 'C (3)', desc: 'Applies him/herself reasonably well to situations' },
                { rating: 'D (2)', desc: 'Finds difficulty in situations' },
                { rating: 'E (1)', desc: 'Lacks determination; easily baulked by minor setbacks' }
            ]
        },
        l: {
            title: 'Application of professional/technical knowledge',
            rubrics: [
                { rating: 'A (5)', desc: 'Highly proficient in practical application of professional knowledge' },
                { rating: 'B (4)', desc: 'Very proficient in the practical application of professional/technical knowledge' },
                { rating: 'C (3)', desc: 'Generally proficient in application of professional/technical knowledge' },
                { rating: 'D (2)', desc: 'Not proficient in the practical application of professional/technical knowledge' },
                { rating: 'E (1)', desc: 'Deficient in application of professional/technical knowledge to practical issues' }
            ]
        },
        m: {
            title: 'Management of staff',
            rubrics: [
                { rating: 'A (5)', desc: 'Organizes and inspires staff to give their best' },
                { rating: 'B (4)', desc: 'Manages them distinctly well' },
                { rating: 'C (3)', desc: 'They work quite well for him/her' },
                { rating: 'D (2)', desc: 'Does not control them very skillfully' },
                { rating: 'E (1)', desc: 'Inefficient in the use of staff, endangers low morale.' }
            ]
        },
        n: {
            title: 'Output of work',
            rubrics: [
                { rating: 'A (5)', desc: 'Gets a great deal done within given deadline' },
                { rating: 'B (4)', desc: 'Gets through a lot of work' },
                { rating: 'C (3)', desc: 'Output generally satisfactory' },
                { rating: 'D (2)', desc: 'Does rather less than expected.' },
                { rating: 'E (1)', desc: 'Sloppy in output; does not meet deadline' }
            ]
        },
        o: {
            title: 'Quality of work',
            rubrics: [
                { rating: 'A (5)', desc: 'Maintains very high standard; work is virtually error proof.' },
                { rating: 'B (4)', desc: 'Maintains a high standard' },
                { rating: 'C (3)', desc: 'His/her work is generally of good quality' },
                { rating: 'D (2)', desc: 'His/her performance is uneven' },
                { rating: 'E (1)', desc: 'Maintains consistently low standard at work, source of constant complaint' }
            ]
        },
        p: {
            title: 'Punctuality',
            rubrics: [
                { rating: 'A (5)', desc: 'Regularly punctual at work' },
                { rating: 'B (4)', desc: 'Always punctual at work' },
                { rating: 'C (3)', desc: 'Punctual at work most of the time' },
                { rating: 'D (2)', desc: 'Not punctual at work most of the time' },
                { rating: 'E (1)', desc: 'No regard for punctuality' }
            ]
        },
        q: {
            title: 'Service to Community',
            rubrics: [
                { rating: 'A (5)', desc: 'Always ready to be involved' },
                { rating: 'B (4)', desc: 'Reasonably eager to be involved' },
                { rating: 'C (3)', desc: 'Reluctantly involved' },
                { rating: 'D (2)', desc: 'Barely involved' },
                { rating: 'E (1)', desc: 'Avoids being involved' }
            ]
        },
        r: {
            title: 'Initiative',
            rubrics: [
                { rating: 'A (5)', desc: 'Has the ability to act on his/her own initiative' },
                { rating: 'B (4)', desc: 'Sometimes takes initiative without supervision' },
                { rating: 'C (3)', desc: 'Managed to take initiative without supervision' },
                { rating: 'D (2)', desc: 'Hardly takes initiative by him/herself' },
                { rating: 'E (1)', desc: 'Lacks initiative' }
            ]
        },
        s: {
            title: 'Attitude to work',
            rubrics: [
                { rating: 'A (5)', desc: 'Excellent attitude to work' },
                { rating: 'B (4)', desc: 'Positive attitude to work' },
                { rating: 'C (3)', desc: 'Lukewarm' },
                { rating: 'D (2)', desc: 'Lackadaisical attitude' },
                { rating: 'E (1)', desc: 'Poor attitude' }
            ]
        },
        t: {
            title: 'Commendation',
            rubrics: [
                { rating: 'A (5)', desc: 'One letter of commendation gives one mark and up to a maximum of five marks' }
            ]
        }
    };

    // Load initial data if editing existing draft
    useEffect(() => {
        if (initialData) {
            if (initialData.page1) setPage1(prev => ({ ...prev, ...initialData.page1 }));
            if (initialData.qualifications) setQualifications(initialData.qualifications);
            if (initialData.page2) setPage2(prev => ({ ...prev, ...initialData.page2 }));
            if (initialData.responsibilitiesTable) setResponsibilitiesTable(initialData.responsibilitiesTable);
            if (initialData.page3) setPage3(prev => ({ ...prev, ...initialData.page3 }));
            if (initialData.page4) setPage4(prev => ({ ...prev, ...initialData.page4 }));
            if (initialData.aspectsPage5) setAspectsPage5(initialData.aspectsPage5);
            if (initialData.aspectsPage6) setAspectsPage6(initialData.aspectsPage6);
            if (initialData.aspectsPage7) setAspectsPage7(initialData.aspectsPage7);
            if (initialData.page8) setPage8(prev => ({ ...prev, ...initialData.page8 }));
            if (initialData.page9) setPage9(prev => ({ ...prev, ...initialData.page9 }));
            if (initialData.page10) setPage10(prev => ({ ...prev, ...initialData.page10 }));
            if (initialData.futureTargets) setFutureTargets(initialData.futureTargets);
            if (initialData.page12) setPage12(prev => ({ ...prev, ...initialData.page12 }));
        }
    }, [initialData]);

    const handleAddQualification = () => {
        setQualifications(prev => [
            ...prev,
            { id: `q-${Date.now()}`, name: '', acquiredDuringPeriod: false }
        ]);
    };

    const handleAddResponsibilityRow = () => {
        setResponsibilitiesTable(prev => [
            ...prev,
            { id: `${prev.length + 1}`, description: '', importance: 'HIGHLY_DESIRABLE', achievementLevel: 'B' }
        ]);
    };

    // ── Score Calculations ───────────────────────────────────────────────────
    const calculateTotalRawScore = () => {
        const sum5 = aspectsPage5.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const sum6 = aspectsPage6.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const sum7 = aspectsPage7.reduce((acc, curr) => acc + (curr.score || 0), 0);
        return sum5 + sum6 + sum7; // Max possible = 100 points
    };

    const rawScore = calculateTotalRawScore();
    const aperWeightedScore = ((rawScore / 100) * 30).toFixed(2); // APER is weighted at 30%

    const handleSaveDraft = () => {
        const fullPayload = {
            page1,
            qualifications,
            page2,
            responsibilitiesTable,
            page3,
            page4,
            aspectsPage5,
            aspectsPage6,
            aspectsPage7,
            page8,
            page9,
            page10,
            futureTargets,
            page12,
            scores: { rawScore, aperWeightedScore }
        };
        onSubmit(fullPayload, true);
    };

    const handleFinalSubmit = () => {
        const fullPayload = {
            page1,
            qualifications,
            page2,
            responsibilitiesTable,
            page3,
            page4,
            aspectsPage5,
            aspectsPage6,
            aspectsPage7,
            page8,
            page9,
            page10,
            futureTargets,
            page12,
            scores: { rawScore, aperWeightedScore }
        };
        onSubmit(fullPayload, false);
    };

    const renderAspectRatingRow = (
        item: AspectRatingItem, 
        setter: React.Dispatch<React.SetStateAction<AspectRatingItem[]>>
    ) => {
        return (
            <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-200">
                <td className="p-3 align-top font-bold text-slate-800 w-[24%]">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedAspectRubric(item.id);
                            setIsRubricPanelOpen(true);
                        }}
                        className="text-left hover:text-emerald-700 flex items-center gap-1 group"
                        title="Click to view detailed grading rubric notes"
                    >
                        <span className="text-emerald-700 font-extrabold mr-1">{item.code}</span> {item.title}
                        <BookOpen size={12} className="text-slate-400 group-hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </td>
                <td className="p-3 align-top text-xs text-slate-600 font-medium w-[28%] bg-emerald-50/20">
                    {item.outstandingDesc}
                </td>
                {[5, 4, 3, 2, 1].map(val => (
                    <td key={val} className="p-3 text-center align-middle w-[6%] border-x border-slate-200">
                        <input
                            type="radio"
                            disabled={mode === 'STAFF'}
                            name={`aspect-${item.id}`}
                            checked={item.score === val}
                            onChange={() => {
                                setter(prev => prev.map(a => a.id === item.id ? { ...a, score: val } : a));
                            }}
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                    </td>
                ))}
                <td className="p-3 align-top text-xs text-slate-500 font-medium w-[24%] bg-slate-50">
                    {item.unsatisfactoryDesc}
                </td>
            </tr>
        );
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden max-w-5xl mx-auto my-6 animate-in fade-in duration-300 relative">
            
            {/* Official NOUN Header Banner */}
            <div 
                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                className="px-8 py-6 text-white border-b-4 border-amber-400 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md"
            >
                <div className="flex items-center gap-4 relative z-10">
                    <img src="/noun_logo.png" alt="NOUN Logo" className="h-14 w-14 object-contain bg-white rounded-2xl p-1.5 shadow-md" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-amber-300">
                            National Open University of Nigeria
                        </h1>
                        <h2 className="text-sm md:text-base font-bold text-white tracking-wide">
                            ANNUAL PERFORMANCE EVALUATION REPORT (APER)
                        </h2>
                    </div>
                </div>

                <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl px-5 py-2.5 text-right relative z-10 text-xs font-bold space-y-1 shadow-inner">
                    <div className="text-amber-300 uppercase tracking-wider text-[10px] font-extrabold">Report Metadata</div>
                    <div>Period of Report: <span className="text-white font-extrabold text-sm">{periodYear}</span></div>
                    <div>Staff ID: <span className="text-emerald-200 font-extrabold text-sm">{staffIdCode}</span></div>
                </div>
            </div>

            {/* 12 Page Tab Navigation Wizard */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                    {[
                        { num: 1, label: 'Page 1' },
                        { num: 2, label: 'Page 2' },
                        { num: 3, label: 'Page 3' },
                        { num: 4, label: 'Page 4' },
                        { num: 5, label: 'Page 5' },
                        { num: 6, label: 'Page 6' },
                        { num: 7, label: 'Page 7' },
                        { num: 8, label: 'Page 8 (Part 2B)' },
                        { num: 9, label: 'Page 9 (Options)' },
                        { num: 10, label: 'Page 10 (Remarks)' },
                        { num: 11, label: 'Page 11 (Targets)' },
                        { num: 12, label: 'Page 12 (Countersign)' }
                    ].map(p => (
                        <button
                            key={p.num}
                            onClick={() => setCurrentPage(p.num as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-1.5 border shrink-0 ${
                                currentPage === p.num
                                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-105'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                currentPage === p.num ? 'bg-amber-400 text-emerald-950 font-black' : 'bg-slate-200 text-slate-700 font-bold'
                            }`}>
                                {p.num}
                            </span>
                            <span>{p.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsRubricPanelOpen(true)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-extrabold flex items-center gap-1 border border-amber-200 shadow-sm"
                    >
                        <BookOpen size={14} />
                        <span>Grading Rubric Helper</span>
                    </button>
                </div>
            </div>

            {/* Main Form Content Container */}
            <div className="p-6 md:p-10 space-y-8 min-h-[500px]">

                {/* PAGES 1 - 7 */}
                {currentPage === 1 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <User className="text-emerald-700" size={20} />
                                PART 1. Personal Records of Employee
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">Please verify and complete all personal identification and substantive appointment parameters.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">1. Title</label>
                                <input
                                    type="text"
                                    value={page1.title}
                                    onChange={e => setPage1({ ...page1, title: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">3. Surname</label>
                                <input
                                    type="text"
                                    value={page1.surname}
                                    onChange={e => setPage1({ ...page1, surname: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">4. First Name</label>
                                <input
                                    type="text"
                                    value={page1.firstName}
                                    onChange={e => setPage1({ ...page1, firstName: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">2. Middle Name</label>
                                <input
                                    type="text"
                                    value={page1.middleName}
                                    onChange={e => setPage1({ ...page1, middleName: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">5. Date of Birth</label>
                                <input
                                    type="date"
                                    value={page1.dateOfBirth}
                                    onChange={e => setPage1({ ...page1, dateOfBirth: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">6. Date of First Appointment</label>
                                <input
                                    type="date"
                                    value={page1.dateOfFirstAppointment}
                                    onChange={e => setPage1({ ...page1, dateOfFirstAppointment: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">7. Present Substantive Grade/Post/Date</label>
                                <input
                                    type="text"
                                    value={page1.presentGradePostDate}
                                    onChange={e => setPage1({ ...page1, presentGradePostDate: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">8. Date of Confirmation of Appointment</label>
                                <input
                                    type="date"
                                    value={page1.dateOfConfirmation}
                                    onChange={e => setPage1({ ...page1, dateOfConfirmation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">9. Date of Last Promotion</label>
                                <input
                                    type="date"
                                    value={page1.dateOfLastPromotion}
                                    onChange={e => setPage1({ ...page1, dateOfLastPromotion: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">10. School / Centre / Department</label>
                                <input
                                    type="text"
                                    value={page1.schoolCentreDept}
                                    onChange={e => setPage1({ ...page1, schoolCentreDept: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">11. Period you have been in the school/centre/dept</label>
                                <input
                                    type="text"
                                    value={page1.periodInDept}
                                    onChange={e => setPage1({ ...page1, periodInDept: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    placeholder="e.g. 2 Years 4 Months"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">13. Acting Appointment held during period of report</label>
                                <input
                                    type="text"
                                    value={page1.actingAppointment}
                                    onChange={e => setPage1({ ...page1, actingAppointment: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    placeholder="Indicate portion (to nearest month) spent on post"
                                />
                            </div>
                        </div>

                        {/* 12. Qualifications Held */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase">12. Qualifications Held (Degree, Diploma, Certificate etc.)</h4>
                                    <p className="text-[11px] text-slate-500 font-semibold">Underline/Check those acquired during the reporting period.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddQualification}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    + Add Qualification
                                </button>
                            </div>

                            <div className="space-y-2">
                                {qualifications.map((q, idx) => (
                                    <div key={q.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                                        <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                                        <input
                                            type="text"
                                            value={q.name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setQualifications(prev => prev.map(item => item.id === q.id ? { ...item, name: val } : item));
                                            }}
                                            placeholder="e.g. M.Sc. Information Technology"
                                            className="flex-1 border rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
                                        />
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                            <input
                                                type="checkbox"
                                                checked={q.acquiredDuringPeriod}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setQualifications(prev => prev.map(item => item.id === q.id ? { ...item, acquiredDuringPeriod: checked } : item));
                                                }}
                                                className="rounded text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Acquired During Period</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {currentPage === 2 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Briefcase className="text-emerald-700" size={20} />
                                PAGE 2. Present Job & Key Responsibilities
                            </h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">14. Course/Training/Programme undertaken during period of report</label>
                            <textarea
                                rows={3}
                                value={page2.keyResponsibilitiesOrder}
                                onChange={e => setPage2({ ...page2, keyResponsibilitiesOrder: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                placeholder="List all professional development courses, workshops, and training programmes completed..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                15 (a). State below in order of importance the key responsibilities of present position performed during report period
                            </label>
                            <textarea
                                rows={3}
                                value={page2.keyResponsibilitiesOrder}
                                onChange={e => setPage2({ ...page2, keyResponsibilitiesOrder: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">15 (b). Community Service / Letters of Commendation</label>
                                <textarea
                                    rows={2}
                                    value={page2.communityService}
                                    onChange={e => setPage2({ ...page2, communityService: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">15 (c). Ad-hoc Duties Performed (Non-continuous)</label>
                                <textarea
                                    rows={2}
                                    value={page2.adHocDuties}
                                    onChange={e => setPage2({ ...page2, adHocDuties: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        {/* 15 (d). Rating Table */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase">
                                        15 (d). List and rate (tick) importance of key responsibilities assigned to you during period under review
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddResponsibilityRow}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    + Add Responsibility
                                </button>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-emerald-900 text-white font-extrabold uppercase border-b border-emerald-950">
                                            <th className="p-3 text-center w-12">S/N</th>
                                            <th className="p-3">Key Responsibilities</th>
                                            <th className="p-3 text-center w-28">Critical</th>
                                            <th className="p-3 text-center w-32">Highly Desirable</th>
                                            <th className="p-3 text-center w-28">Low Importance</th>
                                            <th className="p-3 text-center w-36">Level of Achievement</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {responsibilitiesTable.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                                                <td className="p-3">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, description: val } : r));
                                                        }}
                                                        className="w-full border rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
                                                        placeholder="Describe key assigned responsibility..."
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'CRITICAL'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'CRITICAL' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'HIGHLY_DESIRABLE'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'HIGHLY_DESIRABLE' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'LOW_IMPORTANCE'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'LOW_IMPORTANCE' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <select
                                                        value={item.achievementLevel}
                                                        onChange={e => {
                                                            const val = e.target.value as any;
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, achievementLevel: val } : r));
                                                        }}
                                                        className="border rounded-lg p-1.5 font-bold text-xs bg-slate-50 text-slate-800 outline-none focus:border-emerald-600"
                                                    >
                                                        <option value="A">Grade A (Highest)</option>
                                                        <option value="B">Grade B</option>
                                                        <option value="C">Grade C</option>
                                                        <option value="D">Grade D</option>
                                                        <option value="E">Grade E (Lowest)</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-center font-black text-slate-900 text-xs tracking-wide pt-1">
                                Please Rank (A - Highest and E - Lowest)
                            </p>
                        </div>
                    </div>
                )}

                {currentPage === 3 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-emerald-700" size={20} />
                                PAGE 3. Comments & Capability Expatiation
                            </h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (a). Which jobs assigned to you do you think you have undertaken to the satisfaction of your immediate supervisor/HOD?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.jobsDoneToSatisfaction}
                                onChange={e => setPage3({ ...page3, jobsDoneToSatisfaction: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (b). What are the causes or reasons, personal or otherwise, to which you ascribe your success or lack of success?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.causesOfSuccessOrLack}
                                onChange={e => setPage3({ ...page3, causesOfSuccessOrLack: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (c). Do you think that you need more training or experience to enable you to do your job better? If so, of what kind?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.needMoreTraining}
                                onChange={e => setPage3({ ...page3, needMoreTraining: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        {/* 16 (d) */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-extrabold text-slate-900">
                                    16 (d). Is the most effective use being made of your capabilities in your present job?
                                </label>
                                <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="effectiveUse"
                                            checked={page3.isEffectiveUseMade === 'YES'}
                                            onChange={() => setPage3({ ...page3, isEffectiveUseMade: 'YES' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] YES</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="effectiveUse"
                                            checked={page3.isEffectiveUseMade === 'NO'}
                                            onChange={() => setPage3({ ...page3, isEffectiveUseMade: 'NO' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] NO</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Please Expatiate:</label>
                                <textarea
                                    rows={2}
                                    value={page3.effectiveUseExpatiation}
                                    onChange={e => setPage3({ ...page3, effectiveUseExpatiation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>

                        {/* 16 (e) */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-extrabold text-slate-900">
                                    16 (e). Do you think that your abilities could be better used in your present job or in another kind of job?
                                </label>
                                <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="betterUsed"
                                            checked={page3.couldAbilitiesBeBetterUsed === 'YES'}
                                            onChange={() => setPage3({ ...page3, couldAbilitiesBeBetterUsed: 'YES' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] YES</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="betterUsed"
                                            checked={page3.couldAbilitiesBeBetterUsed === 'NO'}
                                            onChange={() => setPage3({ ...page3, couldAbilitiesBeBetterUsed: 'NO' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] NO</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Please Expatiate:</label>
                                <textarea
                                    rows={2}
                                    value={page3.betterUsedExpatiation}
                                    onChange={e => setPage3({ ...page3, betterUsedExpatiation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentPage === 4 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-amber-500" size={20} />
                                PART 2. Assessment of Performance (Reporting Officer / HOD)
                            </h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                (a) Do you and the person reported upon agree on the main duties performed and order of importance? (Record unresolved differences below):
                            </label>
                            <textarea
                                rows={3}
                                disabled={mode === 'STAFF'}
                                value={page4.disagreementNotes}
                                onChange={e => setPage4({ ...page4, disagreementNotes: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 disabled:bg-slate-50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                (b) How effective is he/she in the performance of duties set out in 15 (a) and (b), or how far achieved required results?
                            </label>
                            <textarea
                                rows={3}
                                disabled={mode === 'STAFF'}
                                value={page4.effectivenessComments}
                                onChange={e => setPage4({ ...page4, effectivenessComments: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 disabled:bg-slate-50"
                            />
                        </div>
                    </div>
                )}

                {currentPage === 5 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-emerald-700" size={20} />
                                PAGE 5. Aspects of Performance (a - g)
                            </h3>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-emerald-900 text-white font-extrabold uppercase border-b border-emerald-950">
                                        <th className="p-3">Aspect</th>
                                        <th className="p-3">Outstanding Performance (5/A)</th>
                                        <th className="p-3 text-center">5 (A)</th>
                                        <th className="p-3 text-center">4 (B)</th>
                                        <th className="p-3 text-center">3 (C)</th>
                                        <th className="p-3 text-center">2 (D)</th>
                                        <th className="p-3 text-center">1 (E)</th>
                                        <th className="p-3">Unsatisfactory Performance (1/E)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aspectsPage5.map(item => renderAspectRatingRow(item, setAspectsPage5))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {currentPage === 6 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-emerald-700" size={20} />
                                PAGE 6. Aspects of Performance (h - n)
                            </h3>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-emerald-900 text-white font-extrabold uppercase border-b border-emerald-950">
                                        <th className="p-3">Aspect</th>
                                        <th className="p-3">Outstanding Performance (5/A)</th>
                                        <th className="p-3 text-center">5 (A)</th>
                                        <th className="p-3 text-center">4 (B)</th>
                                        <th className="p-3 text-center">3 (C)</th>
                                        <th className="p-3 text-center">2 (D)</th>
                                        <th className="p-3 text-center">1 (E)</th>
                                        <th className="p-3">Unsatisfactory Performance (1/E)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aspectsPage6.map(item => renderAspectRatingRow(item, setAspectsPage6))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {currentPage === 7 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Calculator className="text-emerald-700" size={20} />
                                PAGE 7. Aspects of Performance (o - t)
                            </h3>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-emerald-900 text-white font-extrabold uppercase border-b border-emerald-950">
                                        <th className="p-3">Aspect</th>
                                        <th className="p-3">Outstanding Performance (5/A)</th>
                                        <th className="p-3 text-center">5 (A)</th>
                                        <th className="p-3 text-center">4 (B)</th>
                                        <th className="p-3 text-center">3 (C)</th>
                                        <th className="p-3 text-center">2 (D)</th>
                                        <th className="p-3 text-center">1 (E)</th>
                                        <th className="p-3">Unsatisfactory Performance (1/E)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aspectsPage7.map(item => renderAspectRatingRow(item, setAspectsPage7))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 8: PART 2B STAFF CERTIFICATION & Item 18 TRAINING NEEDS
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 8 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <FileSignature className="text-emerald-700" size={20} />
                                PAGE 8. PART 2B Staff Certification & Training Needs (Item 18)
                            </h3>
                        </div>

                        {/* PART 2B: To be completed by staff being assessed */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                PART 2B: To be completed by staff being assessed
                            </h4>
                            <p className="text-xs text-slate-600 font-semibold italic">
                                "I certify that I have seen the content of this report. I have the following comment to add, after having discussed my disagreements over the rating, with my immediate supervisor."
                            </p>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Comments / Discussion Notes:</label>
                                <textarea
                                    rows={3}
                                    value={page8.staffCertificationComments}
                                    onChange={e => setPage8({ ...page8, staffCertificationComments: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Head of Department</label>
                                    <input
                                        type="text"
                                        value={page8.headOfDeptName}
                                        onChange={e => setPage8({ ...page8, headOfDeptName: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Level / Step</label>
                                    <input
                                        type="text"
                                        value={page8.staffLevel}
                                        onChange={e => setPage8({ ...page8, staffLevel: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Job Title</label>
                                    <input
                                        type="text"
                                        value={page8.staffJobTitle}
                                        onChange={e => setPage8({ ...page8, staffJobTitle: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Date Signed</label>
                                    <input
                                        type="date"
                                        value={page8.certificationDate}
                                        onChange={e => setPage8({ ...page8, certificationDate: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* PART 3: 18. Training needs */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                PART 3: 18. Training Needs Assessment
                            </h4>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    (a) If as a result of assessments made earlier you consider performance/potential could be improved by training, specify needs:
                                </label>
                                <textarea
                                    rows={2}
                                    value={page8.trainingNeedsRaw}
                                    onChange={e => setPage8({ ...page8, trainingNeedsRaw: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    (b) If training needs cannot be met on the job, please suggest ways in which they might be met:
                                </label>
                                <textarea
                                    rows={2}
                                    value={page8.trainingNeedsExternal}
                                    onChange={e => setPage8({ ...page8, trainingNeedsExternal: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 9: Item 19 NEXT JOB, Item 20 PROMOTABILITY & Item 21 POTENTIAL
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 9 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Layers className="text-emerald-700" size={20} />
                                PAGE 9. Career Recommendations & Promotability Options
                            </h3>
                        </div>

                        {/* Item 19: Next job at the same level */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                19. Next Job at the Same Level / Cadre Recommendations
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl border flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">(a) Considered during next year for different job in same grade?</span>
                                    <select
                                        value={page9.nextJobSameGrade}
                                        onChange={e => setPage9({ ...page9, nextJobSameGrade: e.target.value })}
                                        className="border rounded px-2.5 py-1.5 text-xs font-extrabold bg-slate-50 outline-none focus:border-emerald-600"
                                    >
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                    </select>
                                </div>

                                <div className="bg-white p-3 rounded-xl border flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">(b) Transfer to a job at similar level in another cadre?</span>
                                    <select
                                        value={page9.transferDifferentCadre}
                                        onChange={e => setPage9({ ...page9, transferDifferentCadre: e.target.value })}
                                        className="border rounded px-2.5 py-1.5 text-xs font-extrabold bg-slate-50 outline-none focus:border-emerald-600"
                                    >
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    If you have answered yes to either question, say which kind of job and give your reasons below:
                                </label>
                                <textarea
                                    rows={2}
                                    value={page9.nextJobJustification}
                                    onChange={e => setPage9({ ...page9, nextJobJustification: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>

                        {/* Item 20: Promotability */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                20. Promotability Recommendation
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl border flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Suitability Status:</span>
                                    <select
                                        value={page9.promotabilityStatus}
                                        onChange={e => setPage9({ ...page9, promotabilityStatus: e.target.value })}
                                        className="border rounded px-2.5 py-1.5 text-xs font-extrabold bg-slate-50 outline-none focus:border-emerald-600"
                                    >
                                        <option value="WELL_SUITED">Well Suited for Promotion</option>
                                        <option value="NOT_SUITED">Not Suited at Present</option>
                                    </select>
                                </div>

                                <div className="bg-white p-3 rounded-xl border flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 shrink-0">Suited for Promotion to (Grade/Post):</span>
                                    <input
                                        type="text"
                                        value={page9.promotabilityGrade}
                                        onChange={e => setPage9({ ...page9, promotabilityGrade: e.target.value })}
                                        placeholder="e.g. Senior Admin Officer"
                                        className="w-full border rounded-lg p-1.5 text-xs font-semibold text-slate-800 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Comment on your recommendation:</label>
                                <textarea
                                    rows={2}
                                    value={page9.promotabilityComments}
                                    onChange={e => setPage9({ ...page9, promotabilityComments: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>

                        {/* Item 21: Long term potential */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                21. Long Term Potential
                            </h4>
                            <div className="space-y-2 text-xs font-bold text-slate-800">
                                {[
                                    { value: 'UNLIKELY_TO_PROGRESS', label: 'At present he/she seems unlikely to progress further' },
                                    { value: 'RISE_ONE_GRADE', label: 'Has potential to rise above one grade but probably no further' },
                                    { value: 'RISE_TWO_OR_MORE_GRADES', label: 'Has potential to rise two or more grades' }
                                ].map(option => (
                                    <label key={option.value} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border cursor-pointer hover:bg-slate-100 transition">
                                        <input
                                            type="radio"
                                            name="longTermPotential"
                                            checked={page9.longTermPotential === option.value}
                                            onChange={() => setPage9({ ...page9, longTermPotential: option.value })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 10: Item 22 GENERAL REMARKS & NARRATIVE APPRAISAL
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 10 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-emerald-700" size={20} />
                                PAGE 10. General Remarks & Narrative Appraisal
                            </h3>
                        </div>

                        {/* 22 (a) Overall performance classification */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                22 (a). Overall performance of duties
                            </h4>
                            <p className="text-[11px] text-slate-500 font-semibold">
                                Select one classification based on assessment in items 16 and ratings of aspects of performance.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-extrabold">
                                {[
                                    { value: '1', label: '1 - Outstanding Exceptionally Effective' },
                                    { value: '2', label: '2 - Very Good More than generally Effective' },
                                    { value: '3', label: '3 - Good Generally Effective' },
                                    { value: '4', label: '4 - Satisfactory Barely Acceptable' },
                                    { value: '5', label: '5 - Poor Unacceptable' }
                                ].map(classification => (
                                    <label key={classification.value} className={`p-3 border rounded-xl cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 transition ${
                                        page10.overallPerformanceRating === classification.value
                                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-105'
                                            : 'bg-white text-slate-800 hover:bg-slate-100'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="overallClassification"
                                            checked={page10.overallPerformanceRating === classification.value}
                                            onChange={() => setPage10({ ...page10, overallPerformanceRating: classification.value })}
                                            className="sr-only"
                                        />
                                        <span className="text-sm font-black">{classification.value}</span>
                                        <span className="text-[10px] leading-tight font-bold">{classification.label.split(' - ')[1]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 22 (b) Narrative appraisal */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                22 (b). Narrative appraisal of the officer
                            </h4>
                            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                Make a narrative appraisal of the officer assessed based on your continuous evaluation over the reporting period, drawing attention to any particular strengths or weakness, including his/her integrity as they affect performance.
                            </p>

                            <textarea
                                rows={4}
                                value={page10.narrativeAppraisal}
                                onChange={e => setPage10({ ...page10, narrativeAppraisal: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                            />
                        </div>

                        {/* 22 (c) Adverse comments */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-extrabold text-slate-900">
                                    22 (c). Any adverse comment(s) on the officer should be brought to his/her notice before being reflected here. Has this been done?
                                </label>
                                <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="adverseComments"
                                            checked={page10.adverseCommentsCommunicated === 'YES'}
                                            onChange={() => setPage10({ ...page10, adverseCommentsCommunicated: 'YES' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] YES</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="adverseComments"
                                            checked={page10.adverseCommentsCommunicated === 'NO'}
                                            onChange={() => setPage10({ ...page10, adverseCommentsCommunicated: 'NO' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] NO</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 11: Item 23 KEY TARGETS AND RESPONSIBILITIES FOR NEXT PERIOD
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 11 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Target className="text-emerald-700" size={20} />
                                PAGE 11. 23. Key Targets & Responsibilities for Next Period
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                List below the key targets and responsibilities agreed upon to be achieved by the officer for the next period to be evaluated (1 - 10).
                            </p>
                        </div>

                        <div className="space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                            {futureTargets.map((target, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={target}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFutureTargets(prev => prev.map((t, i) => i === index ? val : t));
                                        }}
                                        placeholder={`Enter target ${index + 1}...`}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 12: Item 24 COUNTERSIGNING OFFICER'S REPORT
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 12 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <FileSignature className="text-emerald-700" size={20} />
                                PAGE 12. 24. Countersigning Officer’s Report & Validation
                            </h3>
                        </div>

                        {/* Countersigning Statement */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                Countersigning Evaluation
                            </h4>
                            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                                The countersigning officer will normally be the immediate superior of the Reporting officer’s assessment or indicate in the foregoing sections any disagreement which may remain after discussing them with him/her. You should also indicate how frequently you have seen the work of the person being assessed. Add any further relevant comment including whether any aspect of the assessments in the report have been brought to the attention of the person being assessed.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">He/she has served under me from</label>
                                    <input
                                        type="date"
                                        value={page12.servedFrom}
                                        onChange={e => setPage12({ ...page12, servedFrom: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={page12.servedTo}
                                        onChange={e => setPage12({ ...page12, servedTo: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Disagreements or further relevant comments:</label>
                                <textarea
                                    rows={3}
                                    value={page12.countersignDisagreement}
                                    onChange={e => setPage12({ ...page12, countersignDisagreement: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Frequency of Observation</label>
                                    <select
                                        value={page12.observationFrequency}
                                        onChange={e => setPage12({ ...page12, observationFrequency: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
                                    >
                                        <option value="FREQUENTLY">Frequently</option>
                                        <option value="OCCASIONALLY">Occasionally</option>
                                        <option value="SELDOM">Seldom</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Assessment communicated to staff?</label>
                                    <select
                                        value={page12.assessmentCommunicatedToStaff}
                                        onChange={e => setPage12({ ...page12, assessmentCommunicatedToStaff: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
                                    >
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Countersigning Officer Name</label>
                                    <input
                                        type="text"
                                        value={page12.countersignName}
                                        onChange={e => setPage12({ ...page12, countersignName: e.target.value })}
                                        className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 bg-white outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Final Verification Tally Banner */}
                        <div className="border border-emerald-600 rounded-3xl p-6 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white space-y-4 shadow-md">
                            <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 size={18} />
                                APER Performance evaluation summary
                            </h4>
                            <p className="text-xs text-emerald-200">
                                This staff member moving CONTISS grade level suitability is computed based on raw APER scoring of <strong>{rawScore}/100</strong> marks.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Pagination Bar */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((currentPage - 1) as any)}
                    className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold transition border border-slate-300 flex items-center gap-1"
                >
                    <ChevronLeft size={16} />
                    <span>Previous Page</span>
                </button>

                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Page {currentPage} of 12
                </span>

                <button
                    disabled={currentPage === 12}
                    onClick={() => setCurrentPage((currentPage + 1) as any)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1"
                >
                    <span>Next Page</span>
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Slide-out Rubric Reference Helper Panel (Pages 13, 14, 15) */}
            {isRubricPanelOpen && (
                <div className="absolute inset-y-0 right-0 w-80 bg-slate-900 text-white border-l border-slate-800 shadow-2xl z-30 flex flex-col p-6 animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <BookOpen className="text-amber-400" size={18} />
                            <h3 className="font-black text-sm uppercase tracking-wider">Pages 13-15 Notes</h3>
                        </div>
                        <button
                            onClick={() => setIsRubricPanelOpen(false)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mb-4 shrink-0">
                        <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Select Aspect Rubric:</label>
                        <select
                            value={selectedAspectRubric}
                            onChange={e => setSelectedAspectRubric(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white outline-none"
                        >
                            {Object.entries(rubricDictionary).map(([key, value]) => (
                                <option key={key} value={key}>({key}) {value.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        <h4 className="font-extrabold text-xs text-amber-300 uppercase border-b border-slate-800 pb-1.5">
                            {rubricDictionary[selectedAspectRubric]?.title} Rubric
                        </h4>

                        <div className="space-y-3">
                            {rubricDictionary[selectedAspectRubric]?.rubrics.map(rub => (
                                <div key={rub.rating} className="bg-slate-800/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
                                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{rub.rating}</div>
                                    <div className="text-[11px] text-slate-300 font-medium leading-relaxed">{rub.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
