/**
 * Offline A/B quality eval for note-generation models.
 *
 * Runs a fixed set of DE-IDENTIFIED session fixtures through the REAL generation pipeline
 * (`generateClinicalBodyOpenAI`: model call -> structured validators -> repair loop -> deterministic
 * assembly -> final validators) once per model, several repetitions each, and prints a comparison of
 * quality signals (critical/validator issues, warnings, repair passes, program/behavior repeats) plus
 * cost (latency, tokens).
 *
 * This does NOT touch the database and uses no client PHI — only the fixtures below.
 *
 * Usage (from artifacts/api-server):
 *   OPENAI_API_KEY=sk-... npx tsx scripts/model-eval.mts
 *   OPENAI_API_KEY=sk-... npx tsx scripts/model-eval.mts --models=gpt-5.5,gpt-5,gpt-4.1 --reps=3 --out=./model-eval-out
 *
 * Flags:
 *   --models=a,b,c   Comma-separated model ids to compare (default: gpt-5.5,gpt-5,gpt-4.1)
 *   --reps=N         Repetitions per (model, case) to average out model randomness (default: 3)
 *   --out=DIR        If set, also write each generated note to DIR/<model>/<case>-<rep>.txt
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";
import {
  generateClinicalBodyOpenAI,
  type NoteGenerationContext,
} from "../src/openai-notes";

type EvalCase = {
  id: string;
  description: string;
  context: NoteGenerationContext;
};

function makeContext(overrides: Partial<NoteGenerationContext>): NoteGenerationContext {
  return {
    clientName: "the client",
    firstName: "the client",
    gender: null,
    sessionHours: 1,
    narrativeSegmentCount: 1,
    sessionDate: "2026-07-14",
    therapySetting: "Home",
    presentPeople: ["Mother"],
    hasEnvironmentalChanges: false,
    environmentalChanges: "",
    maladaptiveBehaviors: ["Task Refusal"],
    maladaptiveBehaviorTargets: [],
    maladaptiveBehaviorForHour: ["Task Refusal"],
    interventions: ["Premack principle"],
    replacementProgramsInOrder: ["Request for Break"],
    replacementProgramForHour: ["Request for Break"],
    rbtActionsOnlyOutcomeForHour: [false],
    requestNonce: "model-eval",
    clientAgeYears: 8,
    ageBand: null,
    clientAssessmentTextExcerpt:
      "Task Refusal is defined as pushing task materials away and turning the head from the work area.",
    assessmentReferenceFileName: "bip.pdf",
    reinforcementPreferences: [],
    activityAntecedentForHour: [null],
    languageMaladaptiveEpisodeForHour: [false],
    therapistTrialSummaryForReplacementHour: [null],
    acquisitionOnlySegmentForHour: [false],
    maladaptiveBehaviorFunctionsForHour: [["escape"]],
    maladaptiveBehaviorTopographyForHour: [
      "pushing task materials away and turning the head from the work area",
    ],
    behaviorReplacementCandidatesForHour: [["Request for Break"]],
    interventionCandidatesForHour: [["Premack principle"]],
    behaviorToReplacementsMap: { "Task Refusal": ["Request for Break"] },
    ...overrides,
  };
}

/** De-identified fixtures covering the scenarios that most often expose model-quality differences. */
const EVAL_CASES: EvalCase[] = [
  {
    id: "single-hour-task-refusal",
    description: "1 hour, escape-function Task Refusal (baseline)",
    context: makeContext({}),
  },
  {
    id: "multi-hour-distinct-programs",
    description:
      "5 hours, 5 distinct behaviors sharing escape/attention functions (tests program distinctness + rotation)",
    context: makeContext({
      sessionHours: 5,
      narrativeSegmentCount: 5,
      maladaptiveBehaviors: [
        "Verbal Aggression",
        "Excessive Motor Behavior",
        "Physical Aggression",
        "Task Refusal",
        "Self-Injurious Behavior (SIB)",
      ],
      maladaptiveBehaviorForHour: [
        "Verbal Aggression",
        "Excessive Motor Behavior",
        "Physical Aggression",
        "Task Refusal",
        "Self-Injurious Behavior (SIB)",
      ],
      interventions: [
        "Premack principle",
        "Differential Reinforcement of Alternative Behaviors (DRA)",
        "Response Block",
        "Environmental Manipulation",
      ],
      replacementProgramsInOrder: [
        "Request for Break",
        "Accept alternatives when being redirected to more appropriate behavior",
        "Accept 'No' as an answer",
      ],
      replacementProgramForHour: [
        "Request for Break",
        "Accept alternatives when being redirected to more appropriate behavior",
        "Request for Break",
        "Accept 'No' as an answer",
        "Request for Break",
      ],
      rbtActionsOnlyOutcomeForHour: [false, false, false, false, false],
      activityAntecedentForHour: [null, null, null, null, null],
      languageMaladaptiveEpisodeForHour: [true, false, false, false, false],
      therapistTrialSummaryForReplacementHour: [null, null, null, null, null],
      acquisitionOnlySegmentForHour: [false, false, false, false, false],
      maladaptiveBehaviorFunctionsForHour: [
        ["escape"],
        ["automatic"],
        ["escape"],
        ["escape"],
        ["automatic"],
      ],
      maladaptiveBehaviorTopographyForHour: [
        'saying "I\'m not doing that" after an instruction',
        "turning the head from side to side while seated",
        "contacting any part of another person's body with foot; headbutts; scratching; pinching",
        "pushing task materials away and turning the head from the work area",
        "hitting the forehead with an open hand",
      ],
      behaviorReplacementCandidatesForHour: [
        ["Request for Break", "Accept 'No' as an answer"],
        ["Accept alternatives when being redirected to more appropriate behavior"],
        ["Request for Break", "Accept 'No' as an answer"],
        ["Accept 'No' as an answer", "Request for Break"],
        ["Request for Break"],
      ],
      interventionCandidatesForHour: [
        ["Premack principle"],
        ["Differential Reinforcement of Alternative Behaviors (DRA)"],
        ["Response Block", "Environmental Manipulation"],
        ["Premack principle"],
        ["Environmental Manipulation"],
      ],
      behaviorToReplacementsMap: {
        "Verbal Aggression": ["Request for Break", "Accept 'No' as an answer"],
        "Excessive Motor Behavior": [
          "Accept alternatives when being redirected to more appropriate behavior",
        ],
        "Physical Aggression": ["Request for Break", "Accept 'No' as an answer"],
        "Task Refusal": ["Accept 'No' as an answer", "Request for Break"],
        "Self-Injurious Behavior (SIB)": ["Request for Break"],
      },
      clientAssessmentTextExcerpt:
        "Physical Aggression: contacting another person's body with an open or closed hand, foot, or head. " +
        "Verbal Aggression: yelling or refusing instructions verbally. Excessive Motor Behavior: repetitive " +
        "head movement and hand flapping. Self-Injurious Behavior: hitting own head with an open hand.",
    }),
  },
  {
    id: "toddler-limited-verbal",
    description: "1 hour, young/limited-verbal client (tests avoidance of complex attributed speech)",
    context: makeContext({
      clientAgeYears: 3,
      maladaptiveBehaviors: ["Self-Injurious Behavior (SIB)"],
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
      maladaptiveBehaviorFunctionsForHour: [["automatic"]],
      maladaptiveBehaviorTopographyForHour: ["hitting the forehead with an open hand"],
      interventions: ["Environmental Manipulation"],
      interventionCandidatesForHour: [["Environmental Manipulation"]],
      replacementProgramsInOrder: ["Request for Break"],
      replacementProgramForHour: ["Request for Break"],
      behaviorReplacementCandidatesForHour: [["Request for Break"]],
      behaviorToReplacementsMap: { "Self-Injurious Behavior (SIB)": ["Request for Break"] },
      clientAssessmentTextExcerpt:
        "Self-Injurious Behavior is defined as hitting the forehead with an open hand.",
    }),
  },
];

type CaseResult = {
  ok: boolean;
  error?: string;
  body?: string;
  criticalIssues: number;
  validatorIssues: number;
  warnings: number;
  repairAttempts: number;
  segments: number;
  distinctPrograms: number;
  repeatedPrograms: number;
  distinctBehaviors: number;
  repeatedBehaviors: number;
  latencyMs: number;
  totalTokens: number;
  issueCodes: string[];
};

type ModelAggregate = {
  model: string;
  runs: number;
  failures: number;
  criticalIssues: number;
  validatorIssues: number;
  warnings: number;
  repairAttempts: number;
  repeatedPrograms: number;
  repeatedBehaviors: number;
  latencyMs: number;
  totalTokens: number;
  issueCodeCounts: Map<string, number>;
};

function parseArgs(argv: string[]): { models: string[]; reps: number; out: string | null } {
  const get = (name: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const models = (get("models") ?? "gpt-5.5,gpt-5,gpt-4.1")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const reps = Math.max(1, Number(get("reps") ?? "3") || 3);
  const out = get("out") ?? null;
  return { models, reps, out };
}

async function preflightAccessibleModels(client: OpenAI): Promise<Set<string> | null> {
  try {
    const set = new Set<string>();
    for await (const model of client.models.list()) {
      set.add(model.id);
    }
    return set;
  } catch (error) {
    console.warn(
      "  (could not list models for preflight; will attempt each model anyway):",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function runOnce(context: NoteGenerationContext): Promise<CaseResult> {
  try {
    const result = await generateClinicalBodyOpenAI(context);
    const segments = result.notePlan?.segments ?? [];
    const programNames = segments
      .map((s) => s.replacementLabel?.trim().toLowerCase())
      .filter((s): s is string => Boolean(s));
    const behaviorNames = segments
      .map((s) => s.behaviorLabel?.trim().toLowerCase())
      .filter((s): s is string => Boolean(s));
    const distinctPrograms = new Set(programNames).size;
    const distinctBehaviors = new Set(behaviorNames).size;
    const criticalIssues = result.finalIssues.filter((i) => i.severity === "blocking").length;
    const latencyMs = result.attemptHistory.reduce((t, a) => t + a.latencyMs, 0);
    const totalTokens = result.attemptHistory.reduce((t, a) => t + (a.usage?.totalTokens ?? 0), 0);
    return {
      ok: true,
      body: result.body,
      criticalIssues,
      validatorIssues: result.finalIssues.length,
      warnings: result.warnings.length,
      repairAttempts: result.repairAttempts,
      segments: segments.length,
      distinctPrograms,
      repeatedPrograms: Math.max(0, programNames.length - distinctPrograms),
      distinctBehaviors,
      repeatedBehaviors: Math.max(0, behaviorNames.length - distinctBehaviors),
      latencyMs,
      totalTokens,
      issueCodes: result.finalIssues.map((i) => i.code),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      criticalIssues: 0,
      validatorIssues: 0,
      warnings: 0,
      repairAttempts: 0,
      segments: 0,
      distinctPrograms: 0,
      repeatedPrograms: 0,
      distinctBehaviors: 0,
      repeatedBehaviors: 0,
      latencyMs: 0,
      totalTokens: 0,
      issueCodes: [],
    };
  }
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

function printComparison(aggregates: ModelAggregate[]): void {
  const cols: [string, (a: ModelAggregate) => string][] = [
    ["model", (a) => a.model],
    ["runs", (a) => String(a.runs)],
    ["fail", (a) => String(a.failures)],
    ["critical/run", (a) => avg(a.criticalIssues, a.runs)],
    ["validator/run", (a) => avg(a.validatorIssues, a.runs)],
    ["warn/run", (a) => avg(a.warnings, a.runs)],
    ["repairs/run", (a) => avg(a.repairAttempts, a.runs)],
    ["prog-repeat/run", (a) => avg(a.repeatedPrograms, a.runs)],
    ["beh-repeat/run", (a) => avg(a.repeatedBehaviors, a.runs)],
    ["latency ms/run", (a) => avg(a.latencyMs, a.runs, 0)],
    ["tokens/run", (a) => avg(a.totalTokens, a.runs, 0)],
  ];
  const widths = cols.map(([header], idx) =>
    Math.max(header.length, ...aggregates.map((a) => cols[idx]![1](a).length)),
  );
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i]!)).join("  ");
  console.log("\n=== Model quality comparison (lower is better, except runs) ===");
  console.log(line(cols.map(([h]) => h)));
  for (const a of aggregates) console.log(line(cols.map(([, f]) => f(a))));

  console.log("\n=== Top validator issue codes per model ===");
  for (const a of aggregates) {
    const top = [...a.issueCodeCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([code, n]) => `${code}:${n}`)
      .join(", ");
    console.log(`${a.model}: ${top || "(none)"}`);
  }
}

function avg(total: number, runs: number, decimals = 2): string {
  if (runs === 0) return "-";
  return (total / runs).toFixed(decimals);
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set. Export it and re-run.");
    process.exit(1);
  }
  const { models, reps, out } = parseArgs(process.argv.slice(2));
  const client = new OpenAI({ apiKey });

  console.log(`Models: ${models.join(", ")}`);
  console.log(`Cases:  ${EVAL_CASES.map((c) => c.id).join(", ")}`);
  console.log(`Reps:   ${reps} per (model, case)\n`);

  console.log("Preflight: checking model access...");
  const accessible = await preflightAccessibleModels(client);
  if (accessible) {
    for (const m of models) {
      console.log(`  ${accessible.has(m) ? "OK  " : "MISSING"} ${m}`);
    }
  }

  const aggregates: ModelAggregate[] = [];
  for (const model of models) {
    process.env.OPENAI_MODEL = model;
    const agg: ModelAggregate = {
      model,
      runs: 0,
      failures: 0,
      criticalIssues: 0,
      validatorIssues: 0,
      warnings: 0,
      repairAttempts: 0,
      repeatedPrograms: 0,
      repeatedBehaviors: 0,
      latencyMs: 0,
      totalTokens: 0,
      issueCodeCounts: new Map(),
    };
    for (const evalCase of EVAL_CASES) {
      for (let rep = 1; rep <= reps; rep++) {
        process.stdout.write(`\r[${model}] ${evalCase.id} rep ${rep}/${reps}            `);
        const r = await runOnce(evalCase.context);
        agg.runs++;
        if (!r.ok) {
          agg.failures++;
          console.log(`\n  ! ${model} ${evalCase.id} rep ${rep} failed: ${r.error}`);
          continue;
        }
        agg.criticalIssues += r.criticalIssues;
        agg.validatorIssues += r.validatorIssues;
        agg.warnings += r.warnings;
        agg.repairAttempts += r.repairAttempts;
        agg.repeatedPrograms += r.repeatedPrograms;
        agg.repeatedBehaviors += r.repeatedBehaviors;
        agg.latencyMs += r.latencyMs;
        agg.totalTokens += r.totalTokens;
        for (const code of r.issueCodes) {
          agg.issueCodeCounts.set(code, (agg.issueCodeCounts.get(code) ?? 0) + 1);
        }
        if (out && r.body) {
          const dir = join(out, model.replace(/[^a-zA-Z0-9.-]/g, "_"));
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${evalCase.id}-${rep}.txt`), r.body, "utf8");
        }
      }
    }
    process.stdout.write("\r".padEnd(60) + "\r");
    aggregates.push(agg);
  }

  printComparison(aggregates);
  console.log(
    "\nInterpretation: rank by critical/run and repairs/run first; use warn/run, " +
      "prog-repeat/run, and beh-repeat/run as tie-breakers; latency/tokens are the cost axis.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
