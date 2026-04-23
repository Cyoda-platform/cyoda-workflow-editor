/**
 * Deterministic pretty stringify — 2-space indent, LF line endings, trailing newline.
 * Assumes input object has its keys in the desired emission order; we preserve
 * insertion order (as V8 does for string keys).
 */
export function prettyStringify(value: unknown): string {
  const body = JSON.stringify(value, null, 2);
  // JSON.stringify uses system line endings in most runtimes, but the spec
  // uses \n between tokens. Force LF regardless of host.
  const lfOnly = body.replace(/\r\n/g, "\n");
  return lfOnly + "\n";
}
