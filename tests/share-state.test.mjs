import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync, strToU8 } from "fflate";
import { encodeShareState, decodeShareState } from "../src/ui/share-state.js";

const sample = readFileSync(
  new URL("../examples/assert-ast.txt", import.meta.url),
  "utf8",
);
const snapshot = {
  panes: [
    { type: "input", kind: "text", value: sample, title: null },
    {
      type: "output",
      inputIndex: 0,
      title: "Result",
      format: false,
      style: "Google",
      columnLimit: 100,
      indentWidth: 4,
      customConfig: "BasedOnStyle: Google",
    },
    {
      type: "input",
      kind: "json",
      value: '{"kind":"IntegerLiteral","value":"8"}',
      title: "Second AST",
    },
    {
      type: "output",
      inputIndex: 2,
      title: null,
      format: true,
      style: "LLVM",
      columnLimit: 80,
      indentWidth: 2,
      customConfig: "",
    },
  ],
  tree: [1, 37, [0, 62, 0, 1], [0, 44, 2, 3]],
  active: 2,
};

function rawToken(payload) {
  return Buffer.from(deflateSync(strToU8(JSON.stringify(payload)))).toString(
    "base64url",
  );
}

test("share state round trips panes, contents, settings, layout, and mobile selection", () => {
  const token = encodeShareState(snapshot);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShareState(token), snapshot);
  assert.ok(
    token.length < sample.length * 0.8,
    "repeated AST syntax is compressed",
  );
});

test("default formatter settings and titles are omitted from wire format", () => {
  const token = encodeShareState({
    panes: [
      { type: "input", kind: "text", value: "x", title: null },
      {
        type: "output",
        inputIndex: 0,
        title: null,
        format: true,
        style: "LLVM",
        columnLimit: 80,
        indentWidth: 2,
        customConfig: "",
      },
    ],
    tree: [0, 50, 0, 1],
    active: 0,
  });
  assert.ok(token.length < 80);
  assert.equal(decodeShareState(token).panes[1].style, "LLVM");
});

test("Unicode source and custom pane names survive URL encoding", () => {
  const value = {
    panes: [
      {
        type: "input",
        kind: "text",
        value: "StringLiteral 'char *' \"café ☃\"",
        title: "Über AST",
      },
    ],
    tree: 0,
    active: 0,
  };
  assert.deepEqual(decodeShareState(encodeShareState(value)), value);
});

test("malformed and hostile share links are rejected", () => {
  assert.throws(() => decodeShareState("bad!"), /decompressed|invalid/);
  assert.throws(() => decodeShareState("x".repeat(250001)), /too large/);
  const base = [
    1,
    [
      [0, 0, "x"],
      [1, 0],
    ],
    [0, 50, 0, 1],
    0,
  ];
  const cases = [
    [2, base[1], base[2], 0],
    [1, base[1], [0, 50, 0, 0], 0],
    [1, base[1], base[2], 9],
    [
      1,
      [
        [0, 0, "x"],
        [1, 0],
        [1, 0],
      ],
      [0, 50, 0, [1, 50, 1, 2]],
      0,
    ],
    [
      1,
      [
        [0, 0, "x"],
        [1, 9],
      ],
      base[2],
      0,
    ],
    [
      1,
      [
        [0, 0, "x"],
        [1, 0, null, [null, "Unknown"]],
      ],
      base[2],
      0,
    ],
  ];
  for (const payload of cases)
    assert.throws(() => decodeShareState(rawToken(payload)));
});

test("oversized source cannot create a share token", () => {
  assert.throws(
    () =>
      encodeShareState({
        panes: [{ type: "input", kind: "text", value: "x".repeat(2_000_001) }],
        tree: 0,
        active: 0,
      }),
    /too large/,
  );
});
