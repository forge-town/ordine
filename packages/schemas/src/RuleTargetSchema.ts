/**
 * The object passed to a rule's default-export check function.
 * The script must export default: (target: RuleTarget) => boolean | Promise<boolean>
 * Return true = pass, false = fail.
 */
export interface RuleTarget {
  path: string;
  type: "file" | "folder" | "project";
}
