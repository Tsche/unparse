import { parseAstDump } from "./text.js";
import { parseJsonAst } from "./json.js";

/** Both adapters return the same node model and diagnostics shape. */
export function parseAst(input, format = "text") {
  if (format === "text") return parseAstDump(input);
  if (format === "json") return parseJsonAst(input);
  throw new Error(`Unknown AST input format: ${format}.`);
}
