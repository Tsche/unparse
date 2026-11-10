import test from "node:test";
import assert from "node:assert/strict";
import { parseAstDump } from "../src/ast/text.js";
import { emitCpp } from "../src/emit/index.js";

const convert = (text) => {
  const parsed = parseAstDump(text);
  return { parsed, emitted: emitCpp(parsed.root) };
};

const cases = [
  [
    "missing addresses",
    "BinaryOperator 'int' '+'\n|-IntegerLiteral 'int' 2\n`-IntegerLiteral 'int' 3",
    "(2 + 3)",
  ],
  [
    "CRLF and blank lines",
    "\r\nBinaryOperator 'int' '+'\r\n\r\n|-IntegerLiteral 'int' 2\r\n`-IntegerLiteral 'int' 3\r\n",
    "(2 + 3)",
  ],
  [
    "stripped branch symbols",
    "BinaryOperator 'int' '+'\n  IntegerLiteral 'int' 2\n  IntegerLiteral 'int' 3",
    "(2 + 3)",
  ],
  [
    "mixed branch symbols",
    "BinaryOperator 'int' '+'\n|-IntegerLiteral 'int' 2\n  IntegerLiteral 'int' 3",
    "(2 + 3)",
  ],
  ["orphaned branch", "`-IntegerLiteral 'int' 2", "2"],
  [
    "missing operator",
    "BinaryOperator 'int'\n|-IntegerLiteral 'int' 2\n`-IntegerLiteral 'int' 3",
    "(2 /* op? */ 3)",
  ],
  [
    "missing operand",
    "BinaryOperator 'int' '+'\n`-IntegerLiteral 'int' 2",
    "/* malformed binary expression */",
  ],
];
for (const [name, input, expected] of cases)
  test(name, () => {
    const { emitted } = convert(input);
    assert.equal(emitted.source, expected);
    assert.ok(emitted.spans.length > 0);
  });

test("reports each recovered malformed line with original line number", () => {
  const { parsed } = convert(
    "\nBinaryOperator 'int' '+'\n  IntegerLiteral 'int' 2\n  IntegerLiteral 'int' 3",
  );
  assert.deepEqual(
    parsed.diagnostics.map((d) => d.line),
    [3, 4],
  );
});

test("skips an unreadable line while preserving following siblings", () => {
  const { parsed, emitted } = convert(
    "BinaryOperator 'int' '+'\n|-@bad\n|-IntegerLiteral 'int' 2\n`-IntegerLiteral 'int' 3",
  );
  assert.equal(emitted.source, "(2 + 3)");
  assert.match(parsed.diagnostics[0].message, /Could not read/);
  assert.equal(parsed.diagnostics[0].line, 2);
});

test("recovers a missing parent level with warning", () => {
  const { parsed, emitted } = convert(
    "ParenExpr 'int'\n  `-IntegerLiteral 'int' 7",
  );
  assert.equal(emitted.source, "(7)");
  assert.match(parsed.diagnostics[0].message, /Missing parent/);
});

test("keeps the first root and reports additional roots", () => {
  const { parsed, emitted } = convert(
    "IntegerLiteral 'int' 1\nIntegerLiteral 'int' 2",
  );
  assert.equal(emitted.source, "1");
  assert.equal(parsed.roots.length, 2);
  assert.match(parsed.diagnostics[0].message, /2 root nodes/);
});

test("all spans point inside the emitted string", () => {
  const { emitted } = convert(
    "BinaryOperator 'int' '+'\n|-IntegerLiteral 'int' 2\n`-IntegerLiteral 'int' 3",
  );
  for (const span of emitted.spans) {
    assert.ok(
      span.start >= 0 &&
        span.end <= emitted.source.length &&
        span.start <= span.end,
    );
  }
  assert.equal(
    emitted.source.slice(
      emitted.spans.find((s) => s.id === 0).start,
      emitted.spans.find((s) => s.id === 0).end,
    ),
    emitted.source,
  );
});

test("empty and oversized input fail with useful errors", () => {
  assert.throws(() => parseAstDump("  \n"), /Paste/);
  assert.throws(() => parseAstDump("x".repeat(1_000_001)), /1 MB/);
});

test("excessive nesting is bounded", () => {
  assert.throws(
    () => parseAstDump("ParenExpr\n" + "  ".repeat(256) + "`-IntegerLiteral 1"),
    /depth/,
  );
});

test("unsupported nodes retain children and provide a typo suggestion", () => {
  const { emitted } = convert("IntgerLiteral 'int' 7");
  assert.match(emitted.diagnostics[0].message, /IntegerLiteral/);
  assert.equal(emitted.status, "unsupported");
});

test("deterministic damaged-tree corpus never crashes or emits marker bytes", () => {
  const base = [
    "BinaryOperator 0x1 'int' '+'",
    "|-IntegerLiteral 0x2 'int' 2",
    "`-IntegerLiteral 0x3 'int' 3",
  ];
  const edits = [
    (line) => line.replace(/0x[0-9a-f]+/g, ""),
    (line) => line.replace(/[|`]-/g, "  "),
    (line) => line.replace(/'/g, ""),
    (line) => line.replace(/IntegerLiteral/, "IntgerLiteral"),
    (line) => "  " + line,
    (line) => line.slice(0, Math.max(1, line.length - 4)),
  ];
  for (let target = 0; target < base.length; target++) {
    for (const edit of edits) {
      const lines = [...base];
      lines[target] = edit(lines[target]);
      try {
        const { emitted } = convert(lines.join("\n"));
        assert.equal(typeof emitted.source, "string");
        assert.doesNotMatch(emitted.source, /[\uE000\uE001]/);
        for (const span of emitted.spans)
          assert.ok(span.start >= 0 && span.end <= emitted.source.length);
      } catch (error) {
        assert.match(error.message, /AST|node|Line|tree|input/i);
      }
    }
  }
});

test("a large but valid flat tree stays within limits", () => {
  const input =
    "MysteryExpr\n" +
    Array.from({ length: 2000 }, (_, i) => `|-IntegerLiteral 'int' ${i}`).join(
      "\n",
    );
  const { parsed, emitted } = convert(input);
  assert.equal(parsed.nodeCount, 2001);
  assert.equal(emitted.spans.length, 2001);
  assert.ok(emitted.source.includes("1999"));
});
