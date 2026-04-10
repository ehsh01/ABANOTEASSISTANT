/**
 * Canonical session delivery locations (wizard + POST /notes/generate `therapySetting`).
 * Opening prose uses {@link therapySettingLocationPhrase} — keep in sync with OpenAPI enum.
 */

export const THERAPY_SETTINGS_ORDERED = [
  "Seasonal Residence",
  "Walk-in Retail Health Clinic",
  "Neighbor Residence",
  "Office",
  "Prescribed Pediatric Extended Care (PPEC) Center",
  "Relative Residence",
  "School",
  "School/Community",
  "School/Home",
  "Home",
  "Home/School",
  "Home/Community",
  "Home/Daycare",
  "Independent Clinic",
  "Medical Facility",
  "Member Home",
  "Comprehensive Outpatient Rehab Facility",
  "Daycare",
  "Daycare/Community",
  "Daycare/Home",
  "Family Home",
  "Friend Residence",
  "Group Home",
  "Assisted Living Facility (ALF)",
  "Community Mental Health Center",
  "Community",
  "Community/Daycare",
  "Community/Home",
  "Community/School",
] as const;

export type TherapySetting = (typeof THERAPY_SETTINGS_ORDERED)[number];

/** Non-empty tuple for Zod `z.enum(...)`. */
export const THERAPY_SETTING_ZOD_ENUM: [TherapySetting, ...TherapySetting[]] =
  THERAPY_SETTINGS_ORDERED as unknown as [TherapySetting, ...TherapySetting[]];

const LEGACY_SLUGS: Record<string, TherapySetting> = {
  home: "Home",
  school: "School",
  community: "Community",
};

/** Maps older API values (`home` / `school` / `community`) to current catalog strings. */
export function normalizeLegacyTherapySetting(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower in LEGACY_SLUGS) return LEGACY_SLUGS[lower]!;
  return t;
}

export function isTherapySetting(value: string): value is TherapySetting {
  return (THERAPY_SETTINGS_ORDERED as readonly string[]).includes(value);
}

/**
 * Phrase inserted in the locked opening after caregivers (`... and Mother **at school** to implement...`).
 * Do not paraphrase outside this map for assembly.
 */
const OPENING_PHRASE: Record<TherapySetting, string> = {
  "Seasonal Residence": "at a seasonal residence",
  "Walk-in Retail Health Clinic": "at a walk-in retail health clinic",
  "Neighbor Residence": "at a neighbor's residence",
  Office: "in an office setting",
  "Prescribed Pediatric Extended Care (PPEC) Center": "at a Prescribed Pediatric Extended Care (PPEC) center",
  "Relative Residence": "at a relative's residence",
  School: "at school",
  "School/Community": "at school and in the community",
  "School/Home": "at school and at home",
  Home: "at home",
  "Home/School": "at home and at school",
  "Home/Community": "at home and in the community",
  "Home/Daycare": "at home and at daycare",
  "Independent Clinic": "at an independent clinic",
  "Medical Facility": "at a medical facility",
  "Member Home": "at the member's home",
  "Comprehensive Outpatient Rehab Facility": "at a comprehensive outpatient rehabilitation facility",
  Daycare: "at daycare",
  "Daycare/Community": "at daycare and in the community",
  "Daycare/Home": "at daycare and at home",
  "Family Home": "at a family home",
  "Friend Residence": "at a friend's residence",
  "Group Home": "at a group home",
  "Assisted Living Facility (ALF)": "at an assisted living facility (ALF)",
  "Community Mental Health Center": "at a community mental health center",
  Community: "in the community",
  "Community/Daycare": "in the community and at daycare",
  "Community/Home": "in the community and at home",
  "Community/School": "in the community and at school",
};

export function therapySettingLocationPhrase(setting: TherapySetting): string {
  return OPENING_PHRASE[setting];
}
