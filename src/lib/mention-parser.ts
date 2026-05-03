const MENTION_REGEX = /@([a-zA-Z0-9_\s.]+?)(?=\s|$|@)/g;

export function splitMentions(content: string): Array<{
  text: string;
  mention: boolean;
}> {
  const parts: Array<{ text: string; mention: boolean }> = [];
  let cursor = 0;

  for (const match of content.matchAll(MENTION_REGEX)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ text: content.slice(cursor, index), mention: false });
    }
    parts.push({ text: match[0], mention: true });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ text: content.slice(cursor), mention: false });
  }

  return parts;
}
