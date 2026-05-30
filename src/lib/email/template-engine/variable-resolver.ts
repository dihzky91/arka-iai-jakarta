/**
 * Resolve {{variable}} placeholders in a string with actual values.
 * Unresolved variables are replaced with empty string.
 */
export function resolveVariables(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmedKey = key.trim();
    return variables[trimmedKey] ?? "";
  });
}

/**
 * Escape HTML special characters to prevent XSS in email content.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolve variables with HTML escaping for safe injection into HTML content.
 */
export function resolveVariablesSafe(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey] ?? "";
    return escapeHtml(value);
  });
}
