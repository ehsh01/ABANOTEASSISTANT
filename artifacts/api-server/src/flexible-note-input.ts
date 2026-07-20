export function scrubAssessmentNames(
  text: string,
  profile: { firstName?: string | null; lastName?: string | null } | null,
): string {
  let scrubbed = text;
  for (const candidate of [profile?.firstName, profile?.lastName]) {
    const name = candidate?.trim();
    if (!name || name.length < 2) continue;
    scrubbed = scrubbed.replace(
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi"),
      "the client",
    );
  }
  return scrubbed;
}

export function criterionPercentage(entry: {
  count: number | null;
  effectiveTrials: number[];
}): number | null {
  if (!Number.isInteger(entry.count) || entry.count == null || entry.count < 1) return null;
  const uniqueSuccessful = new Set(
    entry.effectiveTrials.filter(
      (trial) => Number.isInteger(trial) && trial >= 1 && trial <= entry.count!,
    ),
  );
  if (uniqueSuccessful.size !== entry.effectiveTrials.length) return null;
  return Math.round((uniqueSuccessful.size / entry.count) * 100);
}
