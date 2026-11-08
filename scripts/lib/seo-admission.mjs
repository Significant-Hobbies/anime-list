// Popularity is a discovery preference, not evidence that a title has useful text.
// Only the public bootstrap snapshot is read; no user or live-account data enters
// this inventory. MAL identity must agree with the collection and numeric ID.
function hasSourceIdentity(entry, kind) {
  return (
    Number.isSafeInteger(entry.mal_id) &&
    entry.mal_id > 0 &&
    typeof entry.title === 'string' &&
    entry.title.trim().length > 0 &&
    typeof entry.url === 'string' &&
    new RegExp(`^https://myanimelist\\.net/${kind}/${entry.mal_id}(?:/|$)`).test(entry.url)
  );
}

function hasSubstantiveSynopsis(entry) {
  const synopsis = typeof entry.synopsis === 'string' ? entry.synopsis.trim() : '';
  return (
    synopsis.length >= 160 &&
    synopsis.split(/\s+/).length >= 25 &&
    !/^(?:no synopsis|no description|not available|to be added)/i.test(synopsis)
  );
}

function hasCatalogFacts(entry) {
  return (
    typeof entry.type === 'string' &&
    entry.type.length > 0 &&
    Number.isInteger(entry.year) &&
    entry.year >= 1900 &&
    entry.year <= 2100 &&
    Object.keys(entry.genres ?? {}).length > 0
  );
}

export function qualifies(entry, kind) {
  return hasSourceIdentity(entry, kind) && hasSubstantiveSynopsis(entry) && hasCatalogFacts(entry);
}
