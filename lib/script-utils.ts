import path from "path";

/**
 * Check whether the current process was invoked directly as the given script.
 * Prevents `main()` from running when the module is imported by tests or other scripts.
 *
 * @param scriptBaseName - Script name without extension (e.g. "ingest-linkedin")
 */
export function isDirectRun(scriptBaseName: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.basename(invoked).replace(/\.[^.]+$/, "") === scriptBaseName;
}

/**
 * Check whether `--force` was passed on the command line.
 * Used by pipeline scripts to bypass skip-logic.
 */
export function hasForceFlag(): boolean {
  return process.argv.includes("--force");
}
