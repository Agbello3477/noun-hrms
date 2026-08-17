import { createMcpServer } from '../server';
import { toolsRegistry } from '../tools/declarations';
import { authorizeToolAccess } from '../auth';
import { config } from '../config';

const runTests = async () => {
  console.log('🧪 Starting Standalone MCP Server Gateway Integration Tests...');
  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failedCount++;
    }
  };

  try {
    // 1. Verify Server Instantiation
    const server = createMcpServer();
    assert(server !== null && server !== undefined, 'MCP Gateway Server initialized successfully');

    // 2. Verify Tool Declarations Registry
    assert(toolsRegistry['get_staff_promotion_eligibility'] !== undefined, 'Tool get_staff_promotion_eligibility is registered');
    assert(toolsRegistry['get_security_threat_summary'] !== undefined, 'Tool get_security_threat_summary is registered');
    assert(toolsRegistry['get_research_grant_metrics'] !== undefined, 'Tool get_research_grant_metrics is registered');
    assert(toolsRegistry['get_staff_dossier'] !== undefined, 'Tool get_staff_dossier is registered');
    assert(toolsRegistry['get_payroll_summary_metrics'] !== undefined, 'Tool get_payroll_summary_metrics is registered');
    assert(toolsRegistry['get_active_leave_balances'] !== undefined, 'Tool get_active_leave_balances is registered');
    assert(toolsRegistry['update_staff_status'] !== undefined, 'Tool update_staff_status is registered');

    // 3. Verify JSON Schema Validation formatting
    const promoTool = toolsRegistry['get_staff_promotion_eligibility'];
    assert(promoTool.inputSchema.type === 'object', 'get_staff_promotion_eligibility inputSchema type is object');
    assert(promoTool.inputSchema.properties.page !== undefined, 'get_staff_promotion_eligibility has page property');

    // 4. Test RBAC Proxying Authorization Checks
    const authorizedCheck = authorizeToolAccess('get_security_threat_summary', 'SECURITY_HEAD', ['SECURITY_HEAD', 'ADMIN']);
    assert(authorizedCheck.authorized === true, 'SECURITY_HEAD authorized for get_security_threat_summary');

    const unauthorizedCheck = authorizeToolAccess('get_security_threat_summary', 'STUDENT', ['SECURITY_HEAD', 'ADMIN']);
    assert(unauthorizedCheck.authorized === false, 'STUDENT correctly rejected for get_security_threat_summary');
    assert(unauthorizedCheck.reason?.includes('RBAC Authorization Failure') === true, 'RBAC rejection message formatted cleanly');

    // 5. Test Read-Only Mode State Guard Enforcement
    config.readOnlyMode = true;
    const writeTool = toolsRegistry['update_staff_status'];
    const writeResult = await writeTool.execute({ staffId: 'test-id', status: 'ON_LEAVE' });
    assert(writeResult.error === true, 'Write tool returns error in MCP_READ_ONLY_MODE=true');
    assert(writeResult.code === 'READ_ONLY_MODE_BLOCKED', 'Error code is READ_ONLY_MODE_BLOCKED');
    assert(writeResult.message.includes('MCP_READ_ONLY_MODE is enabled'), 'Blocked message states read-only mode enforcement');

    // 6. Test Read-Only Query Tool Execution (Mock / Offline Resilient Mode)
    console.log('🔄 Executing get_staff_promotion_eligibility query tool execution...');
    const promoResult = await promoTool.execute({ page: 1, limit: 10 });
    assert(promoResult !== undefined, 'get_staff_promotion_eligibility executed without unhandled exceptions');

    console.log('🔄 Executing get_security_threat_summary query tool execution...');
    const secTool = toolsRegistry['get_security_threat_summary'];
    const secResult = await secTool.execute({ limit: 5 });
    assert(secResult !== undefined, 'get_security_threat_summary executed without unhandled exceptions');

    console.log('🔄 Executing get_research_grant_metrics query tool execution...');
    const grantTool = toolsRegistry['get_research_grant_metrics'];
    const grantResult = await grantTool.execute({ status: 'ACTIVE' });
    assert(grantResult !== undefined, 'get_research_grant_metrics executed without unhandled exceptions');

    console.log('🔄 Executing get_staff_dossier query tool execution...');
    const dossierTool = toolsRegistry['get_staff_dossier'];
    const dossierResult = await dossierTool.execute({ staffId: 'test-staff-id' });
    assert(dossierResult !== undefined, 'get_staff_dossier executed without unhandled exceptions');

    console.log('🔄 Executing get_payroll_summary_metrics query tool execution...');
    const payrollTool = toolsRegistry['get_payroll_summary_metrics'];
    const payrollResult = await payrollTool.execute({ month: 8, year: 2026 });
    assert(payrollResult !== undefined, 'get_payroll_summary_metrics executed without unhandled exceptions');

    console.log('🔄 Executing get_active_leave_balances query tool execution...');
    const leaveTool = toolsRegistry['get_active_leave_balances'];
    const leaveResult = await leaveTool.execute({ status: 'APPROVED' });
    assert(leaveResult !== undefined, 'get_active_leave_balances executed without unhandled exceptions');

    // 7. Memory Leak & Heavy Iteration Stability Check
    console.log('🔄 Running 100 fast iterations to check memory stability...');
    const startMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100; i++) {
      await promoTool.execute({ page: 1, limit: 5 });
    }
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDiffMb = (endMemory - startMemory) / (1024 * 1024);
    assert(memoryDiffMb < 50, `Memory heap diff after 100 iterations is under 50MB (${memoryDiffMb.toFixed(2)}MB)`);

  } catch (error: any) {
    console.error('❌ Unhandled Exception during MCP integration tests:', error);
    failedCount++;
  }

  console.log(`\n🎉 MCP Server Integration Tests Complete: ${passedCount} passed, ${failedCount} failed.`);
  if (failedCount > 0) {
    process.exit(1);
  }
};

runTests();
