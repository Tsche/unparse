import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonAst } from "../src/ast/json.js";
import { emitCpp } from "../src/emit/index.js";

test("converts Clang JSON expression nodes", () => {
  const input = JSON.stringify(
    {
      kind: "BinaryOperator",
      opcode: "+",
      type: { qualType: "int" },
      inner: [
        { kind: "IntegerLiteral", value: "2", type: { qualType: "int" } },
        { kind: "IntegerLiteral", value: "3", type: { qualType: "int" } },
      ],
    },
    null,
    2,
  );
  const parsed = parseJsonAst(input);
  assert.equal(parsed.nodeCount, 3);
  assert.equal(emitCpp(parsed.root).source, "(2 + 3)");
  assert.ok(parsed.root.children[0].line > 1);
});

test("rejects malformed JSON and malformed inner arrays", () => {
  assert.throws(() => parseJsonAst("{bad"), /Invalid AST JSON/);
  assert.throws(
    () => parseJsonAst('{"kind":"CallExpr","inner":{}}'),
    /inner.*array/,
  );
});

test("handles Clang string literal spelling and nested referencedDecl metadata", () => {
  const input = JSON.stringify(
    {
      kind: "CallExpr",
      inner: [
        {
          kind: "DeclRefExpr",
          referencedDecl: { kind: "FunctionDecl", name: "f" },
        },
        { kind: "StringLiteral", value: '"hello"' },
      ],
    },
    null,
    2,
  );
  const parsed = parseJsonAst(input);
  assert.equal(emitCpp(parsed.root).source, 'f("hello")');
  assert.match(
    input.split("\n")[parsed.root.children[1].line - 1],
    /StringLiteral/,
  );
});

test("skips untyped JSON children with a line diagnostic", () => {
  const parsed = parseJsonAst(
    JSON.stringify(
      {
        kind: "CallExpr",
        inner: [
          null,
          {},
          { kind: "DeclRefExpr", referencedDecl: { name: "run" } },
        ],
      },
      null,
      2,
    ),
  );
  assert.equal(parsed.nodeCount, 2);
  assert.equal(parsed.diagnostics.length, 2);
  assert.ok(parsed.diagnostics.every((diagnostic) => diagnostic.line > 0));
  assert.equal(emitCpp(parsed.root).source, "run()");
});
