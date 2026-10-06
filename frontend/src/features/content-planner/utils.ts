export function buildContentBody(body: string, hashtags: string, mentions: string): string {
  return [body, hashtags, mentions].map((s) => s.trim()).filter(Boolean).join('\n\n');
}
