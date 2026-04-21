export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_\-]/g, "");
}

export function parseTagInput(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map(normalizeTag)
    .filter(Boolean);
}

export function formatTag(tag: string): string {
  return `#${tag}`;
}

export function mergeTags(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}
