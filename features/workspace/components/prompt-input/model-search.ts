export interface SearchableModelLike {
  id?: string | null;
  name: string;
  provider: string;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesModelSearch(
  query: string,
  model: SearchableModelLike,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeSearchText(
    [model.name, model.provider, model.id ?? ""].join(" "),
  );
  if (!haystack) return false;

  const words = haystack.split(/\s+/).filter(Boolean);
  return normalizedQuery.split(/\s+/).every((token) => {
    if (!token) return true;
    if (haystack.includes(token)) return true;
    return words.some(
      (word) => word.startsWith(token) || word.includes(token),
    );
  });
}
