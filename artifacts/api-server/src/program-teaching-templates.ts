/**
 * Deterministic, program-specific teaching/prompting clauses for common skill and replacement
 * programs. Used only when the model (or fallback) emits thin generic boilerplate such as
 * "modeling the target response and prompting the client through the presented opportunities".
 * Never invents trial percentages, prompt levels, or client outcomes — only RBT teaching actions
 * that match the program name already assigned from the session catalog.
 */

const GENERIC_TEACHING_RE =
  /^(?:modeling the target response and prompting the client(?:\s+through the presented opportunities|\s+before reinforcement was delivered)?|implementing the assigned (?:program|intervention) as outlined in the treatment plan)\.?$/i;

export function isGenericTeachingOrPromptingSummary(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return true;
  if (t.length < 40) return true;
  return GENERIC_TEACHING_RE.test(t);
}

/**
 * Return a gerund-phrase teaching clause suitable after `by` for the given replacement program
 * when the current teaching text is thin/generic. Returns the original text when it already has
 * program-specific detail, or when no template is known (do not invent).
 */
export function enrichTeachingOrPromptingForProgram(
  teachingOrPromptingSummary: string,
  replacementProgramName: string,
): string {
  const current = teachingOrPromptingSummary.trim().replace(/\s+/g, " ");
  if (current && !isGenericTeachingOrPromptingSummary(current)) {
    return current;
  }

  const name = replacementProgramName.trim();
  const n = name.toLowerCase();

  if (/\bechoic\b/.test(n)) {
    return "presenting a brief vocal model, pausing to allow imitation, and delivering an echoic prompt when the client did not respond independently";
  }
  if (/\bimprove\s+eye\s+contact\b/.test(n)) {
    return "positioning instructional materials near eye level, prompting brief orientation toward the RBT or materials, and delivering praise after the client looked toward the presented item";
  }
  if (/\brespond(?:ing)?\s+to\s+(?:own|his|her|their)\s+name\b/.test(n) || /\bresponse\s+to\s+(?:own|his|her|their)\s+name\b/.test(n)) {
    return "calling the client's name once from a short distance, waiting briefly for an orienting response, and prompting a head turn or look toward the speaker when no independent response occurred";
  }
  if (/\bpre-?requisite\s+skills?\b/.test(n)) {
    return "presenting simple readiness tasks at the work table with materials placed within reach and prompting the client to orient toward and engage with the presented materials";
  }
  if (/\bfollow\s+demands?\s+after\s+the\s+first\s+prompt\b/.test(n)) {
    return "delivering one clear instruction, allowing the programmed response interval, and using the approved prompt when the client did not initiate the response independently";
  }
  if (/^time on task$/i.test(name) || /\bon[- ]?task(?:\s+behavior)?$/i.test(name)) {
    return "prompting the client to remain with the assigned activity, redirecting attention to the materials, and reinforcing continued engagement for the programmed interval";
  }
  if (/walk within close|close distance|safety skills?/i.test(n)) {
    return "arranging walking opportunities, prompting the client to remain within the programmed distance of the adult, and reinforcing safe walking";
  }
  if (/\bfunctional communication|\bfct\b/.test(n)) {
    return "modeling the designated functional communication response, prompting the client to use that response before continuing the task, and immediately reinforcing the communication response";
  }
  if (/\brequest\s+help\b/.test(n) || /\brequesting\s+help\b/.test(n)) {
    return "arranging a task that required assistance, waiting for an independent help request, and prompting the client to use the designated communication response before providing help";
  }
  if (/\brequest\s+(?:for\s+)?break\b/.test(n) || /\brequesting\s+(?:a\s+)?break\b/.test(n)) {
    return "presenting a brief demand, prompting the client to use the designated break request, and delivering a short break contingent on the communication response";
  }
  if (/\baccept\s+['"]?no['"]?\s+as\s+an\s+answer\b/.test(n)) {
    return "stating that the preferred item or activity was unavailable, prompting an appropriate acceptance response, and reinforcing calm acceptance without escalation";
  }
  if (/\btransition\s+compatible\s+with\s+ablls/i.test(n)) {
    return "signaling the upcoming transition, prompting the client to leave the current activity and move to the next designated area, and reinforcing an appropriate transition";
  }
  if (/\bmanding\b/.test(n)) {
    return "arranging a motivation for a preferred item or activity, prompting a clear mand, and delivering the item contingent on the prompted or independent mand";
  }

  // Keep generic only when we have no safer program-specific template.
  return current || "modeling the target response and prompting the client through the presented opportunities";
}
