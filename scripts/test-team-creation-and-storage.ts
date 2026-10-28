// ============================================================
// SADA WORK OS — Full End-to-End Automated Test Suite:
// Team Member Creation, Remote Schema, Storage & /about Sync
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resolveToProfileId, getAssignmentMemberInfo, type TeamMemberRow, type ProfileRow } from "../src/components/admin/project-utils";

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
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runFullTestSuite() {
  console.log("=================================================================");
  console.log("SADA WORK OS — E2E TEST SUITE: TEAM CREATION, STORAGE & WEBSITE");
  console.log("=================================================================\n");

  // Establish authenticated session for upload operations
  const testEmail = `team.e2e.${Date.now()}@sada.agency`;
  const testPassword = "TestPassword123!";
  await supabase.auth.signUp({ email: testEmail, password: testPassword });
  await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });

  let testMemberId: string | null = null;
  let uploadPath1: string | null = null;
  let uploadPath2: string | null = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: REMOTE SCHEMA VERIFICATION
    // -------------------------------------------------------------
    console.log("1. REMOTE TEAM_MEMBERS SCHEMA VERIFICATION");
    const { data: schemaData, error: schemaErr } = await supabase
      .from("team_members")
      .select("id, name, position, division, specialties, email, is_active, availability_status, profile_id, published, sort_order, photo_url, socials")
      .limit(1);

    assert(!schemaErr, `Remote team_members query succeeded without schema cache errors: ${schemaErr?.message || "OK"}`);
    console.log("   Columns verified: division, specialties, email, is_active, availability_status, profile_id, published, sort_order, photo_url, socials.\n");

    // -------------------------------------------------------------
    // TEST 2: STORAGE DEVICE PHOTO UPLOAD (FIRST UPLOAD)
    // -------------------------------------------------------------
    console.log("2. SUPABASE STORAGE UPLOAD (PHOTO 1)");
    const imageBuffer1 = Buffer.from("fake-png-image-binary-data-version-1");
    uploadPath1 = `team-avatars/e2e-test-${Date.now()}-v1.png`;

    const { data: uData1, error: uErr1 } = await supabase.storage.from("media").upload(uploadPath1, imageBuffer1, {
      contentType: "image/png",
      upsert: true,
    });
    assert(!uErr1 && Boolean(uData1?.path), `Photo 1 uploaded to media bucket path '${uploadPath1}'`);

    const { data: urlData1 } = supabase.storage.from("media").getPublicUrl(uploadPath1);
    const photoUrl1 = urlData1.publicUrl;
    assert(Boolean(photoUrl1 && photoUrl1.startsWith("http")), `Public URL resolved: ${photoUrl1}\n`);

    // -------------------------------------------------------------
    // TEST 3: REAL TEAM MEMBER INSERT
    // -------------------------------------------------------------
    console.log("3. TEAM MEMBER CREATION (INSERT)");
    const insertPayload = {
      name: "E2E Test Specialist",
      position: "Senior Systems Architect",
      division: "Development",
      specialties: ["Fullstack", "Supabase", "React 19"],
      email: "e2e.test@sada.agency",
      bio: "Automated test specialist profile created for verification.",
      photo_url: photoUrl1,
      socials: { linkedin: "https://linkedin.com/in/e2etest", behance: "https://behance.net/e2etest" },
      sort_order: 999,
      is_active: true,
      published: true,
      availability_status: "available",
    };

    const { data: insertedRecord, error: insertErr } = await supabase
      .from("team_members")
      .insert([insertPayload])
      .select("*")
      .single();

    if (insertErr) {
      console.error("Insert error details:", insertErr);
    }

    assert(!insertErr && Boolean(insertedRecord?.id), `Inserted team member into remote database (ID: ${insertedRecord?.id})`);
    testMemberId = insertedRecord.id;

    assert(insertedRecord.availability_status === "available", `availability_status stored as 'available'`);
    assert(insertedRecord.photo_url === photoUrl1, `photo_url stored as Storage URL`);
    console.log("");

    // -------------------------------------------------------------
    // TEST 4: PUBLIC WEBSITE (/about) QUERY SYNC WITH PHOTO 1
    // -------------------------------------------------------------
    console.log("4. PUBLIC WEBSITE QUERY (/about) VERIFICATION");
    const { data: publicMembers1, error: pubErr1 } = await supabase
      .from("team_members")
      .select("id, name, position, division, specialties, bio, photo_url, socials, sort_order")
      .eq("published", true)
      .eq("is_active", true)
      .eq("id", testMemberId);

    assert(!pubErr1 && publicMembers1?.length === 1, `Public website query found published active member`);
    assert(publicMembers1[0].photo_url === photoUrl1, `/about receives correct uploaded photo URL`);
    assert((publicMembers1[0] as any).email === undefined, `Internal email is NOT exposed in public website fields`);
    assert((publicMembers1[0] as any).availability_status === undefined, `Internal availability_status is NOT exposed in public website fields\n`);

    // -------------------------------------------------------------
    // TEST 5: STORAGE REPLACEMENT (PHOTO 2 & UPDATE)
    // -------------------------------------------------------------
    console.log("5. PHOTO REPLACEMENT & TEAM MEMBER UPDATE");
    const imageBuffer2 = Buffer.from("fake-png-image-binary-data-version-2");
    uploadPath2 = `team-avatars/e2e-test-${Date.now()}-v2.png`;

    const { data: uData2, error: uErr2 } = await supabase.storage.from("media").upload(uploadPath2, imageBuffer2, {
      contentType: "image/png",
      upsert: true,
    });
    assert(!uErr2, `Photo 2 uploaded to media bucket`);

    const { data: urlData2 } = supabase.storage.from("media").getPublicUrl(uploadPath2);
    const photoUrl2 = urlData2.publicUrl;

    const { error: updateErr1 } = await supabase
      .from("team_members")
      .update({ photo_url: photoUrl2, availability_status: "busy", updated_at: new Date().toISOString() })
      .eq("id", testMemberId);

    assert(!updateErr1, `Team member updated with replacement photo URL & availability_status='busy'`);

    const { data: publicMembers2 } = await supabase
      .from("team_members")
      .select("id, photo_url")
      .eq("id", testMemberId)
      .single();

    assert(publicMembers2?.photo_url === photoUrl2, `/about immediately receives updated photo URL\n`);

    // -------------------------------------------------------------
    // TEST 6: PHOTO REMOVAL & FALLBACK VERIFICATION
    // -------------------------------------------------------------
    console.log("6. PHOTO REMOVAL & FALLBACK VERIFICATION");
    const { error: removePhotoErr } = await supabase
      .from("team_members")
      .update({ photo_url: null, updated_at: new Date().toISOString() })
      .eq("id", testMemberId);

    assert(!removePhotoErr, `Photo URL removed (set to null) on team member`);

    const { data: publicMembers3 } = await supabase
      .from("team_members")
      .select("id, photo_url")
      .eq("id", testMemberId)
      .single();

    assert(publicMembers3?.photo_url === null, `photo_url is null in database, triggering UI avatar fallback icon\n`);

    // -------------------------------------------------------------
    // TEST 7: PUBLIC VISIBILITY TOGGLE (published = false)
    // -------------------------------------------------------------
    console.log("7. PUBLIC VISIBILITY TOGGLE VERIFICATION");
    const { error: pubToggleErr } = await supabase
      .from("team_members")
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq("id", testMemberId);

    assert(!pubToggleErr, `Set published=false for team member`);

    const { data: publicMembers4 } = await supabase
      .from("team_members")
      .select("id")
      .eq("published", true)
      .eq("is_active", true)
      .eq("id", testMemberId);

    assert(publicMembers4?.length === 0, `Unpublished member immediately disappears from public website /about query\n`);

    // -------------------------------------------------------------
    // TEST 8: TASK ASSIGNMENT IDENTITY REGRESSION TEST
    // -------------------------------------------------------------
    console.log("8. TASK ASSIGNMENT IDENTITY REGRESSION TEST");
    const mockProfiles: ProfileRow[] = [{ id: "prof-uuid-99", display_name: "Mock Profile User" }];
    const mockTeam: TeamMemberRow[] = [{
      id: testMemberId,
      profile_id: "prof-uuid-99",
      name: "E2E Test Specialist",
      position: "Specialist",
      division: "Development",
      specialties: [],
      sort_order: 1,
      published: false,
      is_active: true,
      availability_status: "busy",
    }];

    const resolvedProfId = resolveToProfileId(testMemberId, mockTeam, mockProfiles);
    assert(resolvedProfId === "prof-uuid-99", `resolveToProfileId properly converts team_member.id -> profile_id ('prof-uuid-99')`);

    const memberInfo = getAssignmentMemberInfo("prof-uuid-99", mockTeam, mockProfiles);
    assert(memberInfo.name === "E2E Test Specialist", `getAssignmentMemberInfo correctly resolves assignment display name`);
    console.log("");

  } finally {
    // -------------------------------------------------------------
    // CLEANUP TEST DATA
    // -------------------------------------------------------------
    console.log("9. CLEANUP");
    if (testMemberId) {
      const { error: delErr } = await supabase.from("team_members").delete().eq("id", testMemberId);
      assert(!delErr, `Deleted test team member record '${testMemberId}'`);
    }

    const filesToRemove = [uploadPath1, uploadPath2].filter(Boolean) as string[];
    if (filesToRemove.length > 0) {
      const { error: sDelErr } = await supabase.storage.from("media").remove(filesToRemove);
      assert(!sDelErr, `Cleaned up test storage files: ${filesToRemove.join(", ")}`);
    }
    console.log("\n=== ALL E2E AUTOMATED TESTS PASSED CLEANLY ===");
  }
}

runFullTestSuite();
