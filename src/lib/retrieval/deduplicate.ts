export function deduplicateDocuments<T extends { documentId: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.documentId)) return false;
    seen.add(item.documentId);
    return true;
  });
}
