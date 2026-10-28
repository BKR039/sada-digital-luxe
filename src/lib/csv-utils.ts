// ============================================================
// SADA OS — CANONICAL CSV SERIALIZATION & INJECTION SANITIZER
// RFC 4180 Compliant + OWASP CSV Formula Injection Defense
//
// Invariants:
// 1. Double quotes inside fields must be escaped as `""`.
// 2. Untrusted values starting with formula triggers (=, +, -, @, \t, \r, %, |)
//    must be neutralized by prefixing with a single quote `'`.
// 3. Leading whitespace before formula triggers must be detected and neutralized.
// 4. Legitimate negative numbers (e.g., -150.50, -42) must be preserved as numeric.
// 5. UTF-8 Byte Order Mark (\uFEFF) included by default for Excel multilingual support.
// ============================================================

/**
 * Sanitizes a single cell value for secure inclusion in a CSV.
 */
export function sanitizeCsvCell(
  val: unknown,
  options: { preserveNumeric?: boolean } = { preserveNumeric: true }
): string {
  if (val === null || val === undefined) {
    return '""';
  }

  // 1. Primitive Numbers (always safe and legitimate)
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return '""';
    return String(val);
  }

  // 2. Primitive Booleans
  if (typeof val === "boolean") {
    return val ? '"true"' : '"false"';
  }

  let s = String(val);

  // 3. Empty strings
  if (s.length === 0) {
    return '""';
  }

  // 4. Preserve legitimate numeric strings if requested (e.g., "-150.00", "42", "-0.75")
  if (options.preserveNumeric) {
    const trimmed = s.trim();
    // Strictly matches integers and floats with optional sign and exponent: -123, -123.45, 0.5, -1e5
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      return trimmed;
    }
  }

  // 5. Formula Injection Defense:
  // Detect dangerous triggers (=, +, -, @, \t, \r, %, |) even if preceded by whitespace or control chars
  const trimmedStart = s.replace(/^[\s\u0000-\u001f\u007f-\u009f]+/, "");
  if (/^[=+@\-\t\r|%]/.test(trimmedStart)) {
    // Prefix with single quote so spreadsheet engines force literal text mode
    s = `'${s}`;
  }

  // 6. RFC 4180 Double-Quote Escaping
  const escaped = s.replace(/"/g, '""');

  // 7. Enclose in double quotes
  return `"${escaped}"`;
}

/**
 * Serializes an array of cell values into a single RFC 4180 compliant CSV row.
 */
export function serializeCsvRow(
  row: unknown[],
  options?: { preserveNumeric?: boolean }
): string {
  return row.map((cell) => sanitizeCsvCell(cell, options)).join(",");
}

/**
 * Serializes a 2D array of rows into a complete, sanitized CSV document.
 * Includes UTF-8 Byte Order Mark (\uFEFF) by default so Microsoft Excel renders
 * Arabic, French, and accented characters properly without encoding corruption.
 */
export function serializeCsv(
  rows: unknown[][],
  options: {
    withBom?: boolean;
    preserveNumeric?: boolean;
    lineEnding?: "\r\n" | "\n";
  } = {}
): string {
  const withBom = options.withBom ?? true;
  const lineEnding = options.lineEnding ?? "\r\n";
  const preserveNumeric = options.preserveNumeric ?? true;

  const content = rows
    .map((row) => serializeCsvRow(row, { preserveNumeric }))
    .join(lineEnding);

  return withBom ? `\uFEFF${content}` : content;
}
