import test from "node:test";
import assert from "node:assert/strict";
import { syntax } from "../src/ui/shared.js";

test("quoted C++ types in text AST receive inner syntax colors", () => {
  const html = syntax("DeclRefExpr 'const char *' Var 'name'", "ast");
  assert.match(html, /token-punctuation.*&#39;/);
  assert.match(html, /token-keyword.*const/);
  assert.match(html, /token-keyword.*char/);
  assert.match(html, /token-string.*name/);
});
