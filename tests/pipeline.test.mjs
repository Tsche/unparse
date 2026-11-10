import test from "node:test";
import assert from "node:assert/strict";
import { parseAst } from "../src/ast/index.js";
import { emitCpp } from "../src/emit/index.js";

test("text and JSON adapters produce equivalent semantic attributes", () => {
  const text = parseAst(
    "BinaryOperator 'int' '+'\n|-IntegerLiteral 'int' 8\n`-IntegerLiteral 'int' 5",
    "text",
  );
  const json = parseAst(
    JSON.stringify({
      kind: "BinaryOperator",
      opcode: "+",
      type: { qualType: "int" },
      inner: [
        { kind: "IntegerLiteral", value: "8", type: { qualType: "int" } },
        { kind: "IntegerLiteral", value: "5", type: { qualType: "int" } },
      ],
    }),
    "json",
  );
  assert.equal(emitCpp(text.root).source, "(8 + 5)");
  assert.equal(emitCpp(json.root).source, "(8 + 5)");
  assert.equal(text.root.attributes.operator, json.root.attributes.operator);
  assert.equal(json.root.raw.opcode, "+");
  assert.equal(text.root.raw, "BinaryOperator 'int' '+'");
});

test("unknown Clang node kinds are preserved and reported by the emitter", () => {
  const parsed = parseAst(
    JSON.stringify({
      kind: "FutureClangExpr",
      newField: "kept",
      inner: [{ kind: "IntegerLiteral", value: "4" }],
    }),
    "json",
  );
  const emitted = emitCpp(parsed.root);
  assert.equal(parsed.root.raw.newField, "kept");
  assert.match(emitted.source, /unsupported FutureClangExpr/);
  assert.match(emitted.source, /4/);
  assert.equal(emitted.status, "unsupported");
});

test("rejects unknown adapter names", () => {
  assert.throws(() => parseAst("{}", "yaml"), /Unknown AST input format/);
});
