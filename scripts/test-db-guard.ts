// ============================================================
// SADA OS — Hardened Test Database Isolation Guard
// Zero-trust verification to prevent test execution against
// the shared production / staging Supabase project.
// ============================================================

export const CANONICAL_SHARED_PROJECT_REF = "mtfkzabiscyleztypqks";
export const CANONICAL_SHARED_HOST = "mtfkzabiscyleztypqks.supabase.co";

export interface GuardEvaluation {
  isBlocked: boolean;
  targetHost: string;
  targetRef: string;
  exitCode: number;
  reason: string;
}

export function evaluateDatabaseIsolation(
  targetUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): GuardEvaluation {
  if (!targetUrl || targetUrl.trim() === "") {
    return {
      isBlocked: true,
      targetHost: "unknown",
      targetRef: "unknown",
      exitCode: 2,
      reason: "Missing database URL. Environment identity is missing or ambiguous.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    return {
      isBlocked: true,
      targetHost: "invalid",
      targetRef: "invalid",
      exitCode: 2,
      reason: "Invalid database URL format. Fails closed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const projectRef = hostname.includes(".supabase.co")
    ? hostname.split(".")[0]
    : hostname;

  // 1. UNCONDITIONAL BLOCK: Shared project ref or host
  const isSharedTarget =
    hostname === CANONICAL_SHARED_HOST ||
    projectRef === CANONICAL_SHARED_PROJECT_REF ||
    targetUrl.includes(CANONICAL_SHARED_PROJECT_REF);

  if (isSharedTarget) {
    return {
      isBlocked: true,
      targetHost: hostname,
      targetRef: projectRef,
      exitCode: 2, // Exit code 2 distinguishes "BLOCKED / NOT EXECUTED" from exit code 0 ("PASSED")
      reason: `Target database (${hostname}) is the canonical shared project '${CANONICAL_SHARED_PROJECT_REF}'. Mutating tests cannot run against the shared database under ANY flags (ALLOW_MUTATION_TESTS is disregarded for shared targets).`,
    };
  }

  // 2. ISOLATED ENVIRONMENT VERIFICATION
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "host.docker.internal" ||
    hostname.endsWith(".local");

  const isExplicitIsolatedEnv =
    env.TEST_DB_ISOLATED === "true" &&
    projectRef !== CANONICAL_SHARED_PROJECT_REF;

  if (!isLocalHost && !isExplicitIsolatedEnv) {
    return {
      isBlocked: true,
      targetHost: hostname,
      targetRef: projectRef,
      exitCode: 2,
      reason: `Remote target '${hostname}' is not verified as an isolated test project. Set TEST_DB_ISOLATED=true with a dedicated non-shared test database URL to execute.`,
    };
  }

  // Target is verified as isolated
  return {
    isBlocked: false,
    targetHost: hostname,
    targetRef: projectRef,
    exitCode: 0,
    reason: `Target '${hostname}' independently verified as isolated test environment.`,
  };
}

export function enforceDatabaseIsolation(
  targetUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  const result = evaluateDatabaseIsolation(targetUrl, env);

  if (result.isBlocked) {
    console.error("\n=======================================================================");
    console.error("🛑 TEST EXECUTION BLOCKED: DATA ISOLATION SAFEGUARD");
    console.error("=======================================================================");
    console.error(`Target Host : ${result.targetHost}`);
    console.error(`Target Ref  : ${result.targetRef}`);
    console.error(`Status      : BLOCKED (Exit code ${result.exitCode})`);
    console.error(`Reason      : ${result.reason}`);
    console.error("=======================================================================\n");
    process.exit(result.exitCode);
  }

  console.log(`[DataIsolationGuard] Target independently verified as isolated: ${result.targetHost}`);
}
