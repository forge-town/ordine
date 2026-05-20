/**
 * @fileoverview Oxlint JS plugin: Disallow try-catch / try-finally statements.
 * Use neverthrow for functional error handling instead.
 */

const noTryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `try` statements. Use neverthrow for functional error handling instead.",
    },
    messages: {
      noTry:
        "Unexpected `try` statement. Use neverthrow (Result, ok, err) for functional error handling instead of try-catch.",
    },
    schema: [],
  },
  create(context) {
    return {
      TryStatement(node) {
        context.report({
          node,
          messageId: "noTry",
        });
      },
    };
  },
};

const plugin = {
  meta: {
    name: "ordine-error",
  },
  rules: {
    "no-try": noTryRule,
  },
};

export default plugin;
