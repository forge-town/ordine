/**
 * @fileoverview Oxlint JS plugin: Disallow `let` declarations.
 * All variables must be declared with `const`.
 */

const noLetRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `let` declarations; use `const` instead",
    },
    messages: {
      noLet: "Unexpected `let` declaration. Use `const` instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === "let") {
          context.report({
            node,
            messageId: "noLet",
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "ordine-vars",
  },
  rules: {
    "no-let": noLetRule,
  },
};

export default plugin;
