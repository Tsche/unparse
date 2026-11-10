#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseAst } from "../src/ast/index.js";
import { emitCpp } from "../src/emit/index.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const path = args.find((arg) => arg !== "--json");
if (!path) {
  console.error("Usage: npm run convert -- [--json] path/to/ast-dump");
  process.exitCode = 2;
} else {
  try {
    const format = json || path.endsWith(".json") ? "json" : "text";
    const parsed = parseAst(readFileSync(path, "utf8"), format);
    const emitted = emitCpp(parsed.root);
    const diagnostics = [...parsed.diagnostics, ...emitted.diagnostics];
    console.log(emitted.source);
    console.error(
      `\n${parsed.nodeCount} nodes; ${diagnostics.length} diagnostic(s).`,
    );
    for (const diagnostic of diagnostics) {
      console.error(`line ${diagnostic.line}: ${diagnostic.message}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
