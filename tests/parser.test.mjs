import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAstDump } from "../src/ast/text.js";
import { emitCpp } from "../src/emit/index.js";

const file = (name) =>
  readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8");

test("reconstructs the supplied glibc assert AST", () => {
  const { root, nodeCount } = parseAstDump(file("assert-ast.txt"));
  const { source, diagnostics } = emitCpp(root);
  assert.equal(nodeCount, 18);
  assert.equal(
    source,
    '(((static_cast<_Bool>(false) ? void(0) : __assert_fail("false", __builtin_FILE(), __builtin_LINE(), __extension__ __PRETTY_FUNCTION__))))',
  );
  assert.equal(diagnostics.length, 2);
  assert.ok(diagnostics.every((d) => d.message.includes("inferred")));
});

test("reconstructs a tree of binary operators", () => {
  const parsed = parseAstDump(file("arithmetic-ast.txt"));
  const result = emitCpp(parsed.root);
  assert.equal(result.source, "((2 + (3 * 4)))");
  assert.equal(result.diagnostics.length, 0);
});

test("recovers malformed indentation and reports it", () => {
  const parsed = parseAstDump("ParenExpr 'int'\n    `-IntegerLiteral 'int' 0");
  assert.equal(parsed.nodeCount, 2);
  assert.match(parsed.diagnostics[0].message, /Missing parent/);
});

test("unsupported nodes are reported and descendants remain visible", () => {
  const root = parseAstDump(
    "MysteryExpr 'int'\n`-IntegerLiteral 0x12 'int' 9",
  ).root;
  const result = emitCpp(root);
  assert.match(result.source, /unsupported MysteryExpr/);
  assert.match(result.source, /9/);
  assert.equal(result.diagnostics.length, 1);
});

test("implicit cast is omitted while written cast is retained", () => {
  const text =
    "CXXStaticCastExpr 0x1 'int' static_cast<int> <NoOp>\n`-ImplicitCastExpr 0x2 'int' <LValueToRValue>\n  `-DeclRefExpr 0x3 'int' Var 0x4 'x' 'int'";
  assert.equal(emitCpp(parseAstDump(text).root).source, "static_cast<int>(x)");
});

test("quotes and backslashes in a string literal are preserved", () => {
  const text = String.raw`StringLiteral 0x123 'const char[5]' lvalue "a\\\"b"`;
  assert.equal(emitCpp(parseAstDump(text).root).source, String.raw`"a\\\"b"`);
});

test("accepts stripped addresses and tree pointers with provenance", () => {
  const parsed = parseAstDump(
    "BinaryOperator 'int' '+'\n  IntegerLiteral 'int' 2\n  IntegerLiteral 'int' 3",
  );
  const emitted = emitCpp(parsed.root);
  assert.equal(emitted.source, "(2 + 3)");
  assert.equal(emitted.spans.length, 3);
  assert.equal(
    emitted.source.slice(
      emitted.spans.find((s) => s.id === 1).start,
      emitted.spans.find((s) => s.id === 1).end,
    ),
    "2",
  );
  assert.equal(parsed.diagnostics.length, 2);
});

test("suggests a likely node-kind typo", () => {
  const result = emitCpp(parseAstDump("IntgerLiteral 'int' 7").root);
  assert.match(result.diagnostics[0].message, /Did you mean IntegerLiteral/);
});

test("reports a typo in an ignored computed-value child", () => {
  const input =
    "PredefinedExpr 'const char[10]' __PRETTY_FUNCTION__\n`-StringLieral 'const char[10]' \"top level\"";
  const parsed = parseAstDump(input);
  const emitted = emitCpp(parsed.root);
  assert.equal(emitted.source, "__PRETTY_FUNCTION__");
  assert.match(
    emitted.diagnostics[0].message,
    /Unsupported AST node: StringLieral/,
  );
  assert.equal(emitted.diagnostics[0].line, 2);
});
