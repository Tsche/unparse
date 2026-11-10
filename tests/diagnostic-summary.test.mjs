import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticSummary } from "../src/ui/diagnostic-view.js";

test("summarizes inferred warnings separately from reconstruction errors", () => {
  const result = diagnosticSummary([
    {
      level: "warning",
      line: 4,
      message: "SourceLocExpr builtin inferred from type",
    },
    {
      level: "warning",
      line: 7,
      message: "Unsupported AST node: MysteryExpr.",
    },
    { level: "warning", line: 9, message: "Tree prefix is missing." },
  ]);
  assert.deepEqual(result, {
    errors: 2,
    warnings: 1,
    label: "2 errors · 1 warning",
    severity: "error",
  });
});
