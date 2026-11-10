import test from "node:test";
import assert from "node:assert/strict";
import { clampSplit, splitFromPointer } from "../src/ui/split-math.js";

test("splitter respects minimum pane widths", () => {
  assert.equal(clampSplit(-10), 20);
  assert.equal(clampSplit(90), 80);
  assert.equal(splitFromPointer(400, 100, 600), 50);
  assert.equal(splitFromPointer(1000, 100, 600), 80);
});
