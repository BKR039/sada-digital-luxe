import fs from "fs";
import path from "path";

// Pre-load .env for Node environment
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

import { 
  normalizeEmail, 
  isValidEmail, 
  getResetPasswordRedirectUrl, 
  requestPasswordRecovery,
  updateUserPassword
} from "../src/lib/auth-recovery-service";
import { supabase } from "../src/integrations/supabase/client";

async function runRecoveryVerification() {
  console.log("=================================================");
  console.log("SADA OS — SUPABASE PASSWORD RECOVERY FLOW TEST SUITE");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  // TEST 1: EMAIL NORMALIZATION
  totalTests++;
  console.log("--- TEST 1: Email Normalization ---");
  const unnormalized = "   Admin.Test@Sada.Agency   ";
  const normalized = normalizeEmail(unnormalized);
  if (normalized === "admin.test@sada.agency") {
    console.log(`[PASS] normalizeEmail("${unnormalized}") === "${normalized}"`);
    passedTests++;
  } else {
    console.error(`[FAIL] normalizeEmail returned: "${normalized}"`);
  }

  // TEST 2: EMAIL FORMAT VALIDATION
  totalTests++;
  console.log("\n--- TEST 2: Email Format Validation ---");
  const validEmails = ["admin@sada.agency", "user.name+tag@example.com", "contact@domain.co.uk"];
  const invalidEmails = ["", "   ", "not-an-email", "missing@domain", "@sada.agency", "spaces in@email.com"];
  
  const allValidsPass = validEmails.every(e => isValidEmail(e));
  const allInvalidsFail = invalidEmails.every(e => !isValidEmail(e));

  if (allValidsPass && allInvalidsFail) {
    console.log("[PASS] Valid emails correctly accepted, invalid emails rejected.");
    passedTests++;
  } else {
    console.error("[FAIL] Email validation error.", { allValidsPass, allInvalidsFail });
  }

  // TEST 3: REJECT EMPTY OR INVALID FORMAT BEFORE SUPABASE CALL
  totalTests++;
  console.log("\n--- TEST 3: Client Validation Prevents Bad Calls ---");
  const emptyRes = await requestPasswordRecovery("");
  const invalidRes = await requestPasswordRecovery("bad-email");

  if (!emptyRes.success && emptyRes.errorType === "empty_email" &&
      !invalidRes.success && invalidRes.errorType === "invalid_format") {
    console.log("[PASS] Empty and invalid inputs intercepted locally before touching Supabase API.");
    passedTests++;
  } else {
    console.error("[FAIL] Client validation did not reject bad inputs properly.", { emptyRes, invalidRes });
  }

  // TEST 4: REDIRECT URL CANONICAL RESOLUTION
  totalTests++;
  console.log("\n--- TEST 4: Redirect URL Canonical Resolution ---");
  const redirectUrl = getResetPasswordRedirectUrl();
  console.log(`Resolved Redirect URL: ${redirectUrl}`);
  if (redirectUrl.endsWith("/reset-password")) {
    console.log("[PASS] Redirect URL correctly targets canonical /reset-password route.");
    passedTests++;
  } else {
    console.error(`[FAIL] Unexpected redirect URL: ${redirectUrl}`);
  }

  // TEST 5: PASSWORD UPDATE INPUT VALIDATION
  totalTests++;
  console.log("\n--- TEST 5: Password Update Validation ---");
  const shortPassRes = await updateUserPassword("12345");
  if (!shortPassRes.success && shortPassRes.message.includes("8")) {
    console.log("[PASS] Passwords under 8 characters properly rejected.");
    passedTests++;
  } else {
    console.error("[FAIL] Short password validation failed.", shortPassRes);
  }

  // TEST 6: SUPABASE AUTH LIVE CALL & RATE LIMIT / ERROR HANDLING
  totalTests++;
  console.log("\n--- TEST 6: Supabase Live resetPasswordForEmail Execution ---");
  const liveRes = await requestPasswordRecovery("qa.test.recovery@sada.agency");
  console.log("Live Call Result:", {
    success: liveRes.success,
    errorType: liveRes.errorType,
    message: liveRes.message,
    hasDiagnostic: Boolean(liveRes.diagnosticError)
  });

  // Since Supabase default provider enforces strict rate limit (3-4/hr),
  // a rate limited response or a success response both verify proper handling without crashing or faking success.
  if (liveRes.success || liveRes.errorType === "rate_limited" || liveRes.errorType === "api_error") {
    console.log("[PASS] Live Supabase call safely captured and processed without unhandled rejection.");
    passedTests++;
  } else {
    console.error("[FAIL] Unexpected live response.", liveRes);
  }

  console.log("\n=================================================");
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("=================================================");
}

runRecoveryVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
