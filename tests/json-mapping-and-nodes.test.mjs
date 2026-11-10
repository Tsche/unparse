import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonAst } from "../src/ast/json.js";
import { formatJsonAst } from "../src/ast/format-json.js";
import { emitCpp } from "../src/emit/index.js";
import { indexTree, nodeAtLine } from "../src/ui/provenance.js";

function output(value) {
  return emitCpp(parseJsonAst(JSON.stringify(value)).root);
}

test("JSON positions follow inner nodes rather than unrelated kind metadata", () => {
  const source = JSON.stringify(
    {
      kind: "CallExpr",
      inner: [
        {
          kind: "DeclRefExpr",
          referencedDecl: { kind: "FunctionDecl", name: "f" },
        },
        { kind: "IntegerLiteral", value: "7" },
      ],
    },
    null,
    2,
  );
  const parsed = parseJsonAst(source);
  const index = indexTree(parsed.root);
  const metadataLine = source
    .slice(0, source.indexOf('"FunctionDecl"'))
    .split("\n").length;
  const literalLine = source
    .slice(0, source.indexOf('"IntegerLiteral"'))
    .split("\n").length;
  assert.equal(nodeAtLine(index, metadataLine), parsed.root.children[0].id);
  assert.equal(nodeAtLine(index, literalLine), parsed.root.children[1].id);
  assert.equal(emitCpp(parsed.root).source, "f(7)");
});

test("JSON source ranges remain correct with escaped kind strings and repeated names", () => {
  const source = JSON.stringify(
    {
      kind: "CallExpr",
      note: 'kind: "IntegerLiteral"',
      inner: [
        { kind: "DeclRefExpr", referencedDecl: { name: "f" } },
        { kind: "StringLiteral", value: "kind: IntegerLiteral" },
      ],
    },
    null,
    2,
  );
  const parsed = parseJsonAst(source);
  const child = parsed.root.children[1];
  assert.match(
    source.slice(child.provenance.start, child.provenance.end),
    /StringLiteral/,
  );
  assert.equal(
    source.slice(child.provenance.start, child.provenance.end).startsWith("{"),
    true,
  );
});

test("JSON formatter compacts metadata without changing the AST", () => {
  const source = JSON.stringify(
    {
      kind: "CallExpr",
      type: { qualType: "int" },
      inner: [
        {
          kind: "DeclRefExpr",
          referencedDecl: { kind: "FunctionDecl", name: "f" },
        },
        { kind: "IntegerLiteral", value: "7" },
      ],
    },
    null,
    2,
  );
  const formatted = formatJsonAst(source);
  assert.match(formatted, /"type": \{"qualType":"int"\}/);
  assert.deepEqual(JSON.parse(formatted), JSON.parse(source));
  assert.equal(emitCpp(parseJsonAst(formatted).root).source, "f(7)");
});

test("common declaration, statement, and C++ expression families reconstruct", () => {
  const tree = {
    kind: "TranslationUnitDecl",
    inner: [
      {
        kind: "FunctionDecl",
        name: "f",
        type: { qualType: "int (int)" },
        inner: [
          { kind: "ParmVarDecl", name: "x", type: { qualType: "int" } },
          {
            kind: "CompoundStmt",
            inner: [
              {
                kind: "ReturnStmt",
                inner: [
                  {
                    kind: "BinaryOperator",
                    opcode: "+",
                    inner: [
                      { kind: "DeclRefExpr", referencedDecl: { name: "x" } },
                      { kind: "IntegerLiteral", value: "1" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(output(tree).source, "int f(int x) {\nreturn (x + 1);\n}");
  assert.equal(
    output({ kind: "CXXNewExpr", type: { qualType: "int *" } }).source,
    "new int",
  );
  assert.equal(
    output({
      kind: "InitListExpr",
      inner: [
        { kind: "IntegerLiteral", value: "1" },
        { kind: "IntegerLiteral", value: "2" },
      ],
    }).source,
    "{1, 2}",
  );
});

test("ForStmt keeps JSON child slots when optional clauses are null", () => {
  const tree = {
    kind: "ForStmt",
    inner: [
      null,
      null,
      { kind: "CXXBoolLiteralExpr", value: true },
      null,
      { kind: "CompoundStmt", inner: [{ kind: "BreakStmt" }] },
    ],
  };
  const parsed = parseJsonAst(JSON.stringify(tree));
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(emitCpp(parsed.root).source, "for (; true; ) {\nbreak;\n}");
});
