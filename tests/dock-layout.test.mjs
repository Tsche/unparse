import test from "node:test";
import assert from "node:assert/strict";
import {
  leaf,
  split,
  removePane,
  insertPane,
  movePane,
  paneIds,
} from "../src/ui/dock-layout.js";

test("dock below and beside a target", () => {
  const initial = split("row", leaf("a"), leaf("b"));
  const below = movePane(initial, "a", "b", "bottom");
  assert.equal(below.direction, "column");
  assert.deepEqual(paneIds(below), ["b", "a"]);
  const beside = insertPane(below, "c", "a", "right");
  assert.deepEqual(paneIds(beside), ["b", "a", "c"]);
});

test("removing a pane collapses its split", () => {
  assert.deepEqual(
    removePane(split("row", leaf("a"), leaf("b")), "a"),
    leaf("b"),
  );
});
