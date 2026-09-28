import {
    AcademicRank,
    HighestQualification,
    calculateAcademicPublicationScores,
    ACADEMIC_PROMOTION_RULES,
    getTargetAcademicRank
} from '../utils/academicPromotionRules';
import { PublicationType } from '@prisma/client';

export async function runAcademicPromotionTests() {
    console.log('🧪 Starting Institutional Academic Staff Promotion Criteria & Publication Scoring Tests...');
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, message: string) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    try {
        // --- Test 1: Assistant Lecturer with Master's and 8.0 Journal Points (Passes) ---
        console.log('\n--- Scenario 1: Assistant Lecturer -> Lecturer II ---');
        const asstRule = ACADEMIC_PROMOTION_RULES[AcademicRank.ASSISTANT_LECTURER];
        assert(asstRule.targetRank === AcademicRank.LECTURER_II, 'Target rank is Lecturer II');
        assert(asstRule.minPublicationPoints === 6.0, 'Requires minimum 6.0 publication points');
        assert(asstRule.minQualification === HighestQualification.MASTERS, "Requires Master's or Ph.D. Registration");

        const asstLecturerPubs = [
            {
                id: 'pub-1',
                title: 'Machine Learning in Distance Education',
                type: PublicationType.JOURNAL_ARTICLE,
                peerReviewed: true,
                pointsClaimed: 5.0,
                pointsAwarded: 5.0,
                verificationStatus: 'VERIFIED'
            },
            {
                id: 'pub-2',
                title: 'Pedagogical Patterns in Open Learning',
                type: PublicationType.CONFERENCE_PROCEEDING,
                peerReviewed: true,
                pointsClaimed: 3.0,
                pointsAwarded: 3.0,
                verificationStatus: 'VERIFIED'
            }
        ];

        const asstScore = calculateAcademicPublicationScores(asstLecturerPubs, AcademicRank.LECTURER_II, true);
        assert(asstScore.totalValidPoints === 8.0, `Accumulated 8.0 points (Actual: ${asstScore.totalValidPoints})`);
        assert(asstScore.pointsRequirementMet === true, 'Points requirement met (8.0 >= 6.0)');
        assert(asstScore.pointsDeficit === 0, 'No points deficit');

        // --- Test 2: Lecturer II using 4 Course Materials (Capped at exactly 2 units) ---
        console.log('\n--- Scenario 2: Lecturer II -> Lecturer I with Course Material Cap (Max 2 units) ---');
        const lec2Rule = ACADEMIC_PROMOTION_RULES[AcademicRank.LECTURER_II];
        assert(lec2Rule.targetRank === AcademicRank.LECTURER_I, 'Target rank is Lecturer I');
        assert(lec2Rule.minPublicationPoints === 12.0, 'Requires minimum 12.0 publication points');

        const lec2Pubs = [
            // 4 course materials (each worth 3.0 points = 12.0 potential points)
            { id: 'cm-1', title: 'Course Material 1: CMP101', type: PublicationType.COURSE_MATERIAL, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            { id: 'cm-2', title: 'Course Material 2: CMP102', type: PublicationType.COURSE_MATERIAL, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            { id: 'cm-3', title: 'Course Material 3: CMP103', type: PublicationType.COURSE_MATERIAL, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            { id: 'cm-4', title: 'Course Material 4: CMP104', type: PublicationType.COURSE_MATERIAL, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            // 1 journal article worth 5.0 points
            { id: 'ja-1', title: 'Journal Article on Distributed Systems', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' }
        ];

        const lec2Score = calculateAcademicPublicationScores(lec2Pubs, AcademicRank.LECTURER_I, true);
        assert(lec2Score.courseMaterialsCount === 2, `Course materials utilized is exactly 2 units (Actual: ${lec2Score.courseMaterialsCount})`);
        assert(lec2Score.courseMaterialsCapped === true, 'Engine flags course materials as capped');
        // Valid points = 2 x 3.0 (from CM) + 5.0 (from Journal) = 11.0 points
        assert(lec2Score.totalValidPoints === 11.0, `Total valid points capped at 11.0 (Actual: ${lec2Score.totalValidPoints})`);
        assert(lec2Score.pointsRequirementMet === false, 'Points requirement NOT met (11.0 < 12.0)');
        assert(lec2Score.pointsDeficit === 1.0, `Deficit is exactly 1.0 point (Actual: ${lec2Score.pointsDeficit})`);

        // Adding 1 more conference paper (3.0 pts) makes total = 14.0 -> Passes
        const lec2PubsWithConf = [
            ...lec2Pubs,
            { id: 'cp-1', title: 'Cloud Computing Conference Proceeding', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' }
        ];
        const lec2ScorePass = calculateAcademicPublicationScores(lec2PubsWithConf, AcademicRank.LECTURER_I, true);
        assert(lec2ScorePass.totalValidPoints === 14.0, `Total valid points becomes 14.0 (Actual: ${lec2ScorePass.totalValidPoints})`);
        assert(lec2ScorePass.pointsRequirementMet === true, 'Points requirement now met (14.0 >= 12.0)');

        // --- Test 3: Lecturer I -> Senior Lecturer with 28 Points but only Master's Degree (Ph.D. Mandatory) ---
        console.log('\n--- Scenario 3: Lecturer I -> Senior Lecturer (Ph.D. Mandatory Gate) ---');
        const lec1Rule = ACADEMIC_PROMOTION_RULES[AcademicRank.LECTURER_I];
        assert(lec1Rule.targetRank === AcademicRank.SENIOR_LECTURER, 'Target rank is Senior Lecturer');
        assert(lec1Rule.minPublicationPoints === 24.0, 'Requires minimum 24.0 publication points');
        assert(lec1Rule.minQualification === HighestQualification.PHD, 'Ph.D. is mandatory for Senior Lecturer');
        assert(lec1Rule.allowBachelorsWithPhdRegistration === false, 'Ph.D. registration alone is NOT sufficient for Senior Lecturer');

        // Course materials are excluded for Senior Lecturer
        const lec1Pubs = [
            { id: 'j-1', title: 'Journal 1', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 10.0, pointsAwarded: 10.0, verificationStatus: 'VERIFIED' },
            { id: 'j-2', title: 'Journal 2', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 10.0, pointsAwarded: 10.0, verificationStatus: 'VERIFIED' },
            { id: 'c-1', title: 'Conference 1', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 4.0, pointsAwarded: 4.0, verificationStatus: 'VERIFIED' },
            { id: 'c-2', title: 'Conference 2', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 4.0, pointsAwarded: 4.0, verificationStatus: 'VERIFIED' },
            { id: 'cm-exclude', title: 'Course Material', type: PublicationType.COURSE_MATERIAL, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' }
        ];

        const lec1Score = calculateAcademicPublicationScores(lec1Pubs, AcademicRank.SENIOR_LECTURER, true);
        assert(lec1Score.totalValidPoints === 28.0, `Valid points is 28.0 (excluding course material) (Actual: ${lec1Score.totalValidPoints})`);
        assert(lec1Score.pointsRequirementMet === true, 'Points threshold satisfied (28.0 >= 24.0)');

        // Educational Qualification evaluation check:
        const candidateQualification = HighestQualification.MASTERS;
        const qualificationPassed = candidateQualification === lec1Rule.minQualification;
        assert(qualificationPassed === false, "Master's candidate FAILS Qualification Gate for Senior Lecturer");

        // --- Test 4: Associate Professor -> Professor (Cumulative 66.0 Points across Books, Proceedings, Journals) ---
        console.log('\n--- Scenario 4: Associate Professor -> Full Professor (Cumulative 66.0 Points & Governance Gate) ---');
        const assocRule = ACADEMIC_PROMOTION_RULES[AcademicRank.ASSOCIATE_PROFESSOR];
        assert(assocRule.targetRank === AcademicRank.PROFESSOR, 'Target rank is Full Professor');
        assert(assocRule.minPublicationPoints === 66.0, 'Requires cumulative minimum 66.0 publication points');
        assert(assocRule.minQualification === HighestQualification.PHD, 'Ph.D. mandatory');
        assert(assocRule.requiresExternalAssessment === true, 'External assessor clearance required before Council ratification');

        const profPubs = [
            // 2 Books @ 10.0 each = 20.0
            { id: 'b-1', title: 'Foundations of Modern Distributed Architectures', type: PublicationType.ACADEMIC_BOOK, peerReviewed: true, pointsClaimed: 10.0, pointsAwarded: 10.0, verificationStatus: 'VERIFIED' },
            { id: 'b-2', title: 'Advanced Cloud Operating Systems', type: PublicationType.ACADEMIC_BOOK, peerReviewed: true, pointsClaimed: 10.0, pointsAwarded: 10.0, verificationStatus: 'VERIFIED' },
            // 2 Book Chapters @ 4.0 each = 8.0
            { id: 'bc-1', title: 'Chapter 4: Microservice Fault Tolerance', type: PublicationType.BOOK_CHAPTER, peerReviewed: true, pointsClaimed: 4.0, pointsAwarded: 4.0, verificationStatus: 'VERIFIED' },
            { id: 'bc-2', title: 'Chapter 8: Vector Clocks in Real-Time', type: PublicationType.BOOK_CHAPTER, peerReviewed: true, pointsClaimed: 4.0, pointsAwarded: 4.0, verificationStatus: 'VERIFIED' },
            // 6 Journal Articles @ 5.0 each = 30.0
            { id: 'j-1', title: 'Journal Alpha', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            { id: 'j-2', title: 'Journal Beta', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            { id: 'j-3', title: 'Journal Gamma', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            { id: 'j-4', title: 'Journal Delta', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            { id: 'j-5', title: 'Journal Epsilon', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            { id: 'j-6', title: 'Journal Zeta', type: PublicationType.JOURNAL_ARTICLE, peerReviewed: true, pointsClaimed: 5.0, pointsAwarded: 5.0, verificationStatus: 'VERIFIED' },
            // 3 Conference Proceedings @ 3.0 each = 9.0
            { id: 'cp-1', title: 'IEEE Conference Paper 1', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            { id: 'cp-2', title: 'ACM Conference Paper 2', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' },
            { id: 'cp-3', title: 'Springer Conference Paper 3', type: PublicationType.CONFERENCE_PROCEEDING, peerReviewed: true, pointsClaimed: 3.0, pointsAwarded: 3.0, verificationStatus: 'VERIFIED' }
        ];

        // Total = 20 + 8 + 30 + 9 = 67.0 Points
        const profScore = calculateAcademicPublicationScores(profPubs, AcademicRank.PROFESSOR, true);
        assert(profScore.totalValidPoints === 67.0, `Accumulated 67.0 points across categories (Actual: ${profScore.totalValidPoints})`);
        assert(profScore.pointsRequirementMet === true, 'Cumulative threshold met (67.0 >= 66.0)');
        assert(profScore.categoryTotals[PublicationType.ACADEMIC_BOOK] === 20.0, '20.0 points from Academic Books');
        assert(profScore.categoryTotals[PublicationType.JOURNAL_ARTICLE] === 30.0, '30.0 points from Journal Articles');
        assert(profScore.categoryTotals[PublicationType.CONFERENCE_PROCEEDING] === 9.0, '9.0 points from Conferences');
        assert(profScore.categoryTotals[PublicationType.BOOK_CHAPTER] === 8.0, '8.0 points from Book Chapters');

        console.log(`\n========================================`);
        console.log(`🏆 Academic Promotion Engine Test Results: ${passed} Passed, ${failed} Failed`);
        console.log(`========================================\n`);

        if (failed > 0) {
            throw new Error(`${failed} test(s) failed in Academic Promotion suite.`);
        }
    } catch (err) {
        console.error('Test execution error:', err);
        throw err;
    }
}

if (require.main === module) {
    runAcademicPromotionTests()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
