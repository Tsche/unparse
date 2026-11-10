import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnosticsByLine,
  unknownKindLines,
} from "../src/ui/diagnostic-view.js";

test("groups all error explanations on their AST line", () => {
  const diagnostics = [
    {
      line: 2,
      message:
        "Unsupported AST node: IntgerLiteral. Did you mean IntegerLiteral?",
    },
    { line: 2, message: "Tree prefix is missing." },
    { line: 0, message: "General parse failure" },
  ];
  assert.deepEqual(diagnosticsByLine(diagnostics).get(2), [
    diagnostics[0].message,
    diagnostics[1].message,
  ]);
  assert.deepEqual([...unknownKindLines(diagnostics)], [2]);
});

test("SourceLocExpr inference gets a warning gutter; errors take precedence", async () => {
  const { diagnosticGutters } = await import("../src/ui/diagnostic-view.js");
  const { errors, warnings } = diagnosticGutters([
    { line: 2, message: "SourceLocExpr builtin inferred from type" },
    { line: 3, message: "Unsupported AST node: MysteryExpr." },
    { line: 3, message: "SourceLocExpr builtin inferred from type" },
  ]);
  assert.deepEqual([...warnings], [2]);
  assert.deepEqual([...errors], [3]);
});
