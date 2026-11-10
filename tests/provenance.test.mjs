import test from "node:test";
import assert from "node:assert/strict";
import { parseAstDump } from "../src/ast/text.js";
import { emitCpp } from "../src/emit/index.js";
import { indexTree } from "../src/ui/provenance.js";

test("hovering CallExpr covers callee, all arguments, and nested expression", () => {
  const input = `CallExpr 'int'
|-DeclRefExpr 'int' Function 'sum' 'int (int, int)'
|-IntegerLiteral 'int' 2
\`-BinaryOperator 'int' '+'
  |-IntegerLiteral 'int' 3
  \`-IntegerLiteral 'int' 4`;
  const { root } = parseAstDump(input);
  const { source, spans } = emitCpp(root);
  const { descendantsById, lineById } = indexTree(root);
  assert.equal(source, "sum(2, (3 + 4))");
  assert.deepEqual([...descendantsById.get(root.id)], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...descendantsById.get(3)], [3, 4, 5]);
  assert.equal(
    spans.filter((span) => descendantsById.get(root.id).has(span.id)).length,
    6,
  );
  assert.equal(lineById.get(5), 6);
});

test("implicit wrappers are marked as adding no source syntax", async () => {
  const { unmappedNodeIds } = await import("../src/ui/provenance.js");
  const { root } = parseAstDump(
    "ImplicitCastExpr 'int'\n`-IntegerLiteral 'int' 7",
  );
  const emitted = emitCpp(root);
  assert.equal(emitted.source, "7");
  assert.deepEqual([...unmappedNodeIds(root, emitted.spans)], [0]);
});
