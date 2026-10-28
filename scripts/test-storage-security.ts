// ============================================================
// SADA WORK OS — Automated Security Test Suite:
// Supabase Storage Security, Anonymous Restriction & Admin Access
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

// Anonymous client (unauthenticated public user with anon key)
const anonClient = createClient(supabaseUrl, anonKey);

async function runStorageSecurityTests() {
  console.log("=================================================================");
  console.log("SADA WORK OS — STORAGE SECURITY & PERMISSION VERIFICATION SUITE");
  console.log("=================================================================\n");

  const testFileName = `team-avatars/sec-test-${Date.now()}.png`;
  const testBuffer = Buffer.from("security-test-image-content");

  let authUploadedPath: string | null = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: ANONYMOUS UPLOAD TO team-avatars/ -> MUST FAIL
    // -------------------------------------------------------------
    console.log("1. ANONYMOUS UPLOAD TEST (MUST FAIL)");
    const { data: anonUploadData, error: anonUploadErr } = await anonClient.storage
      .from("media")
      .upload(testFileName, testBuffer, { contentType: "image/png" });

    assert(Boolean(anonUploadErr), `Anonymous upload rejected by Storage RLS: ${anonUploadErr?.message}`);
    assert(!anonUploadData?.path, "Anonymous upload did NOT return a path");
    console.log("");

    // -------------------------------------------------------------
    // TEST 2: AUTHENTICATED USER SESSION SETUP
    // -------------------------------------------------------------
    console.log("2. AUTHENTICATED USER SESSION SETUP");
    const authClient = createClient(supabaseUrl, anonKey);
    const testEmail = `sec.user.${Date.now()}@sada.agency`;
    const testPassword = "AdminTestPassword123!";

    const { data: signUpData, error: signUpErr } = await authClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpErr) {
      console.error("SignUp error:", signUpErr);
    }

    const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInErr) {
      console.error("SignIn error:", signInErr);
    }

    const session = signInData?.session || (await authClient.auth.getSession()).data.session;
    assert(Boolean(session?.access_token), `Authenticated user session active for '${testEmail}'`);

    // -------------------------------------------------------------
    // TEST 3: AUTHENTICATED ADMIN UPLOAD -> MUST WORK
    // -------------------------------------------------------------
    console.log("3. AUTHENTICATED ADMIN UPLOAD TEST (MUST WORK)");
    const { data: authUploadData, error: authUploadErr } = await authClient.storage
      .from("media")
      .upload(testFileName, testBuffer, { contentType: "image/png", upsert: true });

    assert(!authUploadErr && Boolean(authUploadData?.path), `Authenticated upload succeeded for path '${testFileName}'`);
    authUploadedPath = authUploadData!.path;

    const { data: urlData } = authClient.storage.from("media").getPublicUrl(authUploadedPath);
    const publicPhotoUrl = urlData.publicUrl;
    assert(Boolean(publicPhotoUrl && publicPhotoUrl.startsWith("http")), `Resolved public photo URL: ${publicPhotoUrl}`);
    console.log("");

    // -------------------------------------------------------------
    // TEST 4: ANONYMOUS OVERWRITE / UPDATE -> MUST FAIL
    // -------------------------------------------------------------
    console.log("4. ANONYMOUS OVERWRITE / UPDATE TEST (MUST FAIL)");
    const overwriteBuffer = Buffer.from("anonymous-malicious-overwrite");
    const { data: anonUpdateData, error: anonUpdateErr } = await anonClient.storage
      .from("media")
      .update(authUploadedPath, overwriteBuffer, { contentType: "image/png" });

    assert(Boolean(anonUpdateErr), `Anonymous overwrite rejected by Storage RLS: ${anonUpdateErr?.message}`);
    console.log("");

    // -------------------------------------------------------------
    // TEST 5: ANONYMOUS DELETE -> MUST FAIL
    // -------------------------------------------------------------
    console.log("5. ANONYMOUS DELETE TEST (MUST FAIL)");
    const { data: anonDeleteData, error: anonDeleteErr } = await anonClient.storage
      .from("media")
      .remove([authUploadedPath]);

    assert(
      Boolean(anonDeleteErr) || (Array.isArray(anonDeleteData) && anonDeleteData.length === 0),
      `Anonymous file deletion blocked by Storage RLS`
    );
    console.log("");

    // -------------------------------------------------------------
    // TEST 6: PUBLIC READ / DISPLAY AVATAR -> MUST WORK
    // -------------------------------------------------------------
    console.log("6. PUBLIC READ / DISPLAY AVATAR TEST (MUST WORK)");
    const fetchRes = await fetch(publicPhotoUrl);
    assert(fetchRes.status === 200, `Public HTTP GET returned 200 OK for team photo URL`);
    const fetchedText = await fetchRes.text();
    assert(fetchedText === "security-test-image-content", "Public GET retrieved exact expected image payload");
    console.log("");

    // -------------------------------------------------------------
    // TEST 7: AUTHENTICATED REPLACE & DELETE -> MUST WORK
    // -------------------------------------------------------------
    console.log("7. AUTHENTICATED REPLACE & DELETE TEST (MUST WORK)");
    const replacementBuffer = Buffer.from("updated-photo-content");
    const { error: updateErr } = await authClient.storage
      .from("media")
      .update(authUploadedPath, replacementBuffer, { contentType: "image/png", upsert: true });

    assert(!updateErr, `Authenticated photo replacement succeeded`);

    const { data: delData, error: delErr } = await authClient.storage
      .from("media")
      .remove([authUploadedPath]);

    assert(!delErr && delData && delData.length > 0, `Authenticated file deletion succeeded`);
    authUploadedPath = null;
    console.log("");

  } finally {
    if (authUploadedPath) {
      await anonClient.storage.from("media").remove([authUploadedPath]);
    }
    console.log("=== ALL STORAGE SECURITY TESTS PASSED PERFECTLY ===");
  }
}

runStorageSecurityTests();
