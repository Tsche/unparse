import test from "node:test";
import assert from "node:assert/strict";
import { format } from "@wasm-fmt/clang-format";

test("installed clang-format accepts custom YAML configuration", () => {
  const source = "call(1,2,3);\n";
  const result = format(
    source,
    "test.cc",
    "BasedOnStyle: LLVM\nColumnLimit: 120\nSpacesInContainerLiterals: true",
  );
  assert.match(result, /call\(1, 2, 3\)/);
});
