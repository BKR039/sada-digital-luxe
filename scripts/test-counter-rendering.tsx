import React from "react";
import { renderToString } from "react-dom/server";
import { SADANumberStepper } from "../src/components/ui/sada-counter";

function testCounterRendering() {
  console.log("=== TESTING SADA NUMBER STEPPER RENDERING ===");

  const testValues = [0, 1, 9, 10, 99, 100, 999, 9999, 10000];
  const testUnits = ["TND", "reels", "posts", "hrs", "shoots", undefined];

  let passed = 0;
  let total = 0;

  for (const val of testValues) {
    for (const unit of testUnits) {
      total++;
      const html = renderToString(
        <SADANumberStepper
          value={val}
          unit={unit}
          min={0}
          step={unit === "hrs" ? 0.5 : 10}
        />
      );

      // Check invariants
      const hasMinusButton = html.includes('aria-label="Decrease quantity"');
      const hasPlusButton = html.includes('aria-label="Increase quantity"');
      const hasValue = html.includes(`value="${val}"`);
      const hasUnit = unit ? html.includes(`>${unit}</span>`) : true;
      const noOverflowHidden = !html.includes("overflow-hidden");
      const noTruncate = !html.includes("truncate");
      const hasTabularNums = html.includes("tabular-nums");
      const hasFontDisplay = html.includes("font-display");

      if (
        hasMinusButton &&
        hasPlusButton &&
        hasValue &&
        hasUnit &&
        noOverflowHidden &&
        noTruncate &&
        hasTabularNums &&
        hasFontDisplay
      ) {
        passed++;
      } else {
        console.error(`Failed on val=${val}, unit=${unit}`);
        console.log(html);
      }
    }
  }

  console.log(`\nVerification: ${passed}/${total} test combinations passed successfully.`);
  if (passed === total) {
    console.log("✓ ALL COUNTER RENDERING CHECKS PASSED (100% SUCCESS)");
  } else {
    process.exit(1);
  }
}

testCounterRendering();
