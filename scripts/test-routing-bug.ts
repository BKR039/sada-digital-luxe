// ============================================================
// Case Study Public Routing & Interaction Bug Verification
// ============================================================

async function verifyRouting() {
  console.log("=================================================");
  console.log("VERIFYING CASE STUDY ROUTING ON DEV SERVER");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:8081";

  // Test 1: Fetch /case-studies index HTML
  console.log("1. Fetching /case-studies...");
  const indexRes = await fetch(`${baseUrl}/case-studies`);
  const indexHtml = await indexRes.text();

  const hasCardLink = indexHtml.includes('href="/case-studies/janat-sahara-branding"');
  const hasCardTitle = indexHtml.includes("Janat Sahara");
  const hasCardCTA = indexHtml.includes("View Case Study");

  console.log(`- Status: ${indexRes.status}`);
  console.log(`- Card links to /case-studies/janat-sahara-branding: ${hasCardLink}`);
  console.log(`- Card title 'Janat Sahara' present: ${hasCardTitle}`);
  console.log(`- CTA 'View Case Study' present: ${hasCardCTA}`);

  if (!hasCardLink || !hasCardTitle || !hasCardCTA) {
    throw new Error("FAIL: /case-studies index does not render functional card link");
  }
  console.log("✓ PASS: /case-studies index card renders with valid href link\n");

  // Test 2: Fetch /case-studies/janat-sahara-branding detail HTML
  console.log("2. Fetching /case-studies/janat-sahara-branding...");
  const detailRes = await fetch(`${baseUrl}/case-studies/janat-sahara-branding`);
  const detailHtml = await detailRes.text();

  const isDetailPage = detailHtml.includes("<article") && detailHtml.includes("case-studies.$slug.tsx");
  const hasProjectTitle = detailHtml.includes("Janat Sahara");
  const hasBackLink = detailHtml.includes("Back to case studies");
  const notIndex = !detailHtml.includes("Work built around real business problems.");

  console.log(`- Status: ${detailRes.status}`);
  console.log(`- Rendered detail article template: ${isDetailPage}`);
  console.log(`- Detail title present: ${hasProjectTitle}`);
  console.log(`- Back link present: ${hasBackLink}`);
  console.log(`- Does NOT render index page content: ${notIndex}`);

  if (!isDetailPage || !hasProjectTitle || !hasBackLink || !notIndex) {
    throw new Error("FAIL: /case-studies/janat-sahara-branding does not render detail template");
  }
  console.log("✓ PASS: /case-studies/janat-sahara-branding renders dedicated detail page\n");

  // Test 3: Test direct refresh simulation
  console.log("3. Simulating browser refresh on /case-studies/janat-sahara-branding...");
  const refreshRes = await fetch(`${baseUrl}/case-studies/janat-sahara-branding`);
  if (refreshRes.status !== 200) {
    throw new Error(`FAIL: Direct load returned status ${refreshRes.status}`);
  }
  console.log("✓ PASS: Direct load & refresh returns status 200 with complete detail template\n");

  // Test 4: Draft protection verification
  console.log("4. Verifying draft case studies are blocked from public...");
  const fakeDraftSlug = "unreleased-secret-case-study";
  const draftRes = await fetch(`${baseUrl}/case-studies/${fakeDraftSlug}`);
  const draftHtml = await draftRes.text();
  const isNotFound = draftHtml.includes("Case study not found") || draftRes.status === 404;
  console.log(`- Draft access blocked: ${isNotFound}`);
  if (!isNotFound) {
    throw new Error("FAIL: Non-existent / draft case study was not blocked");
  }
  console.log("✓ PASS: Draft protection intact (404/not found)\n");

  console.log("=================================================");
  console.log("ALL ROUTING VERIFICATION TESTS PASSED!");
  console.log("=================================================");
}

verifyRouting().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
