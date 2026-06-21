/**
 * @fileoverview Oxlint JS plugin: Enforce exactly one blank line before return statements.
 */

function getSourceCode(context) {
  return context.getSourceCode ? context.getSourceCode() : context.sourceCode;
}

const newlineBeforeReturnRule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Enforce exactly one blank line before `return` statements",
    },
    messages: {
      expected:
        "Expected exactly one blank line before `return` statement.",
      unexpected:
        "Unexpected extra blank lines before `return` statement.",
    },
    schema: [],
    fixable: "whitespace",
  },
  create(context) {
    const sourceCode = getSourceCode(context);
    const allowedReturns = new WeakSet();

    /**
     * Marks a ReturnStatement as allowed (no blank line required)
     * when it is the direct body of an unbraced control statement.
     */
    function allowUnbracedReturn(node) {
      if (node.type === "ReturnStatement") {
        allowedReturns.add(node);
      } else if (node.type === "BlockStatement" && node.body.length === 1) {
        // e.g. if (x) { return; } — still inside braces, so we do NOT allow it
      }
    }

    return {
      // Control statements: allow return as direct body without braces
      IfStatement(node) {
        allowUnbracedReturn(node.consequent);
        if (node.alternate) {
          allowUnbracedReturn(node.alternate);
        }
      },
      ForStatement(node) {
        allowUnbracedReturn(node.body);
      },
      ForInStatement(node) {
        allowUnbracedReturn(node.body);
      },
      ForOfStatement(node) {
        allowUnbracedReturn(node.body);
      },
      WhileStatement(node) {
        allowUnbracedReturn(node.body);
      },
      DoWhileStatement(node) {
        allowUnbracedReturn(node.body);
      },
      WithStatement(node) {
        allowUnbracedReturn(node.body);
      },

      ReturnStatement(node) {
        if (allowedReturns.has(node)) {
          return;
        }

        const prevToken = sourceCode.getTokenBefore(node);
        if (!prevToken) {
          return;
        }

        // Skip if the previous token is on a different line and is an opening brace
        // (e.g., the first statement in a block) — no blank line required there.
        if (prevToken.type === "Punctuator" && prevToken.value === "{") {
          return;
        }

        const returnLine = node.loc.start.line;
        const prevLine = prevToken.loc.end.line;
        const blankLines = returnLine - prevLine - 1;

        if (blankLines < 1) {
          context.report({
            node,
            messageId: "expected",
            fix(fixer) {
              const range = [prevToken.range[1], node.range[0]];
              const textBetween = sourceCode.getText().slice(range[0], range[1]);
              // Insert one extra newline while preserving trailing indentation
              const newText = textBetween.replace(
                /(\r?\n)?([ \t]*)$/,
                (m, newline, indent) => newline ? newline + newline + indent : "\n" + m,
              );

              return fixer.replaceTextRange(range, newText);
            },
          });
        } else if (blankLines > 1) {
          context.report({
            node,
            messageId: "unexpected",
            fix(fixer) {
              const range = [prevToken.range[1], node.range[0]];
              const textBetween = sourceCode.getText().slice(range[0], range[1]);
              // Collapse multiple blank lines to exactly one while preserving trailing indentation
              const newText = textBetween.replace(
                /(\r?\n)(\r?\n)+([ \t]*)$/,
                "$1$1$3",
              );

              return fixer.replaceTextRange(range, newText);
            },
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "ordine-return",
  },
  rules: {
    "newline-before-return": newlineBeforeReturnRule,
  },
};

export default plugin;
