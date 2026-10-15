function normalizedProgramKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Preserve the first spelling while removing case/spacing-equivalent program names. */
export function dedupeProgramNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = normalizedProgramKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/**
 * A PDF may emit the same program under replacement and skill-acquisition sections.
 * Keep the first replacement spelling and remove that name from the skill list.
 */
export function dedupeImportedProgramLists(params: {
  replacementPrograms: readonly string[];
  skillAcquisitionPrograms: readonly string[];
}): { replacementPrograms: string[]; skillAcquisitionPrograms: string[] } {
  const replacementPrograms = dedupeProgramNames(params.replacementPrograms);
  const replacementKeys = new Set(replacementPrograms.map(normalizedProgramKey));
  const skillAcquisitionPrograms = dedupeProgramNames(params.skillAcquisitionPrograms).filter(
    (name) => !replacementKeys.has(normalizedProgramKey(name)),
  );
  return { replacementPrograms, skillAcquisitionPrograms };
}
