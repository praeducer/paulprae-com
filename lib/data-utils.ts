/**
 * Shared data utilities used by both the pipeline and chat systems.
 */

/**
 * Recursively strip empty strings, null values, empty arrays, and
 * optionally fields in an omit set from an object tree.
 */
export function stripEmpty(obj: unknown, omitFields?: Set<string>): unknown {
  if (Array.isArray(obj)) {
    const filtered = obj
      .map((item) => stripEmpty(item, omitFields))
      .filter((item) => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (omitFields?.has(key)) continue;
      const cleaned = stripEmpty(value, omitFields);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // Scalar values: strip empty strings and nulls
  if (obj === null || obj === undefined || obj === "") return undefined;
  return obj;
}
