import { structuralHandlers } from "./structural.js";
import { expressionHandlers } from "./expressions.js";
import { castHandlers } from "./casts.js";
import { literalHandlers } from "./literals.js";
import { declarationHandlers } from "./declarations.js";
import { statementHandlers } from "./statements.js";
import { cxxExpressionHandlers } from "./cxx-expressions.js";

/** Register a new Clang node handler in the relevant family module. */
export const handlers = {
  ...structuralHandlers,
  ...expressionHandlers,
  ...castHandlers,
  ...literalHandlers,
  ...declarationHandlers,
  ...statementHandlers,
  ...cxxExpressionHandlers,
};
