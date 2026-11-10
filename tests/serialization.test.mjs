import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convertAst, toJsonNode } from "../src/ast/serialize.js";
import { parseAst } from "../src/ast/index.js";
import { emitCpp } from "../src/emit/index.js";

const example = (name) =>
  readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8");

test("text to JSON and back preserves the assert example reconstruction", () => {
  const text = example("assert-ast.txt");
  const json = convertAst(text, "text", "json");
  const back = convertAst(json, "json", "text");
  assert.equal(
    emitCpp(parseAst(json, "json").root).source,
    emitCpp(parseAst(text, "text").root).source,
  );
  assert.equal(
    emitCpp(parseAst(back, "text").root).source,
    emitCpp(parseAst(text, "text").root).source,
  );
});

test("JSON to text keeps a branching expression readable", () => {
  const json = JSON.stringify({
    kind: "BinaryOperator",
    opcode: "+",
    type: { qualType: "int" },
    inner: [
      { kind: "IntegerLiteral", type: { qualType: "int" }, value: "2" },
      { kind: "IntegerLiteral", type: { qualType: "int" }, value: "3" },
    ],
  });
  const text = convertAst(json, "json", "text");
  assert.match(text, /\|-IntegerLiteral/);
  assert.match(text, /`-IntegerLiteral/);
  assert.equal(emitCpp(parseAst(text, "text").root).source, "(2 + 3)");
});

test("sample JSON can omit round-trip metadata", () => {
  const root = parseAst(example("arithmetic-ast.txt"), "text").root;
  const json = toJsonNode(root, { preserveTextMetadata: false });
  assert.equal(json.kind, "ParenExpr");
  assert.equal("unparseTextMetadata" in json, false);
  assert.equal(
    emitCpp(parseAst(JSON.stringify(json), "json").root).source,
    "((2 + (3 * 4)))",
  );
});
