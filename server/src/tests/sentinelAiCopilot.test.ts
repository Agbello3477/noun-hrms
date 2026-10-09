import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestion.service';
import { AiToolsService } from '../services/ai/aiTools.service';
import { SecurityGuardService, SecurityScopeException } from '../services/ai/securityGuard.service';
import { AiCopilotService } from '../services/ai/aiCopilot.service';
import { AiPersonalityService } from '../services/ai/aiPersonality.service';
import { AiLearningEngineService } from '../services/ai/aiLearningEngine.service';
import { STATUTORY_KNOWLEDGE_CHUNKS } from '../constants/statutoryKnowledgeBase';
import { Role, Cadre } from '@prisma/client';

async function runSentinelAiTests() {
  console.log('🧪 =========================================================');
  console.log('🚀 RUNNING ENTERPRISE NOUN-SENTINEL AI TEST SUITE');
  console.log('🧪 =========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // =========================================================================
  // TEST SUITE 1: KNOWLEDGE INGESTION & STATUTORY RAG PIPELINE
  // =========================================================================
  console.log('📦 [1/5] Testing Knowledge Ingestion & Statutory RAG Pipeline...');

  // Test 1.1: Text Chunker (512 token sizing with 64 token overlap)
  const longSampleText = Array.from({ length: 700 }, (_, i) => `word${i}`).join(' ');
  const chunks = KnowledgeIngestionService.chunkText(longSampleText, 512, 64);
  assert(
    chunks.length >= 2,
    'Knowledge chunker splits long text into target token chunks with overlap',
    `Generated ${chunks.length} chunks`
  );

  // Test 1.2: RAG Query for Senior Staff Annual & Casual Leave
  const leaveRagResults = await KnowledgeIngestionService.queryKnowledgeBase({
    query: 'annual leave entitlement casual leave rules principal officers',
    sectionFilter: 'LEAVE',
    limit: 3
  });
  assert(
    leaveRagResults.length > 0 &&
    leaveRagResults.some(r => r.content.includes('42 working days') && r.content.includes('Section 5.1.1')),
    'RAG retrieves Senior Staff Annual Leave (Section 5.1.1) with 42 days for Principal Officers'
  );

  // Test 1.3: RAG Query for Statutory Retirement
  const retirementRagResults = await KnowledgeIngestionService.queryKnowledgeBase({
    query: 'statutory retirement age professorial 75 years 65 years',
    sectionFilter: 'EXIT',
    limit: 2
  });
  assert(
    retirementRagResults.some(r => r.content.includes('seventy-five (75) years of age') && r.content.includes('sixty-five (65) years')),
    'RAG retrieves Statutory Retirement benchmarks (Professorial 75 yrs vs 65 yrs or 35 yrs service)'
  );

  // Test 1.4: RAG Query for Disciplinary Mandatory 24-Hour Response
  const disciplineRagResults = await KnowledgeIngestionService.queryKnowledgeBase({
    query: 'disciplinary query response deadline three query rule SSDC',
    sectionFilter: 'DISCIPLINE',
    limit: 2
  });
  assert(
    disciplineRagResults.some(r => r.content.includes('twenty-four (24) hours') && r.content.includes('Section 8.2.1')),
    'RAG retrieves Disciplinary 24-Hour Mandatory Response & 3rd Query SSDC Referral rule'
  );

  // Test 1.5: Grounded Citations Generator
  const citationText = KnowledgeIngestionService.buildGroundedCitationText(leaveRagResults);
  assert(
    citationText.includes('Statutory Citations & Regulatory References') && citationText.includes('Section 5.1.1'),
    'Grounded Retrieval Guard formats explicit statutory citations'
  );

  // =========================================================================
  // TEST SUITE 2: RBAC-ANCHORED DETERMINISTIC FUNCTION CALLS
  // =========================================================================
  console.log('\n⚙️ [2/5] Testing RBAC-Anchored Deterministic Function Calls...');

  // Test 2.1: trackMyApplications()
  const mockStaffUser = { id: 'mock-user-001', role: Role.STAFF, name: 'Dr. Abdul Bello', rank: 'Senior Lecturer', cadre: Cadre.ACADEMIC };
  const appTrackResult = await AiToolsService.trackMyApplications(mockStaffUser);
  assert(
    appTrackResult.success === true && typeof appTrackResult.message === 'string',
    'trackMyApplications executes deterministically with session-anchored scope'
  );

  // Test 2.2: getMyLeaveBalance()
  const leaveBalanceResult = await AiToolsService.getMyLeaveBalance(mockStaffUser, 2026);
  assert(
    leaveBalanceResult.success === true &&
    leaveBalanceResult.leaveSummary !== null &&
    leaveBalanceResult.leaveSummary.entitledDays >= 14,
    'getMyLeaveBalance computes statutory leave entitlements and balances'
  );

  // Test 2.3: checkPromotionEligibility()
  const promoResult = await AiToolsService.checkPromotionEligibility(mockStaffUser);
  assert(
    promoResult.success === true &&
    promoResult.actionCard !== undefined &&
    promoResult.actionCard.type === 'PROMOTION_ELIGIBILITY',
    'checkPromotionEligibility evaluates waiting periods, APER benchmarks, and renders ActionCard'
  );

  // Test 2.4: searchSystemManual()
  const manualResult = await AiToolsService.searchSystemManual('File Requisition', 'How to lodge a file requisition');
  assert(
    manualResult.success === true &&
    manualResult.guide.content.includes('Requisition') &&
    manualResult.actionCard?.type === 'MANUAL_GUIDE',
    'searchSystemManual retrieves step-by-step UI operational procedures'
  );

  // Test 2.5: getDepartmentalWorkloadSummary() RBAC enforcement
  let workloadUnauthorized = false;
  try {
    await AiToolsService.getDepartmentalWorkloadSummary(mockStaffUser, 'DEPT_MATH');
  } catch (err: any) {
    if (err instanceof SecurityScopeException) {
      workloadUnauthorized = true;
    }
  }
  assert(
    workloadUnauthorized === true,
    'getDepartmentalWorkloadSummary rejects unauthorized non-manager roles with SecurityScopeException'
  );

  const mockHodUser = { id: 'mock-hod-001', role: Role.UNIT_HEAD, assignedUnitId: 'DEPT_MATH' };
  const workloadAuthorized = await AiToolsService.getDepartmentalWorkloadSummary(mockHodUser, 'DEPT_MATH');
  assert(
    workloadAuthorized.success === true &&
    workloadAuthorized.workloadSummary.allocations.length > 0 &&
    workloadAuthorized.actionCard?.type === 'WORKLOAD_BREAKDOWN',
    'getDepartmentalWorkloadSummary permits HODs and returns workload distributions & rebate metrics'
  );

  // =========================================================================
  // TEST SUITE 3: PERSONALIZED SALUTATIONS & CONCISE-BY-DEFAULT ENGINE
  // =========================================================================
  console.log('\n👤 [3/5] Testing Personalized Salutations & Specificity Formatting...');

  // Test 3.1: Academic Professor Salutation
  const profUser = { id: 'prof-01', role: Role.STAFF, name: 'Adebayo Johnson', rank: 'Professor of Computer Science' };
  const profSalutation = AiPersonalityService.resolveSalutation(profUser);
  assert(
    profSalutation.title === 'Prof.' && profSalutation.salutation.includes('Prof. Johnson'),
    'AiPersonalityService resolves academic rank to "Prof. [Surname]"'
  );

  // Test 3.2: Registrar Executive Salutation
  const registrarUser = { id: 'reg-01', role: Role.REGISTRAR, name: 'Grace Danladi', rank: 'University Registrar' };
  const regSalutation = AiPersonalityService.resolveSalutation(registrarUser);
  assert(
    regSalutation.title === 'Registrar' && regSalutation.salutation.includes('Registrar Danladi'),
    'AiPersonalityService resolves Executive Registrar to "Registrar [Surname]"'
  );

  // Test 3.3: Concise vs Detailed Request Detection
  assert(
    AiPersonalityService.isDetailedRequest('What is the casual leave policy?') === false,
    'Standard query is flagged as concise-by-default'
  );
  assert(
    AiPersonalityService.isDetailedRequest('Explain in detail step by step how promotion docket routing works') === true,
    'Query with "in detail step by step" is flagged as detailed-on-demand'
  );

  // Test 3.4: Out-of-the-Box Strategic Advisory
  const promoTip = AiPersonalityService.generateOutOfTheBoxAdvisory('PROMOTION_GAP', { pointsGap: 10, yearsGap: 1 });
  assert(
    promoTip !== undefined && promoTip.includes('Scopus') && promoTip.includes('Course Materials'),
    'AiPersonalityService generates proactive out-of-the-box strategic advice for promotion gap closing'
  );

  // =========================================================================
  // TEST SUITE 4: CONTINUOUS SELF-LEARNING & FEEDBACK MEMORY
  // =========================================================================
  console.log('\n🧠 [4/5] Testing Continuous Self-Learning Engine...');

  // Test 4.1: Retrieve Learned Insights
  const initialInsights = await AiLearningEngineService.getRelevantInsights('How do I defer leave carryover unused in december?');
  assert(
    initialInsights.length > 0 && initialInsights[0].topic === 'LEAVE_CARRYOVER',
    'AiLearningEngine retrieves learned institutional insights for leave carryover'
  );

  // Test 4.2: Record Correction Feedback & Auto-Adapt
  const feedbackResult = await AiLearningEngineService.recordFeedbackAndLearn({
    userId: 'user-hod-01',
    userRole: 'HOD',
    query: 'Casual leave without prior annual leave',
    copilotResponse: 'Casual leave can be granted immediately.',
    feedbackType: 'CORRECTION',
    userCorrection: 'Casual leave strictly requires annual leave to be exhausted per NOUN Section 5.2.1.',
    topic: 'CASUAL_LEAVE_PREREQUISITE'
  });
  assert(
    feedbackResult.success === true,
    'AiLearningEngine records user corrections into adaptive memory store'
  );

  // =========================================================================
  // TEST SUITE 5: COPILOT ORCHESTRATION & ACTION CARDS
  // =========================================================================
  console.log('\n🤖 [5/5] Testing Copilot Orchestration & Action Cards...');

  // Test 5.1: Track Application Intent Dispatch with Salutation
  const chatTrackRes = await AiCopilotService.processChat({
    user: mockStaffUser,
    prompt: 'Please track my pending application docket',
    clientIp: '192.168.1.50'
  });
  assert(
    chatTrackRes.toolsInvoked?.includes('trackMyApplications') &&
    chatTrackRes.message.includes('Dr.') &&
    chatTrackRes.actionCard?.type === 'APPLICATION_TRACKER',
    'AiCopilotService dispatches trackMyApplications, greets with "Dr.", and attaches ActionCard'
  );

  // Test 5.2: Grounded Statutory Policy Query
  const chatPolicyRes = await AiCopilotService.processChat({
    user: mockStaffUser,
    prompt: 'What are the rules regarding maternity leave and nursing mothers in NOUN?',
    clientIp: '192.168.1.50'
  });
  assert(
    chatPolicyRes.message.includes('sixteen (16) weeks') &&
    chatPolicyRes.message.includes('two (2) hours') &&
    chatPolicyRes.citations !== undefined,
    'AiCopilotService synthesizes grounded policy response with mandatory explicit citations'
  );

  // Test 5.3: Role-based Suggested Prompts
  const registrySuggestions = AiCopilotService.getRoleBasedSuggestions(Role.REGISTRY_ADMIN);
  const staffSuggestions = AiCopilotService.getRoleBasedSuggestions(Role.STAFF);
  assert(
    registrySuggestions.some(s => s.includes('promotion review')) &&
    staffSuggestions.some(s => s.includes('Track my pending application')),
    'AiCopilotService provides customized suggestion chips tailored by user role'
  );

  console.log('\n=========================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runSentinelAiTests().catch((err) => {
  console.error('🔥 Test Suite Exception:', err);
  process.exit(1);
});
