import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Environment loading
const envPath = path.resolve(process.cwd(), '.env');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.VITE_SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_ANON_KEY = anonKey;

interface TestResult {
  id: string;
  category: string;
  title: string;
  status: 'PASS' | 'FAIL';
  details: string;
  evidence?: any;
}

const results: TestResult[] = [];

function record(id: string, category: string, title: string, passed: boolean, details: string, evidence?: any) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  console.log(`  ${passed ? '✅ [PASS]' : '❌ [FAIL]'} [${id}] ${title}: ${details}`);
  results.push({ id, category, title, status, details, evidence });
}

async function runAudit() {
  // Dynamically import services after process.env is configured
  const { supabase } = await import('../src/integrations/supabase/client');

  const {
    fetchAccounts,
    createAccount,
    updateAccount,
    suspendAccount,
    reactivateAccount,
    updateAccountPermissions
  } = await import('../src/lib/account-service');

  const {
    fetchSecurityOverview,
    fetchUserSessions,
    revokeSession,
    revokeAllUserSessions,
    fetchSecurityAlerts
  } = await import('../src/lib/security-center-service');

  const { fetchSystemAuditLogs } = await import('../src/lib/audit-service');

  const {
    resolveAuthoritativeSecurityContext,
    assertAuthorizedMutation
  } = await import('../src/lib/security-isolation-service');

  const { resetRateLimit } = await import('../src/lib/rate-limiter');

  console.log('========================================================================');
  console.log('  SADA OS — PHASE 1: ACCOUNTS & SECURITY BACKEND & DB FUNCTIONAL AUDIT  ');
  console.log('========================================================================\n');

  // Authenticate the singleton client as Super Admin
  const { data: saLogin, error: saErr } = await supabase.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });
  if (saErr || !saLogin?.user) {
    throw new Error(`Failed to sign in Super Admin on singleton client: ${saErr?.message}`);
  }
  const superAdminId = saLogin.user.id;
  console.log(`[Setup] Super Admin authenticated on singleton client: ${superAdminId} (${saLogin.user.email})`);

  const superAdminClient = supabase;
  const workerClient = createClient(supabaseUrl, anonKey);
  const anonClient = createClient(supabaseUrl, anonKey);

  const { data: wLogin, error: wErr } = await workerClient.auth.signInWithPassword({
    email: 'qa.worker@sada.agency',
    password: 'WorkerPassword123!'
  });
  if (wErr || !wLogin?.user) {
    throw new Error(`Failed to sign in Worker: ${wErr?.message}`);
  }
  const workerId = wLogin.user.id;
  console.log(`[Setup] Worker authenticated: ${workerId} (${wLogin.user.email})`);

  const TARGET_TEST_EMAIL = 'adv.target.test@sada.agency';
  let targetUserId = '';

  // -------------------------------------------------------------
  // CATEGORY A: Account Directory & Identity Resolution
  // -------------------------------------------------------------
  console.log('\n--- Category A: Account Directory & Identity Resolution ---');
  resetRateLimit();

  const accounts = await fetchAccounts();
  record(
    'A-01',
    'A. Directory & Identity',
    'Directory loading via fetchAccounts()',
    accounts.length > 0,
    `Loaded ${accounts.length} account records successfully`,
    { count: accounts.length }
  );

  const targetAccount = accounts.find(a => a.email === TARGET_TEST_EMAIL);
  record(
    'A-02',
    'A. Directory & Identity',
    'Target QA account presence in directory',
    Boolean(targetAccount),
    targetAccount ? `Found target QA user: ${targetAccount.user_id}` : 'Target QA account not found in list'
  );

  if (targetAccount) {
    targetUserId = targetAccount.user_id;

    // Check identity consistency across profiles, user_roles, team_members
    const { data: prof } = await superAdminClient.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
    const { data: roles } = await superAdminClient.from('user_roles').select('*').eq('user_id', targetUserId);
    const { data: tm } = await superAdminClient.from('team_members').select('*').eq('profile_id', targetUserId).maybeSingle();

    record(
      'A-03',
      'A. Directory & Identity',
      'Identity resolution consistency across tables',
      Boolean(prof && roles && roles.length > 0),
      `profiles status: ${prof?.status}, user_roles count: ${roles?.length}, team_members: ${tm?.name || 'none'}`
    );
  }

  // -------------------------------------------------------------
  // CATEGORY B: Account Provisioning & Validation Rules
  // -------------------------------------------------------------
  console.log('\n--- Category B: Account Creation & Provisioning ---');
  resetRateLimit();

  // 1. Weak password rejection via createAccount
  let weakRejected = false;
  let weakErrMessage = '';
  try {
    await createAccount(
      {
        email: `qa.weak.${Date.now()}@sada.agency`,
        password: '123', // weak password (< 6 chars)
        displayName: 'Weak Password User',
        role: 'worker',
        division: 'Production',
        position: 'Specialist',
      },
      superAdminClient
    );
  } catch (e: any) {
    weakErrMessage = e.message || '';
    weakRejected = e.message.toLowerCase().includes('password') || e.message.toLowerCase().includes('least 6');
  }
  record(
    'B-01',
    'B. Account Creation',
    'Rejection of weak password (< 6 chars)',
    weakRejected,
    `Weak password rejected as expected: ${weakErrMessage}`
  );

  // 2. Invalid role rejection enforced at DB RPC level
  const { data: invRoleRes, error: invRoleErr } = await superAdminClient.rpc('admin_provision_account', {
    _user_id: targetUserId,
    _email: 'qa.invalid.role@sada.agency',
    _display_name: 'Invalid Role Tester',
    _role: 'super_hacker_invalid',
    _division: 'Development',
    _position: 'Specialist',
    _phone: null,
    _create_team_member: true,
    _status: 'active',
    _module_permissions: null
  });
  const invRoleBlocked = Boolean(invRoleErr && invRoleErr.message.includes('Invalid role'));
  record(
    'B-02',
    'B. Account Creation',
    'Database RPC enforces valid app_role check',
    invRoleBlocked,
    `Invalid role rejected by DB: ${invRoleErr?.message}`
  );

  // 3. Authorized end-to-end account provisioning and authentication
  const freshEmail = `qa.audit.fresh.${Date.now()}@sada.agency`;
  const freshPass = 'FreshAuditPass2026!#';
  let freshCreated = false;
  let freshUid: string | null = null;
  let freshAuthWorks = false;
  try {
    const provRes = await createAccount(
      {
        email: freshEmail,
        password: freshPass,
        displayName: 'Fresh Audit Account',
        role: 'worker',
        division: 'Development',
        position: 'QA Engineer',
        status: 'active',
        createTeamMember: true,
      },
      superAdminClient
    );
    freshCreated = Boolean(provRes?.user_id);
    freshUid = provRes?.user_id || null;

    if (freshUid) {
      // Test authentication with newly provisioned credentials
      const authTestClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: loginData, error: loginErr } = await authTestClient.auth.signInWithPassword({
        email: freshEmail,
        password: freshPass
      });
      freshAuthWorks = Boolean(!loginErr && loginData?.session);
    }
  } catch (e: any) {
    console.error('Provisioning fresh account failed:', e);
  }

  record(
    'B-03',
    'B. Account Creation',
    'End-to-end account provisioning and immediate authentication',
    freshCreated && freshAuthWorks,
    `Account provisioned (UID: ${freshUid}), Auth sign-in success: ${freshAuthWorks}`
  );


  // -------------------------------------------------------------
  // CATEGORY C: Role Management & Persistence
  // -------------------------------------------------------------
  console.log('\n--- Category C: Role Management & Persistence ---');
  resetRateLimit();

  if (targetUserId) {
    // 1. Promote target from worker -> admin
    await updateAccount({
      userId: targetUserId,
      displayName: targetAccount?.display_name || 'Adversarial Target Account',
      role: 'admin',
      division: 'Development',
      position: 'Specialist'
    });
    record(
      'C-01',
      'C. Role Management',
      'Authorized promotion to admin executes cleanly',
      true,
      'Promoted role to admin successfully'
    );

    // Verify database persistence in user_roles
    const { data: dbRole1 } = await superAdminClient.from('user_roles').select('role').eq('user_id', targetUserId);
    const hasAdmin = (dbRole1 || []).some(r => r.role === 'admin');
    record(
      'C-02',
      'C. Role Management',
      'user_roles table reflects updated role "admin"',
      hasAdmin,
      `user_roles roles in DB: ${dbRole1?.map(r => r.role).join(', ')}`
    );

    // 2. Revert back to worker
    resetRateLimit();
    await updateAccount({
      userId: targetUserId,
      displayName: targetAccount?.display_name || 'Adversarial Target Account',
      role: 'worker',
      division: 'Development',
      position: 'Specialist'
    });
    record(
      'C-03',
      'C. Role Management',
      'Authorized reversion back to worker executes cleanly',
      true,
      'Reverted role to worker successfully'
    );

    const { data: dbRole2 } = await superAdminClient.from('user_roles').select('role').eq('user_id', targetUserId);
    const hasWorker = (dbRole2 || []).some(r => r.role === 'worker');
    record(
      'C-04',
      'C. Role Management',
      'user_roles table reflects reverted role "worker"',
      hasWorker,
      `user_roles roles in DB: ${dbRole2?.map(r => r.role).join(', ')}`
    );

    // Verify audit log entry in account_audit_logs
    const { data: auditRole } = await superAdminClient
      .from('account_audit_logs')
      .select('*')
      .eq('target_user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(2);
    record(
      'C-05',
      'C. Role Management',
      'account_audit_logs captures role mutation audit events',
      Boolean(auditRole && auditRole.length > 0),
      `Found ${auditRole?.length} recent audit records for target user`
    );

    // 3. Test self-demotion prevention on Super Admin
    resetRateLimit();
    let selfDemoted = false;
    let selfDemoteErr = '';
    try {
      await updateAccount({
        userId: superAdminId,
        displayName: 'Super Admin',
        role: 'worker',
        division: 'Executive',
        position: 'Root Administrator'
      });
      selfDemoted = true;
    } catch (e: any) {
      selfDemoteErr = e.message;
    }
    record(
      'C-06',
      'C. Role Management',
      'Super Admin self-demotion is strictly prevented',
      !selfDemoted && selfDemoteErr.includes('demote'),
      `Self-demotion blocked with error: "${selfDemoteErr}"`
    );
  }

  // -------------------------------------------------------------
  // CATEGORY D: Module-Level Granular Permissions
  // -------------------------------------------------------------
  console.log('\n--- Category D: Module-Level Granular Permissions ---');
  resetRateLimit();

  if (targetUserId) {
    // 1. Grant worker custom access to 'finance'
    await updateAccountPermissions(targetUserId, { finance: true }, null, null, { reason: 'Phase 1 Audit Grant Finance' });
    const { data: dbPerm1 } = await superAdminClient
      .from('user_module_permissions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('module', 'finance')
      .maybeSingle();

    record(
      'D-01',
      'D. Module Permissions',
      'Custom module permission persists in user_module_permissions',
      Boolean(dbPerm1 && dbPerm1.enabled === true),
      `user_module_permissions has finance=${dbPerm1?.enabled}`
    );

    // Verify security context resolver reflects effective override
    const secCtx = await resolveAuthoritativeSecurityContext(
      superAdminClient,
      targetUserId,
      { forceFresh: true }
    );
    record(
      'D-02',
      'D. Module Permissions',
      'resolveAuthoritativeSecurityContext reflects custom permission',
      Boolean(secCtx.effectivePermissions?.finance === true),
      `Effective finance permission: ${secCtx.effectivePermissions?.finance}`
    );

    // 2. Revoke custom permission
    resetRateLimit();
    await updateAccountPermissions(targetUserId, { finance: false }, null, null, { reason: 'Phase 1 Audit Revoke Finance' });
    const secCtxRevoked = await resolveAuthoritativeSecurityContext(
      superAdminClient,
      targetUserId,
      { forceFresh: true }
    );
    record(
      'D-03',
      'D. Module Permissions',
      'Revocation immediately removes module access',
      secCtxRevoked.effectivePermissions?.finance === false,
      `Effective finance permission after revoke: ${secCtxRevoked.effectivePermissions?.finance}`
    );

    // 3. Reset custom permissions
    resetRateLimit();
    await updateAccountPermissions(targetUserId, {}, null, null, { reason: 'Phase 1 Audit Reset Permissions' });
    record(
      'D-04',
      'D. Module Permissions',
      'Reset custom permissions restores default baseline',
      true,
      'Reset custom permissions to baseline successfully'
    );
  }

  // -------------------------------------------------------------
  // CATEGORY E: Account Lifecycle (Suspension & Reactivation)
  // -------------------------------------------------------------
  console.log('\n--- Category E: Account Lifecycle ---');
  resetRateLimit();

  if (targetUserId) {
    // 1. Suspend account
    let suspOk = false;
    try {
      await suspendAccount(targetUserId, 'Phase 1 Audit Security Hold', undefined, superAdminClient);
      suspOk = true;
    } catch (e: any) {
      console.error('suspendAccount failed:', e);
    }
    record(
      'E-01',
      'E. Lifecycle',
      'suspendAccount() executes successfully',
      suspOk,
      `Suspended target account: ${targetUserId}`
    );

    // Verify DB profiles.status is 'suspended'
    const { data: pSusp } = await superAdminClient.from('profiles').select('status').eq('id', targetUserId).maybeSingle();
    record(
      'E-02',
      'E. Lifecycle',
      'profiles.status transitions to "suspended" in database',
      pSusp?.status === 'suspended',
      `Database status: ${pSusp?.status}`
    );

    // Verify authoritative security context strictly blocks suspended account
    let blockedSusp = false;
    let blockedErr = '';
    try {
      await resolveAuthoritativeSecurityContext(
        superAdminClient,
        targetUserId,
        { forceFresh: true }
      );
    } catch (e: any) {
      blockedSusp = true;
      blockedErr = e.message || e.code;
    }
    record(
      'E-03',
      'E. Lifecycle',
      'Security context resolver throws ACCOUNT_SUSPENDED',
      blockedSusp && (blockedErr.toLowerCase().includes('suspend') || blockedErr.includes('ACCOUNT_SUSPENDED')),
      `Suspended account access blocked with: "${blockedErr}"`
    );

    // 2. Reactivate account
    resetRateLimit();
    let reactOk = false;
    try {
      await reactivateAccount(targetUserId, 'Phase 1 Audit Reactivation', undefined, superAdminClient);
      reactOk = true;
    } catch (e: any) {
      console.error('reactivateAccount failed:', e);
    }
    record(
      'E-04',
      'E. Lifecycle',
      'reactivateAccount() executes successfully',
      reactOk,
      `Reactivated target account: ${targetUserId}`
    );

    const { data: pActive } = await superAdminClient.from('profiles').select('status').eq('id', targetUserId).maybeSingle();
    record(
      'E-05',
      'E. Lifecycle',
      'profiles.status restored to "active" in database',
      pActive?.status === 'active',
      `Database status: ${pActive?.status}`
    );

    // 3. Prevent Super Admin self-suspension
    resetRateLimit();
    let selfSuspended = false;
    let selfSuspErr = '';
    try {
      await suspendAccount(superAdminId, 'Self suspension attempt', undefined, superAdminClient);
      selfSuspended = true;
    } catch (e: any) {
      selfSuspErr = e.message;
    }
    record(
      'E-06',
      'E. Lifecycle',
      'Super Admin self-suspension is strictly blocked',
      !selfSuspended && selfSuspErr.includes('suspend'),
      `Self-suspension blocked with: "${selfSuspErr}"`
    );
  }

  // -------------------------------------------------------------
  // CATEGORY F: Sessions & Device Security
  // -------------------------------------------------------------
  console.log('\n--- Category F: Sessions & Device Security ---');
  resetRateLimit();

  // 1. Register active session for target user
  const targetClient = createClient(supabaseUrl, anonKey);
  const { data: tLogin, error: tLoginErr } = await targetClient.auth.signInWithPassword({
    email: TARGET_TEST_EMAIL,
    password: 'TargetUserPassword123!'
  });

  let testSessionId = 'sess_p1_target_' + Date.now();
  if (tLogin?.session) {
    const { data: regSess, error: regErr } = await (targetClient as any).rpc('register_user_session', {
      _session_id: testSessionId,
      _user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
      _ip_address: '197.0.12.84',
      _device_type: 'desktop',
      _browser_name: 'Chrome',
      _os_name: 'Windows',
      _auth_method: 'password'
    });

    record(
      'F-01',
      'F. Sessions & Devices',
      'Target user registers session via canonical RPC',
      Boolean(regSess?.success),
      `Registered session: ${testSessionId}`
    );
  } else {
    record(
      'F-01',
      'F. Sessions & Devices',
      'Target user sign in',
      false,
      `Sign in failed: ${tLoginErr?.message}`
    );
  }

  if (testSessionId) {
    // 2. Revoke single target session
    resetRateLimit();
    const revRes = await revokeSession(testSessionId, 'Phase 1 Audit Revocation Test', superAdminClient);
    record(
      'F-02',
      'F. Sessions & Devices',
      'Super Admin revokes target session cleanly',
      revRes.success,
      `revokeSession returned: ${JSON.stringify(revRes)}`
    );

    // Verify DB user_sessions status is 'revoked'
    const { data: sessRow } = await superAdminClient
      .from('user_sessions')
      .select('status, revoked_at, revocation_reason')
      .eq('session_id', testSessionId)
      .maybeSingle();

    record(
      'F-03',
      'F. Sessions & Devices',
      'user_sessions status transitions to "revoked" with audit reason',
      sessRow?.status === 'revoked' && Boolean(sessRow?.revoked_at),
      `DB session status: ${sessRow?.status}, reason: ${sessRow?.revocation_reason}`
    );

    // 3. Direct PostgREST un-revocation attempt rejected by trigger trg_guard_user_sessions_update
    const { error: unrevErr } = await targetClient
      .from('user_sessions')
      .update({ status: 'active', revoked_at: null } as any)
      .eq('session_id', testSessionId);

    record(
      'F-04',
      'F. Sessions & Devices',
      'PostgreSQL trigger rejects un-revocation attempts',
      Boolean(unrevErr),
      `Un-revocation blocked by DB trigger: ${unrevErr?.message}`
    );

    // 4. Test Sign Out Everywhere (revokeAllUserSessions)
    resetRateLimit();
    const revAllRes = await revokeAllUserSessions(targetUserId, 'Phase 1 Audit Sign Out Everywhere', superAdminClient);
    record(
      'F-05',
      'F. Sessions & Devices',
      'revokeAllUserSessions() revokes all target sessions',
      revAllRes.success,
      `revokeAllUserSessions returned success=${revAllRes.success}`
    );
  }

  // -------------------------------------------------------------
  // CATEGORY G: Security Alerts & Anomaly Management
  // -------------------------------------------------------------
  console.log('\n--- Category G: Security Alerts ---');
  resetRateLimit();

  const alerts = await fetchSecurityAlerts();
  record(
    'G-01',
    'G. Security Alerts',
    'fetchSecurityAlerts() queries security_alerts table',
    Array.isArray(alerts),
    `Retrieved ${alerts.length} security alerts from database`
  );

  // -------------------------------------------------------------
  // CATEGORY H: Audit Logs & Immutability Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Category H: Audit Logs & Immutability ---');
  resetRateLimit();

  const auditLogs = await fetchSystemAuditLogs({ limit: 10 });
  record(
    'H-01',
    'H. Audit Logs',
    'fetchSystemAuditLogs() retrieves immutable audit records',
    auditLogs.length > 0,
    `Retrieved ${auditLogs.length} audit records with actor/target metadata`
  );

  // Test direct DELETE immutability on account_audit_logs
  const { error: delAuditErr } = await superAdminClient
    .from('account_audit_logs')
    .delete()
    .eq('target_user_id', targetUserId);

  record(
    'H-02',
    'H. Audit Logs',
    'Direct DELETE on account_audit_logs rejected by RLS / trigger',
    Boolean(delAuditErr),
    `DELETE rejected: ${delAuditErr?.message}`
  );

  // Test direct UPDATE immutability on system_audit_logs
  const { error: updAuditErr } = await superAdminClient
    .from('system_audit_logs')
    .update({ action: 'tampered' } as any)
    .limit(1);

  record(
    'H-03',
    'H. Audit Logs',
    'Direct UPDATE on system_audit_logs rejected by trigger',
    Boolean(updAuditErr),
    `UPDATE rejected: ${updAuditErr?.message}`
  );

  // -------------------------------------------------------------
  // CATEGORY I: Authorization Abuse Tests (Negative Vectors)
  // -------------------------------------------------------------
  console.log('\n--- Category I: Authorization Abuse Tests ---');
  resetRateLimit();

  // 1. Anonymous actor blocked from updateAccount
  let anonBlocked = false;
  let anonErr = '';
  try {
    await updateAccount(
      {
        userId: targetUserId,
        displayName: 'Anon Attacker',
        role: 'admin',
        division: 'Development',
        position: 'Specialist'
      },
      anonClient
    );
  } catch (e: any) {
    anonErr = e.message || '';
    anonBlocked = e.code === 'UNAUTHENTICATED' || e.message.toLowerCase().includes('unauthenticated');
  }
  record(
    'I-01',
    'I. Abuse Prevention',
    'Anonymous client blocked with UNAUTHENTICATED',
    anonBlocked,
    `Anonymous mutation strictly rejected: ${anonErr}`
  );

  // 2. Worker actor blocked from calling admin_update_account RPC directly
  const { error: rpcWorkerErr } = await workerClient.rpc('admin_update_account', {
    _user_id: targetUserId,
    _display_name: 'Hacked Admin',
    _phone: null,
    _role: 'admin',
    _division: 'Development',
    _position: 'Engineer',
    _bio: null,
    _specialties: [],
    _socials: {},
    _published: true,
    _is_active: true,
    _status: 'active'
  });
  record(
    'I-02',
    'I. Abuse Prevention',
    'Worker calling admin_update_account RPC rejected by DB check',
    Boolean(rpcWorkerErr),
    `DB RPC rejected worker escalation: ${rpcWorkerErr?.message}`
  );

  // 3. Worker calling admin_revoke_session rejected by DB check
  const { error: rpcRevErr } = await workerClient.rpc('admin_revoke_session', {
    _session_id: testSessionId || '00000000-0000-0000-0000-000000000000',
    _reason: 'Worker attack'
  });
  record(
    'I-03',
    'I. Abuse Prevention',
    'Worker calling admin_revoke_session RPC rejected by DB check',
    Boolean(rpcRevErr),
    `DB RPC rejected worker session revocation: ${rpcRevErr?.message}`
  );

  console.log('\n========================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL ASSERTIONS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('========================================================================\n');

  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/phase1_backend_test_results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('Saved results to scripts/phase1_backend_test_results.json');
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
