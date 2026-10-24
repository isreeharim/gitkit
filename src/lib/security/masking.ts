/**
 * Deterministically masks secret values to guarantee no actual credentials
 * are exposed in the UI, logs, or reports.
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';

  const trimmed = secret.trim();
  const len = trimmed.length;

  if (len <= 8) {
    return '••••••••';
  }

  if (len <= 16) {
    return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
  }

  // For longer keys (e.g. 20-80 chars like GitHub tokens, AWS keys)
  const prefixLen = Math.min(4, Math.floor(len / 4));
  const suffixLen = Math.min(4, Math.floor(len / 4));
  return `${trimmed.slice(0, prefixLen)}••••••••••••${trimmed.slice(-suffixLen)}`;
}

/**
 * Masks any occurrence of a secret within a code snippet or evidence line.
 */
export function maskEvidenceSnippet(snippet: string, secretValue: string): string {
  if (!snippet || !secretValue) return snippet;

  const masked = maskSecret(secretValue);
  return snippet.replaceAll(secretValue, masked);
}
