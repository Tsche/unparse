export function diagnosticsByLine(diagnostics) {
  const lines = new Map();
  for (const diagnostic of diagnostics) {
    if (!Number.isInteger(diagnostic.line) || diagnostic.line < 1) continue;
    if (!lines.has(diagnostic.line)) lines.set(diagnostic.line, []);
    lines.get(diagnostic.line).push(diagnostic.message);
  }
  return lines;
}

export function unknownKindLines(diagnostics) {
  return new Set(
    diagnostics
      .filter((d) => d.line > 0 && /^Unsupported AST node:/.test(d.message))
      .map((d) => d.line),
  );
}

export function diagnosticGutters(diagnostics) {
  const errors = new Set();
  const warnings = new Set();
  for (const diagnostic of diagnostics) {
    if (diagnostic.line < 1) continue;
    if (
      /Unsupported|missing|needs|malformed|Could not read|Tree prefix|Missing parent|Orphaned/i.test(
        diagnostic.message,
      )
    )
      errors.add(diagnostic.line);
    else if (/SourceLocExpr/.test(diagnostic.message))
      warnings.add(diagnostic.line);
  }
  for (const line of errors) warnings.delete(line);
  return { errors, warnings };
}

export function diagnosticSeverity(diagnostic) {
  if (!diagnostic.level || diagnostic.line === 0) return "error";
  if (
    /Unsupported|missing|needs|malformed|Could not read|Tree prefix|Missing parent|Orphaned/i.test(
      diagnostic.message,
    )
  )
    return "error";
  return "warning";
}

export function diagnosticSummary(diagnostics) {
  const counts = { errors: 0, warnings: 0 };
  for (const diagnostic of diagnostics) {
    if (diagnosticSeverity(diagnostic) === "error") counts.errors++;
    else counts.warnings++;
  }
  const parts = [];
  if (counts.errors)
    parts.push(`${counts.errors} ${counts.errors === 1 ? "error" : "errors"}`);
  if (counts.warnings)
    parts.push(
      `${counts.warnings} ${counts.warnings === 1 ? "warning" : "warnings"}`,
    );
  return {
    ...counts,
    label: parts.join(" · "),
    severity: counts.errors ? "error" : counts.warnings ? "warning" : "none",
  };
}
