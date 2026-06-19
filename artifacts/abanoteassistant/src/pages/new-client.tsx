import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";
import { useLocation, useParams, Redirect, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  X,
  Plus,
  CheckCircle2,
  Check,
  User,
  AlertTriangle,
  Zap,
  BookOpen,
  Shield,
  CalendarIcon,
  ChevronsUpDown,
  ChevronDown,
  Loader2,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parse, parseISO, isValid } from "date-fns";
import { useWizardStore } from "@/store/wizard-store";
import {
  useClients,
  useClient,
  useDeleteClient,
  useExtractAssessmentFromPdf,
  useClientBehaviorProgramApprovals,
  useClientReplacementProgramsList,
  usePutClientBehaviorApprovedPrograms,
  useGenerateClientAvatar,
} from "@/hooks/use-aba-api";
import { ApiError, type AssessmentExtractResultPayload } from "@workspace/api-client-react";
import { ClientAvatar } from "@/components/client-avatar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  createClient,
  updateClient,
  uploadClientAssessmentDocument,
  BehaviorProgramMatchType,
  type Client as ApiClient,
  type PutBehaviorApprovedProgramInput,
  type UpdateClientRequest,
} from "@workspace/api-client-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ── Step 1 data ─────────────────────────────────────────────────────────────
interface Step1Data {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

// ── Step 2 data ─────────────────────────────────────────────────────────────
interface Step2Data {
  file: File | null;
}

// ── Step 3 data ─────────────────────────────────────────────────────────────
interface Step3Data {
  maladaptiveBehaviors: string[];
  /** Maps behavior name → optional topography / operational definition text. */
  maladaptiveBehaviorTargets: Record<string, string>;
  replacementPrograms: string[];
  skillAcquisitionPrograms: string[];
  interventions: string[];
}

/** URL `?section=` when editing a client from the clients list dropdown */
const EDIT_SECTIONS = ["personal", "assessment", "behaviors", "programs", "interventions"] as const;
export type EditSection = (typeof EDIT_SECTIONS)[number];

function isEditSection(s: string | null): s is EditSection {
  return s !== null && (EDIT_SECTIONS as readonly string[]).includes(s);
}

const SECTION_EDIT_LABELS: Record<EditSection, string> = {
  personal: "Edit name & gender",
  assessment: "Assessment PDF",
  behaviors: "Edit behaviors",
  programs: "Edit programs",
  interventions: "Edit interventions",
};

const SECTION_EDIT_SUBTITLES: Record<EditSection, string> = {
  personal: "Update name, date of birth, and gender.",
  assessment: "Replace or remove the FBA/BIP PDF stored for this client.",
  behaviors: "Update documented maladaptive behaviors.",
  programs: "Update replacement programs, skill acquisition programs, and goals.",
  interventions: "Update intervention strategies.",
};

// ── DOB formatter ────────────────────────────────────────────────────────────
function formatDOB(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;

/** Map model / PDF gender strings to intake options. */
function normalizeExtractedGender(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const t = raw.trim().toLowerCase();
  for (const g of GENDER_OPTIONS) {
    if (g.toLowerCase() === t) return g;
  }
  if (t === "m" || t === "male") return "Male";
  if (t === "f" || t === "female") return "Female";
  if (t.includes("non-binary") || t === "nb" || t === "nonbinary") return "Non-binary";
  return "";
}

/** Convert extracted DOB to MM/dd/yyyy for the calendar field. */
function normalizeExtractedDob(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = parseISO(t);
    return isValid(d) ? format(d, "MM/dd/yyyy") : "";
  }
  const d2 = parse(t, "M/d/yyyy", new Date());
  if (isValid(d2)) return format(d2, "MM/dd/yyyy");
  const d3 = parse(t, "MM/dd/yyyy", new Date());
  return isValid(d3) ? format(d3, "MM/dd/yyyy") : "";
}

function appendDedupedTags(base: string[], add: string[]): string[] {
  const lower = new Set(base.map((b) => b.trim().toLowerCase()).filter(Boolean));
  const out = [...base];
  for (const a of add) {
    const t = a.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (lower.has(k)) continue;
    lower.add(k);
    out.push(t);
  }
  return out;
}

// ── Chip tag component ────────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDFAF7] border border-[#F0E4E1] text-sm text-[#2D2523] font-medium">
      {label}
      <button
        onClick={onRemove}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[#877870] hover:text-[#C27A8A] hover:bg-[#F0E4E1] transition-colors"
      >
        <X className="w-3 h-3 pop-icon" />
      </button>
    </span>
  );
}

// ── Tag input section ────────────────────────────────────────────────────────
function TagSection({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  placeholder: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (i: number) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft("");
  }

  return (
    <div className="bg-white rounded-2xl border border-[#F0E4E1] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 pop-icon ${iconColor}`} />
        </div>
        <h3 className="font-bold text-[#2D2523] text-base">{title}</h3>
        <span className="ml-auto text-xs text-[#877870] font-medium">{items.length} added</span>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
        {items.length === 0 && (
          <span className="text-sm text-[#877870] italic">None added yet</span>
        )}
        {items.map((item, i) => (
          <Chip key={i} label={item} onRemove={() => onRemove(i)} />
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 rounded-xl border border-[#F0E4E1] bg-[#FDFAF7] text-sm text-[#2D2523] placeholder:text-[#877870] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
        />
        <button
          onClick={commit}
          disabled={!draft.trim()}
          className="w-10 h-10 rounded-xl bg-[#C27A8A] text-white flex items-center justify-center hover:bg-[#b06a79] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-5 h-5 pop-icon-white" />
        </button>
      </div>
    </div>
  );
}

type BehaviorApprovalDraft = PutBehaviorApprovedProgramInput;

/** Result of saving every behavior's draft approvals in one shot. */
type FlushApprovalsResult = { ok: boolean; errors: Record<string, string> };
type FlushApprovalsFn = () => Promise<FlushApprovalsResult>;
type FlushApprovalsRef = MutableRefObject<FlushApprovalsFn | null>;

const BEHAVIOR_MATCH_TYPE_VALUES = Object.values(BehaviorProgramMatchType) as NonNullable<
  PutBehaviorApprovedProgramInput["matchType"]
>[];

/** Behaviors section with per-behavior topography and optional approved-program links (saved when client exists). */
function BehaviorSection({
  items,
  targets,
  onAdd,
  onRemove,
  onTopographyChange,
  clientId,
  onPersistBehaviors,
  flushApprovalsRef,
}: {
  items: string[];
  targets: Record<string, string>;
  onAdd: (val: string) => void;
  onRemove: (i: number) => void;
  onTopographyChange: (name: string, val: string) => void;
  /** When set (edit client), show "Approved programs for this behavior" and persist links to the API. */
  clientId?: number;
  /** Called before per-behavior approval saves so newly added behaviors get persisted to the client profile first (prevents 404 from server when the behavior label isn't on the stored profile yet). */
  onPersistBehaviors?: () => Promise<void>;
  /** Parent registers a `current()` here to flush every behavior's draft approvals in one call (used by the section / wizard "Save changes" button). */
  flushApprovalsRef?: FlushApprovalsRef;
}) {
  const [draft, setDraft] = useState("");
  const approvalsQ = useClientBehaviorProgramApprovals(clientId);
  const programsQ = useClientReplacementProgramsList(clientId);
  const putMutation = usePutClientBehaviorApprovedPrograms();
  const programOptions = programsQ.data?.data ?? [];
  const [draftByBehavior, setDraftByBehavior] = useState<Record<string, BehaviorApprovalDraft[]>>({});
  const [openPrograms, setOpenPrograms] = useState<Record<string, boolean>>({});
  const [saveErrorByBehavior, setSaveErrorByBehavior] = useState<Record<string, string | undefined>>({});
  const [savingByBehavior, setSavingByBehavior] = useState<Record<string, boolean>>({});
  const [savedByBehavior, setSavedByBehavior] = useState<Record<string, boolean>>({});

  const behaviorNamesKey = items.join("\u0001");
  /** TanStack `data` is referentially stable until a fetch replaces it; do NOT depend on derived `items ?? []` arrays (new reference every render) or checkboxes reset immediately. */
  useEffect(() => {
    if (clientId == null) return;
    const names = behaviorNamesKey.length > 0 ? behaviorNamesKey.split("\u0001") : [];
    const rowItems = approvalsQ.data?.data?.items ?? [];
    const next: Record<string, BehaviorApprovalDraft[]> = {};
    for (const name of names) {
      const nl = name.trim();
      const nll = nl.toLowerCase();
      next[name] = rowItems
        .filter((a) => {
          const al = a.behaviorLabel.trim();
          return al === nl || al.toLowerCase() === nll;
        })
        .map((a) => ({
          programId: a.programId,
          matchType: a.matchType,
          requiresBcbaReview: a.requiresBcbaReview,
        }));
    }
    setDraftByBehavior(next);
  }, [clientId, behaviorNamesKey, approvalsQ.data]);

  function commit() {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft("");
  }

  function toggleProgramSelection(behaviorName: string, programId: number, checked: boolean) {
    setDraftByBehavior((prev) => {
      const cur = [...(prev[behaviorName] ?? [])];
      if (checked) {
        if (cur.some((e) => e.programId === programId)) return prev;
        return {
          ...prev,
          [behaviorName]: [
            ...cur,
            {
              programId,
              matchType: BehaviorProgramMatchType.Direct_Match,
              requiresBcbaReview: false,
            },
          ],
        };
      }
      return {
        ...prev,
        [behaviorName]: cur.filter((e) => e.programId !== programId),
      };
    });
  }

  function updateDraftEntry(
    behaviorName: string,
    programId: number,
    patch: Partial<Pick<BehaviorApprovalDraft, "requiresBcbaReview">> & {
      matchType?: PutBehaviorApprovedProgramInput["matchType"];
    },
  ) {
    setDraftByBehavior((prev) => {
      const cur = [...(prev[behaviorName] ?? [])];
      const idx = cur.findIndex((e) => e.programId === programId);
      if (idx < 0) return prev;
      cur[idx] = { ...cur[idx]!, ...patch };
      return { ...prev, [behaviorName]: cur };
    });
  }

  async function saveApprovalsForBehavior(behaviorName: string) {
    if (clientId == null) {
      return;
    }
    setSaveErrorByBehavior((s) => ({ ...s, [behaviorName]: undefined }));
    setSavedByBehavior((s) => ({ ...s, [behaviorName]: false }));
    setSavingByBehavior((s) => ({ ...s, [behaviorName]: true }));
    const rows = draftByBehavior[behaviorName] ?? [];
    try {
      // Persist the in-memory behaviors + topography to the client profile first so the
      // server recognizes the label being approved (otherwise a brand-new behavior that
      // hasn't been saved yet causes a 404 "Behavior not found on this client's profile").
      if (onPersistBehaviors) {
        await onPersistBehaviors();
      }
      await putMutation.mutateAsync({
        clientId,
        behaviorLabel: behaviorName,
        data: { programs: rows },
      });
      setSavedByBehavior((s) => ({ ...s, [behaviorName]: true }));
      setTimeout(() => setSavedByBehavior((s) => ({ ...s, [behaviorName]: false })), 3000);
    } catch (e) {
      const msg = e instanceof ApiError ? String(e.message) : e instanceof Error ? e.message : "Save failed";
      setSaveErrorByBehavior((s) => ({ ...s, [behaviorName]: msg }));
    } finally {
      setSavingByBehavior((s) => ({ ...s, [behaviorName]: false }));
    }
  }

  // Flush every behavior's draft approvals in one shot. Parent registers this on
  // `flushApprovalsRef.current` and calls it from the section / wizard "Save changes" flow,
  // so the user can save behaviors, topography, and approved programs in a single click.
  // Skip flushing while the approvals query is still loading because `draftByBehavior` is
  // still empty for every behavior and PUTting would wipe stored approvals on the server.
  const approvalsLoaded = approvalsQ.data != null;
  const flushAll = useCallback(async (): Promise<FlushApprovalsResult> => {
    if (clientId == null) return { ok: true, errors: {} };
    if (!approvalsLoaded) return { ok: true, errors: {} };
    const errors: Record<string, string> = {};
    for (const name of items) {
      const rows = draftByBehavior[name] ?? [];
      try {
        await putMutation.mutateAsync({
          clientId,
          behaviorLabel: name,
          data: { programs: rows },
        });
      } catch (e) {
        errors[name] =
          e instanceof ApiError ? String(e.message) : e instanceof Error ? e.message : "Save failed";
      }
    }
    if (Object.keys(errors).length > 0) {
      setSaveErrorByBehavior((s) => ({ ...s, ...errors }));
    }
    return { ok: Object.keys(errors).length === 0, errors };
  }, [clientId, approvalsLoaded, items, draftByBehavior, putMutation]);

  useEffect(() => {
    if (!flushApprovalsRef) return;
    flushApprovalsRef.current = flushAll;
    return () => {
      if (flushApprovalsRef) flushApprovalsRef.current = null;
    };
  }, [flushApprovalsRef, flushAll]);

  const showApprovals = clientId != null && clientId > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#F0E4E1] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50">
          <AlertTriangle className="w-5 h-5 pop-icon text-rose-600" />
        </div>
        <h3 className="font-bold text-[#2D2523] text-base">Maladaptive Behaviors</h3>
        <span className="ml-auto text-xs text-[#877870] font-medium">{items.length} added</span>
      </div>

      {/* Per-behavior rows */}
      <div className="space-y-3 mb-4">
        {items.length === 0 && (
          <span className="text-sm text-[#877870] italic">None added yet</span>
        )}
        {items.map((name, i) => {
          const drafts = draftByBehavior[name] ?? [];
          const selectedIds = new Set(drafts.map((d) => d.programId));
          return (
            <div key={`${name}-${i}`} className="rounded-xl border border-[#F0E4E1] bg-[#FDFAF7] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#2D2523] flex-1">{name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-[#877870] hover:text-rose-600 transition-colors shrink-0"
                  aria-label={`Remove ${name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={targets[name] ?? ""}
                onChange={(e) => onTopographyChange(name, e.target.value)}
                placeholder="Topography / operational definition (optional) — what this behavior looks like for this learner"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[#F0E4E1] bg-white text-xs text-[#2D2523] placeholder:text-[#877870]/70 focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all resize-none"
              />

              {showApprovals && (
                <Collapsible
                  open={openPrograms[name] ?? false}
                  onOpenChange={(o) => setOpenPrograms((prev) => ({ ...prev, [name]: o }))}
                  className="pt-1 border-t border-[#F0E4E1] mt-2"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs font-semibold text-[#877870] hover:text-[#C27A8A] transition-colors">
                    <span>Approved Programs for This Behavior</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform ${openPrograms[name] ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pb-1">
                    <p className="text-[11px] text-[#877870] leading-relaxed">
                      These programs will be available when generating notes for this maladaptive behavior. Uses this
                      client&apos;s replacement program list only.
                    </p>
                    {programsQ.isLoading || approvalsQ.isLoading ? (
                      <div className="flex items-center gap-2 text-xs text-[#877870] py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading programs…
                      </div>
                    ) : programOptions.length === 0 ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                        Add replacement programs for this client first (Programs step), then return here to link them.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {programOptions.map((p) => {
                          const checked = selectedIds.has(p.id);
                          const row = drafts.find((d) => d.programId === p.id);
                          const showBcbaBadge =
                            row?.requiresBcbaReview || row?.matchType === BehaviorProgramMatchType.Requires_BCBA_Review;
                          return (
                            <div
                              key={p.id}
                              className="rounded-lg border border-[#F0E4E1] bg-white px-2 py-2 space-y-1.5"
                            >
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleProgramSelection(name, p.id, e.target.checked)}
                                  className="mt-0.5 rounded border-[#F0E4E1] text-[#C27A8A] focus:ring-[#C27A8A]/30"
                                />
                                <span className="text-xs font-medium text-[#2D2523] flex-1">{p.name}</span>
                                {showBcbaBadge && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                                    BCBA review
                                  </span>
                                )}
                              </label>
                              {checked && row && (
                                <div className="pl-6 space-y-1.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase text-[#877870]">
                                      Match type
                                    </span>
                                    <select
                                      value={row.matchType}
                                      onChange={(e) =>
                                        updateDraftEntry(name, p.id, {
                                          matchType: e.target
                                            .value as PutBehaviorApprovedProgramInput["matchType"],
                                        })
                                      }
                                      className="w-full text-xs rounded-md border border-[#F0E4E1] bg-[#FDFAF7] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30"
                                    >
                                      {BEHAVIOR_MATCH_TYPE_VALUES.map((mt) => (
                                        <option key={mt} value={mt}>
                                          {mt}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-2 text-[11px] text-[#2D2523] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={row.requiresBcbaReview}
                                      onChange={(e) =>
                                        updateDraftEntry(name, p.id, { requiresBcbaReview: e.target.checked })
                                      }
                                      className="rounded border-[#F0E4E1] text-[#C27A8A] focus:ring-[#C27A8A]/30"
                                    />
                                    Requires BCBA review (flag)
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {saveErrorByBehavior[name] && (
                      <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700 font-medium leading-snug">{saveErrorByBehavior[name]}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void saveApprovalsForBehavior(name)}
                        disabled={savingByBehavior[name] || programsQ.isLoading}
                        className="px-4 py-2 rounded-lg bg-[#C27A8A] text-white text-xs font-semibold hover:bg-[#b06a79] disabled:opacity-50 transition-colors"
                      >
                        {savingByBehavior[name] ? "Saving…" : "Save approved programs"}
                      </button>
                      {savedByBehavior[name] && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Saved
                        </span>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      {/* Add input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder="e.g. Aggression, Self-injurious behavior..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-[#F0E4E1] bg-[#FDFAF7] text-sm text-[#2D2523] placeholder:text-[#877870] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="w-10 h-10 rounded-xl bg-[#C27A8A] text-white flex items-center justify-center hover:bg-[#b06a79] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-5 h-5 pop-icon-white" />
        </button>
      </div>
    </div>
  );
}

// ── Progress header ───────────────────────────────────────────────────────────
function ProgressHeader({
  step,
  onBack,
  onCancel,
  mode,
}: {
  step: number;
  onBack: () => void;
  onCancel: () => void;
  mode: "create" | "edit";
}) {
  const labels = ["Personal Info", "Assessment", "Programs & Behaviors"];
  return (
    <header className="bg-primary sticky top-0 z-50 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors font-semibold text-sm"
      >
        <ChevronLeft className="w-5 h-5 pop-icon-white" />
        Back
      </button>
      <div className="text-center">
        <div className="text-white font-bold text-sm">{labels[step - 1]}</div>
        <div className="text-white/60 text-xs mt-0.5">
          {mode === "edit" ? "Edit client · " : ""}Step {step} of 3
        </div>
      </div>
      <button
        onClick={onCancel}
        className="text-white/80 hover:text-white transition-colors font-semibold text-sm"
      >
        Cancel
      </button>
    </header>
  );
}

/** Header when editing a single section (dropdown from clients list) */
function SectionEditHeader({
  title,
  onBack,
  onCancel,
}: {
  title: string;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <header className="bg-primary sticky top-0 z-50 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors font-semibold text-sm"
      >
        <ChevronLeft className="w-5 h-5 pop-icon-white" />
        Back
      </button>
      <div className="text-center px-2 min-w-0">
        <div className="text-white font-bold text-sm truncate">{title}</div>
        <div className="text-white/60 text-xs mt-0.5">Edit client</div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-white/80 hover:text-white transition-colors font-semibold text-sm shrink-0"
      >
        Cancel
      </button>
    </header>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="w-full h-1 bg-[#F0E4E1]">
      <div
        className="h-full bg-[#C27A8A] transition-all duration-500 ease-out"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

// ── Step 1 ───────────────────────────────────────────────────────────────────
function Step1({
  data,
  onChange,
  avatarPanel,
}: {
  data: Step1Data;
  onChange: (d: Step1Data) => void;
  /** Optional avatar panel rendered above the name fields (edit mode only). */
  avatarPanel?: React.ReactNode;
}) {
  const genders = ["Male", "Female", "Non-binary", "Prefer not to say"];
  const [dobOpen, setDobOpen] = useState(false);

  const selectedDobDate = data.dateOfBirth.length === 10
    ? (() => { try { const [m, d, y] = data.dateOfBirth.split("/"); return new Date(Number(y), Number(m) - 1, Number(d)); } catch { return undefined; } })()
    : undefined;

  return (
    <div className="space-y-5">
      {avatarPanel}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* First name */}
        <div>
          <label className="block text-sm font-semibold text-[#2D2523] mb-2 pop-text">First Name</label>
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => onChange({ ...data, firstName: e.target.value })}
            placeholder="e.g. James"
            className="w-full px-4 py-3 rounded-xl border border-[#F0E4E1] bg-white text-[#2D2523] placeholder:text-[#877870] text-sm focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
          />
        </div>

        {/* Last name */}
        <div>
          <label className="block text-sm font-semibold text-[#2D2523] mb-2 pop-text">Last Name</label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => onChange({ ...data, lastName: e.target.value })}
            placeholder="e.g. Rodriguez"
            className="w-full px-4 py-3 rounded-xl border border-[#F0E4E1] bg-white text-[#2D2523] placeholder:text-[#877870] text-sm focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
          />
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-sm font-semibold text-[#2D2523] mb-2 pop-text">
          Date of Birth
        </label>
        <Popover open={dobOpen} onOpenChange={setDobOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#F0E4E1] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all hover:border-[#C27A8A]/50 text-left"
            >
              <CalendarIcon className="w-4 h-4 text-[#877870] shrink-0 pop-icon" />
              <span className={data.dateOfBirth ? "text-[#2D2523]" : "text-[#877870]"}>
                {data.dateOfBirth || "Select date of birth"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDobDate}
              onSelect={(date) => {
                if (date) {
                  onChange({ ...data, dateOfBirth: format(date, "MM/dd/yyyy") });
                  setDobOpen(false);
                }
              }}
              captionLayout="dropdown"
              defaultMonth={selectedDobDate ?? new Date(2010, 0, 1)}
              startMonth={new Date(1940, 0)}
              endMonth={new Date()}
              toDate={new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-semibold text-[#2D2523] mb-3 pop-text">Gender</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {genders.map((g) => (
            <button
              key={g}
              onClick={() => onChange({ ...data, gender: g })}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                data.gender === g
                  ? "bg-[#C27A8A] text-white border-[#C27A8A] shadow-[0_4px_12px_rgba(194,122,138,0.3)]"
                  : "bg-white text-[#877870] border-[#F0E4E1] hover:border-[#C27A8A] hover:text-[#C27A8A]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────
function Step2({
  data,
  onChange,
  priorAssessmentFileName,
  extracting,
  extractError,
  extractSuccess,
  onExtractFromPdf,
  onClearStoredAssessment,
  clearingStoredAssessment,
  authorizationExpiresOn,
  onAuthorizationExpiresOnChange,
}: {
  data: Step2Data;
  onChange: (d: Step2Data) => void;
  /** Shown when editing and a PDF was saved previously (File can’t be restored). */
  priorAssessmentFileName?: string;
  extracting?: boolean;
  extractError?: string | null;
  extractSuccess?: string | null;
  onExtractFromPdf?: () => void;
  /** When set, show a control to remove the stored PDF from the server (edit flows only). */
  onClearStoredAssessment?: () => void | Promise<void>;
  clearingStoredAssessment?: boolean;
  /** ISO yyyy-MM-dd authorization expiration (auto-filled from PDF; editable by RBT). */
  authorizationExpiresOn?: string | null;
  onAuthorizationExpiresOnChange?: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      if (file && file.type === "application/pdf") onChange({ file });
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-5">
      <p className="text-[#877870] text-sm leading-relaxed">
        Upload the client's Functional Behavior Assessment (FBA) or Behavior Intervention Plan (BIP) as a PDF. You can skip this step and add it later.
      </p>

      {!data.file && priorAssessmentFileName ? (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-amber-700 shrink-0 pop-icon mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">Assessment on file</p>
              <p className="text-amber-800/90 truncate" title={priorAssessmentFileName}>
                {priorAssessmentFileName}
              </p>
              <p className="text-xs text-amber-700/80 mt-1">
                Drop or select a new PDF below to replace it, or remove the stored file from this client.
              </p>
            </div>
          </div>
          {onClearStoredAssessment ? (
            <button
              type="button"
              onClick={() => void onClearStoredAssessment()}
              disabled={clearingStoredAssessment}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingStoredAssessment ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Trash2 className="w-4 h-4 shrink-0 pop-icon" />
              )}
              Remove assessment
            </button>
          ) : null}
        </div>
      ) : null}

      {data.file ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-emerald-600 pop-icon" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-800 text-sm truncate">{data.file.name}</p>
              <p className="text-emerald-600 text-xs mt-0.5">{(data.file.size / 1024).toFixed(0)} KB · PDF</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ file: null })}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
            >
              <X className="w-4 h-4 pop-icon" />
            </button>
          </div>
          {onExtractFromPdf ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onExtractFromPdf}
                disabled={extracting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-[#C27A8A] text-[#C27A8A] font-semibold text-sm hover:bg-[#C27A8A]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    Reading PDF &amp; extracting fields…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 shrink-0 pop-icon" />
                    Fill name, age, behaviors &amp; programs from this PDF
                  </>
                )}
              </button>
              {extractError ? (
                <p className="text-sm text-rose-600 font-medium">{extractError}</p>
              ) : null}
              {extractSuccess ? (
                <p className="text-sm text-emerald-700 font-medium leading-relaxed">{extractSuccess}</p>
              ) : null}
              <p className="text-xs text-[#877870] leading-relaxed">
                Uses the PDF text layer plus AI. Scanned-only PDFs may not extract well. Review step 1 and step 3 before saving.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? "border-[#C27A8A] bg-[#C27A8A]/5"
              : "border-[#F0E4E1] bg-[#FDFAF7] hover:border-[#C27A8A]/50 hover:bg-white"
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#F0E4E1] shadow-sm flex items-center justify-center">
            <Upload className="w-7 h-7 text-[#C27A8A] pop-icon" />
          </div>
          <div className="text-center">
            <p className="font-bold text-[#2D2523] text-base">Drop PDF here or click to browse</p>
            <p className="text-[#877870] text-sm mt-1">PDF files only · Max 20 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {onAuthorizationExpiresOnChange ? (
        <AuthorizationExpiresField
          value={authorizationExpiresOn ?? null}
          onChange={onAuthorizationExpiresOnChange}
        />
      ) : null}

      <p className="text-xs text-[#877870] flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 pop-icon" />
        This is optional — you can upload the assessment at any time from the client's profile.
      </p>
    </div>
  );
}

// ── Authorization-expires-on input ──────────────────────────────────────────
/**
 * Lightweight date input for the authorization / treatment-plan expiration date. Auto-fills from the assessment
 * PDF when present; the RBT can review or override before saving. Renders the stored ISO `yyyy-MM-dd` value
 * (which is what we send back to the API) in a native HTML5 date picker for accessibility + browser support.
 */
function AuthorizationExpiresField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const isExpired =
    !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value < new Date().toISOString().slice(0, 10);
  return (
    <div className="bg-white rounded-2xl border border-[#F0E4E1] p-5">
      <label className="block text-sm font-semibold text-[#2D2523] mb-1">
        Authorization expires on
      </label>
      <p className="text-xs text-[#877870] mb-3 leading-relaxed">
        Auto-filled from the assessment PDF when stated. Surfaces in red on the client's card so RBTs know
        when the assessment lapses.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
          className="px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-sm text-[#2D2523] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/40 focus:border-[#C27A8A]/40"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-[#877870] hover:text-[#C27A8A] underline self-start sm:self-auto"
          >
            Clear
          </button>
        ) : null}
      </div>
      {isExpired ? (
        <p className="mt-2 text-xs font-semibold text-rose-700">
          This authorization is past its expiration date.
        </p>
      ) : null}
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
function Step3({
  data,
  onChange,
  clientId,
  onPersistBehaviors,
  flushApprovalsRef,
}: {
  data: Step3Data;
  onChange: (d: Step3Data) => void;
  /** Present in edit flow so behavior→program links can be saved from this step. */
  clientId?: number;
  onPersistBehaviors?: () => Promise<void>;
  flushApprovalsRef?: FlushApprovalsRef;
}) {
  function addTo(key: "replacementPrograms" | "skillAcquisitionPrograms" | "interventions", val: string) {
    onChange({ ...data, [key]: [...data[key], val] });
  }

  function removeFrom(key: "replacementPrograms" | "skillAcquisitionPrograms" | "interventions", i: number) {
    onChange({ ...data, [key]: data[key].filter((_, idx) => idx !== i) });
  }

  function addBehavior(val: string) {
    onChange({ ...data, maladaptiveBehaviors: [...data.maladaptiveBehaviors, val] });
  }
  function removeBehavior(i: number) {
    const name = data.maladaptiveBehaviors[i];
    const next = { ...data.maladaptiveBehaviorTargets };
    delete next[name];
    onChange({
      ...data,
      maladaptiveBehaviors: data.maladaptiveBehaviors.filter((_, idx) => idx !== i),
      maladaptiveBehaviorTargets: next,
    });
  }
  function setTopography(name: string, val: string) {
    onChange({ ...data, maladaptiveBehaviorTargets: { ...data.maladaptiveBehaviorTargets, [name]: val } });
  }

  return (
    <div className="space-y-5">
      <p className="text-[#877870] text-sm leading-relaxed">
        Add the client's documented behaviors, goals, and intervention strategies. These will be available when generating session notes.
      </p>

      <BehaviorSection
        items={data.maladaptiveBehaviors}
        targets={data.maladaptiveBehaviorTargets}
        onAdd={addBehavior}
        onRemove={removeBehavior}
        onTopographyChange={setTopography}
        clientId={clientId}
        onPersistBehaviors={onPersistBehaviors}
        flushApprovalsRef={flushApprovalsRef}
      />

      <TagSection
        title="Replacement Programs"
        icon={Zap}
        iconColor="text-[#C27A8A]"
        iconBg="bg-[#FCEEF1]"
        placeholder="e.g. Mand for desired items, Functional Play..."
        items={data.replacementPrograms}
        onAdd={(v) => addTo("replacementPrograms", v)}
        onRemove={(i) => removeFrom("replacementPrograms", i)}
      />

      <TagSection
        title="Skill Acquisition Programs"
        icon={BookOpen}
        iconColor="text-sky-700"
        iconBg="bg-sky-50"
        placeholder="e.g. Echoic skills, Manding skills, Respond to own Name..."
        items={data.skillAcquisitionPrograms}
        onAdd={(v) => addTo("skillAcquisitionPrograms", v)}
        onRemove={(i) => removeFrom("skillAcquisitionPrograms", i)}
      />

      <TagSection
        title="Interventions"
        icon={Shield}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
        placeholder="e.g. Token economy, Redirection, DRI..."
        items={data.interventions}
        onAdd={(v) => addTo("interventions", v)}
        onRemove={(i) => removeFrom("interventions", i)}
      />
    </div>
  );
}

/** One tag panel for section-only edit (behaviors / programs / interventions) */
function Step3SingleSection({
  section,
  data,
  onChange,
  clientId,
  onPersistBehaviors,
  flushApprovalsRef,
}: {
  section: Exclude<EditSection, "personal" | "assessment">;
  data: Step3Data;
  onChange: (d: Step3Data) => void;
  clientId?: number;
  onPersistBehaviors?: () => Promise<void>;
  flushApprovalsRef?: FlushApprovalsRef;
}) {
  function addTo(key: "replacementPrograms" | "skillAcquisitionPrograms" | "interventions", val: string) {
    onChange({ ...data, [key]: [...data[key], val] });
  }
  function removeFrom(key: "replacementPrograms" | "skillAcquisitionPrograms" | "interventions", i: number) {
    onChange({ ...data, [key]: data[key].filter((_, idx) => idx !== i) });
  }
  function addBehavior(val: string) {
    onChange({ ...data, maladaptiveBehaviors: [...data.maladaptiveBehaviors, val] });
  }
  function removeBehavior(i: number) {
    const name = data.maladaptiveBehaviors[i];
    const next = { ...data.maladaptiveBehaviorTargets };
    delete next[name];
    onChange({
      ...data,
      maladaptiveBehaviors: data.maladaptiveBehaviors.filter((_, idx) => idx !== i),
      maladaptiveBehaviorTargets: next,
    });
  }
  function setTopography(name: string, val: string) {
    onChange({ ...data, maladaptiveBehaviorTargets: { ...data.maladaptiveBehaviorTargets, [name]: val } });
  }

  if (section === "behaviors") {
    return (
      <BehaviorSection
        items={data.maladaptiveBehaviors}
        targets={data.maladaptiveBehaviorTargets}
        onAdd={addBehavior}
        onRemove={removeBehavior}
        onTopographyChange={setTopography}
        clientId={clientId}
        onPersistBehaviors={onPersistBehaviors}
        flushApprovalsRef={flushApprovalsRef}
      />
    );
  }
  if (section === "programs") {
    return (
      <div className="space-y-5">
        <TagSection
          title="Replacement Programs"
          icon={Zap}
          iconColor="text-[#C27A8A]"
          iconBg="bg-[#FCEEF1]"
          placeholder="e.g. Mand for desired items, Functional Play..."
          items={data.replacementPrograms}
          onAdd={(v) => addTo("replacementPrograms", v)}
          onRemove={(i) => removeFrom("replacementPrograms", i)}
        />
        <TagSection
          title="Skill Acquisition Programs"
          icon={BookOpen}
          iconColor="text-sky-700"
          iconBg="bg-sky-50"
          placeholder="e.g. Echoic skills, Manding skills, Respond to own Name..."
          items={data.skillAcquisitionPrograms}
          onAdd={(v) => addTo("skillAcquisitionPrograms", v)}
          onRemove={(i) => removeFrom("skillAcquisitionPrograms", i)}
        />
      </div>
    );
  }
  return (
    <TagSection
      title="Interventions"
      icon={Shield}
      iconColor="text-emerald-600"
      iconBg="bg-emerald-50"
      placeholder="e.g. Token economy, Redirection, DRI..."
      items={data.interventions}
      onAdd={(v) => addTo("interventions", v)}
      onRemove={(i) => removeFrom("interventions", i)}
    />
  );
}

/** When adding a client from the note wizard: pick an existing server client and go back. */
function WizardExistingClientPicker({ onChosen }: { onChosen: () => void }) {
  const [open, setOpen] = useState(false);
  const { updateData } = useWizardStore();
  const { data: clientsRes, isLoading } = useClients();
  const clients: ApiClient[] = clientsRes?.data ?? [];

  const pick = (client: ApiClient) => {
    if (client.assessmentStatus === "missing") return;
    updateData({ clientId: client.id });
    setOpen(false);
    onChosen();
  };

  return (
    <div className="rounded-2xl border border-[#F0E4E1] bg-[#FDFAF7] p-5 mb-8">
      <p className="text-sm font-semibold text-[#2D2523] mb-1">Already have this client?</p>
      <p className="text-xs text-[#877870] mb-3">
        Search your existing clients and continue the note wizard — no need to add them again.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-[#877870] gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading clients…
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-[#877870]">No clients yet. Use the form below to add one.</p>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border-2 border-[#F0E4E1] text-sm font-medium text-left transition-all",
                open && "border-[#C27A8A] ring-4 ring-[#C27A8A]/15"
              )}
            >
              <span className="text-[#877870]">Select an existing client…</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#877870]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,28rem)]"
            align="start"
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="Search by name…" />
              <CommandList className="max-h-64">
                <CommandEmpty>No clients match.</CommandEmpty>
                <CommandGroup>
                  {clients.map((c) => {
                    const blocked = c.assessmentStatus === "missing";
                    return (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.ageBand ?? ""}`}
                        disabled={blocked}
                        onSelect={() => pick(c)}
                        className={cn(blocked && "opacity-50 cursor-not-allowed")}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {blocked
                              ? "Upload assessment first (can’t generate notes)"
                              : `${c.ageBand ? `${c.ageBand} · ` : ""}Assessment: ${c.assessmentStatus}`}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function NewClientForm({
  editClientId,
  editSection,
}: {
  editClientId?: string;
  editSection?: EditSection;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const numericId =
    editClientId !== undefined && editClientId !== ""
      ? Number.parseInt(editClientId, 10)
      : NaN;
  const isEdit = Number.isFinite(numericId) && numericId > 0;
  const isSectionEdit = isEdit && editSection !== undefined;

  const {
    data: detailRes,
    isLoading: detailLoading,
    isError: detailError,
  } = useClient(isEdit ? numericId : undefined);

  const [hydrated, setHydrated] = useState(!isEdit);
  const searchParams = new URLSearchParams(window.location.search);

  // `?intent=assessment` (set by the "From Assessment PDF" picker on the clients page) reorders the create
  // wizard so the assessment upload comes FIRST. The wizard then walks the user through Step 2 → Step 1 →
  // Step 3 so they can review the auto-extracted name/DOB/gender before reviewing programs and saving.
  // Edit flows always use the canonical 1→2→3 order.
  const intentRaw = (searchParams.get("intent") ?? "").toLowerCase();
  const STEP_ORDER: readonly number[] =
    !isEdit && intentRaw === "assessment" ? [2, 1, 3] : [1, 2, 3];
  const initialStep = isEdit
    ? Math.min(3, Math.max(1, Number(searchParams.get("step") || 1)))
    : STEP_ORDER[0];
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);
  const safeStepIndex = stepIndex < 0 ? 0 : stepIndex;
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === STEP_ORDER.length - 1;
  const nextStep = STEP_ORDER[safeStepIndex + 1];
  const prevStep = STEP_ORDER[safeStepIndex - 1];

  // Detect return destination from query param (?returnTo=wizard)
  const returnTo = searchParams.get("returnTo");

  const [step1, setStep1] = useState<Step1Data>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });

  const [step2, setStep2] = useState<Step2Data>({ file: null });

  const [step3, setStep3] = useState<Step3Data>({
    maladaptiveBehaviors: [],
    maladaptiveBehaviorTargets: {},
    replacementPrograms: [],
    skillAcquisitionPrograms: [],
    interventions: [],
  });

  // Authorization / treatment-plan expiration date (ISO yyyy-MM-dd). Pulled from the assessment when present;
  // sent on create + update so the clients list / detail header can show the red expiration badge.
  const [authorizationExpiresOn, setAuthorizationExpiresOn] = useState<string | null>(null);

  const extractMutation = useExtractAssessmentFromPdf();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [clearingStoredAssessment, setClearingStoredAssessment] = useState(false);
  // Identity of the most recently auto-extracted file (name + size) so we don't re-run extraction repeatedly
  // for the same PDF the user picked. Switching to a different file re-arms the auto-extract effect.
  const lastAutoExtractedFileKeyRef = useRef<string | null>(null);
  const deleteClientMutation = useDeleteClient();
  const generateAvatarMutation = useGenerateClientAvatar();

  /** Fires the avatar regenerate request for an existing client (edit mode + section-edit "personal"). */
  function regenerateAvatarForCurrentClient() {
    if (!isEdit || !Number.isFinite(numericId) || numericId <= 0) return;
    if (generateAvatarMutation.isPending) return;
    generateAvatarMutation.mutate(numericId, {
      onError: (err) => {
        const msg =
          err instanceof Error ? `Could not generate avatar: ${err.message}` : "Could not generate avatar.";
        setSaveError(msg);
      },
      onSuccess: () => {
        setSaveError(null);
      },
    });
  }

  /** Renders the clickable avatar circle + helper copy used in the wizard Step 1 (edit mode only). */
  function renderEditModeAvatarPanel() {
    if (!isEdit) return null;
    const stored = detailRes?.data;
    if (!stored) return null;
    const subject = {
      avatarUrl: stored.avatarUrl,
      avatarUpdatedAt: stored.avatarUpdatedAt,
      firstName: step1.firstName || stored.profile?.firstName || "",
      lastName: step1.lastName || stored.profile?.lastName || "",
      name: stored.name,
    };
    const hasAvatar = Boolean(stored.avatarUrl);
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-[#F0E4E1] bg-[#FDFAF7] p-4 mb-2">
        <ClientAvatar
          client={subject}
          size="xl"
          onRegenerate={regenerateAvatarForCurrentClient}
          isRegenerating={generateAvatarMutation.isPending}
          hoverLabel={hasAvatar ? "Click to regenerate avatar with AI" : "Click to generate avatar with AI"}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2D2523]">Profile avatar</p>
          <p className="text-xs text-[#877870] mt-0.5 leading-relaxed">
            {generateAvatarMutation.isPending
              ? "Generating a new avatar with AI…"
              : hasAvatar
                ? "Click the picture to regenerate a new AI cartoon avatar from this client's name, age, and gender."
                : "Click the initials to generate an AI cartoon avatar from this client's name, age, and gender."}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              regenerateAvatarForCurrentClient();
            }}
            disabled={generateAvatarMutation.isPending}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#F0E4E1] text-xs font-semibold text-[#C27A8A] hover:bg-[#F9EEF1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateAvatarMutation.isPending
              ? "Generating…"
              : hasAvatar
                ? "Regenerate avatar"
                : "Generate avatar"}
          </button>
        </div>
      </div>
    );
  }

  async function handleDeleteClientFromEdit() {
    if (!isEdit || !Number.isFinite(numericId) || numericId <= 0) return;
    if (deleteClientMutation.isPending) return;
    const stored = detailRes?.data;
    const fromProfile =
      stored?.profile?.firstName || stored?.profile?.lastName
        ? `${stored?.profile?.firstName ?? ""} ${stored?.profile?.lastName ?? ""}`.trim()
        : "";
    const fromForm = `${step1.firstName} ${step1.lastName}`.trim();
    const namePart = fromProfile || stored?.name || fromForm || "this client";
    const ok = window.confirm(
      `Delete client "${namePart}"?\n\nThis permanently removes the client, their session notes, program links, and behavior approvals. This cannot be undone.`,
    );
    if (!ok) return;
    setSaveError(null);
    deleteClientMutation.mutate(numericId, {
      onSuccess: () => setLocation("/clients"),
      onError: (err) => {
        setSaveError(
          err instanceof Error ? `Could not delete client: ${err.message}` : "Could not delete client.",
        );
      },
    });
  }

  // Lets BehaviorSection register a function to flush every behavior's draft approved-program
  // selections in one shot. The bottom "Save changes" button calls it after PATCHing behaviors,
  // so the user can save behaviors + topography + approved programs in a single click.
  const flushBehaviorApprovalsRef = useRef<FlushApprovalsFn | null>(null);

  // Called by BehaviorSection right before saving approved programs for a behavior, so a
  // newly added (unsaved) behavior gets persisted to the client profile first. This avoids
  // the server's "Behavior not found on this client's profile" 404.
  const persistBehaviorsToProfile = useCallback(async () => {
    if (!isEdit || !Number.isFinite(numericId) || numericId <= 0) return;
    await updateClient(numericId, {
      maladaptiveBehaviors: step3.maladaptiveBehaviors,
      maladaptiveBehaviorTargets: step3.maladaptiveBehaviors.map((name) => ({
        name,
        topography: step3.maladaptiveBehaviorTargets[name]?.trim() || null,
      })),
    });
  }, [isEdit, numericId, step3]);

  useEffect(() => {
    if (!step2.file) {
      setExtractError(null);
      setExtractSuccess(null);
    }
  }, [step2.file]);

  function applyAssessmentExtract(payload: AssessmentExtractResultPayload) {
    const e = payload.extracted;
    setStep1((s) => ({
      firstName: s.firstName.trim() || e.firstName?.trim() || "",
      lastName: s.lastName.trim() || e.lastName?.trim() || "",
      dateOfBirth:
        s.dateOfBirth.length === 10 ? s.dateOfBirth : normalizeExtractedDob(e.dateOfBirth) || s.dateOfBirth,
      gender: s.gender || normalizeExtractedGender(e.gender) || s.gender,
    }));
    setStep3((s) => {
      const nextBehaviors = appendDedupedTags(s.maladaptiveBehaviors, e.maladaptiveBehaviors);
      // Build a case-insensitive map of behaviors already on the form (kept) and fill topographies for any
      // behavior the user has not typed one for, using the assessment's operational definitions when present.
      const lowerByName = new Map(nextBehaviors.map((n) => [n.toLowerCase(), n] as const));
      const nextTargets: Record<string, string> = { ...s.maladaptiveBehaviorTargets };
      for (const t of e.maladaptiveBehaviorTopographies ?? []) {
        const desc = (t.topography ?? "").trim();
        if (!desc) continue;
        const aligned = lowerByName.get((t.name ?? "").trim().toLowerCase()) ?? null;
        if (!aligned) continue;
        const existing = (nextTargets[aligned] ?? "").trim();
        if (!existing) {
          nextTargets[aligned] = desc;
        }
      }
      return {
        maladaptiveBehaviors: nextBehaviors,
        maladaptiveBehaviorTargets: nextTargets,
        replacementPrograms: appendDedupedTags(s.replacementPrograms, e.replacementPrograms),
        skillAcquisitionPrograms:
          (e.skillAcquisitionPrograms ?? []).length > 0
            ? [...(e.skillAcquisitionPrograms ?? [])]
            : s.skillAcquisitionPrograms,
        interventions: appendDedupedTags(s.interventions, e.interventions),
      };
    });
    if (e.assessmentAuthorizationExpiresOn) {
      // Only auto-fill when nothing has been entered yet; never overwrite an explicitly-set value.
      setAuthorizationExpiresOn((prev) => prev ?? e.assessmentAuthorizationExpiresOn ?? null);
    }
  }

  async function handleClearStoredAssessment() {
    if (!isEdit || !Number.isFinite(numericId) || numericId <= 0) return;
    if (
      !window.confirm(
        "Remove the stored assessment from this client? Note generation will be blocked until a new PDF is uploaded. Structured assessment lists saved from the old file will also be cleared.",
      )
    ) {
      return;
    }
    setClearingStoredAssessment(true);
    setSaveError(null);
    try {
      await updateClient(numericId, { clearAssessment: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
      setStep2({ file: null });
      setAuthorizationExpiresOn(null);
      setExtractError(null);
      setExtractSuccess(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not remove assessment.");
    } finally {
      setClearingStoredAssessment(false);
    }
  }

  async function handleExtractFromPdf() {
    if (!step2.file) return;
    setExtractError(null);
    setExtractSuccess(null);
    try {
      const res = await extractMutation.mutateAsync(step2.file);
      applyAssessmentExtract(res.data);
      const e = res.data.extracted;
      const topographyCount = (e.maladaptiveBehaviorTopographies ?? []).filter(
        (t) => (t.topography ?? "").trim().length > 0,
      ).length;
      const counts = [
        e.firstName || e.lastName ? "name" : null,
        e.dateOfBirth ? "DOB" : null,
        e.gender ? "gender" : null,
        e.maladaptiveBehaviors.length ? `${e.maladaptiveBehaviors.length} behaviors` : null,
        topographyCount ? `${topographyCount} topographies` : null,
        e.replacementPrograms.length ? `${e.replacementPrograms.length} replacement programs` : null,
        (e.skillAcquisitionPrograms ?? []).length
          ? `${e.skillAcquisitionPrograms!.length} skill acquisition programs`
          : null,
        e.interventions.length ? `${e.interventions.length} interventions` : null,
        e.assessmentAuthorizationExpiresOn ? "authorization expiration date" : null,
      ].filter(Boolean);
      const warn = res.data.warnings.length ? ` Note: ${res.data.warnings.join(" ")}` : "";
      setExtractSuccess(
        counts.length
          ? `Imported ${counts.join(", ")} from the document.${warn}`
          : `No structured fields were found in the PDF text.${warn}`,
      );
    } catch (err) {
      let msg = "Could not extract from PDF.";
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | null;
        msg = (data && typeof data.error === "string" && data.error) || err.message || msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setExtractError(msg);
    }
  }

  // Auto-trigger extraction the moment the RBT picks (or drops) a PDF, so name / behaviors / programs /
  // interventions / topographies / authorization expiration date are auto-filled without an extra click.
  // Re-arms only when a different file is selected (different name+size).
  useEffect(() => {
    const file = step2.file;
    if (!file) {
      lastAutoExtractedFileKeyRef.current = null;
      return;
    }
    const key = `${file.name}|${file.size}`;
    if (lastAutoExtractedFileKeyRef.current === key) return;
    if (extractMutation.isPending) return;
    lastAutoExtractedFileKeyRef.current = key;
    void handleExtractFromPdf();
    // We intentionally depend only on the file identity; handleExtractFromPdf is recreated each render
    // but reads the latest file via closure on `step2.file` inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step2.file]);

  useEffect(() => {
    if (!isEdit) {
      setHydrated(true);
      return;
    }
    if (detailLoading) return;
    if (detailError || !detailRes?.data) {
      setLocation("/clients");
      return;
    }
    const c = detailRes.data;
    const p = c.profile;
    const nameParts = c.name.trim().split(/\s+/).filter(Boolean);
    setStep1({
      firstName: p?.firstName ?? nameParts[0] ?? "",
      lastName: p?.lastName ?? nameParts.slice(1).join(" ") ?? "",
      dateOfBirth: p?.dateOfBirth ?? "",
      gender: p?.gender ?? "",
    });
    setStep2({ file: null });
    setStep3({
      maladaptiveBehaviors: [...(p?.maladaptiveBehaviors ?? [])],
      maladaptiveBehaviorTargets: Object.fromEntries(
        (p?.maladaptiveBehaviorTargets ?? []).map((e) => [e.name, e.topography ?? ""])
      ),
      replacementPrograms: [...(p?.replacementPrograms ?? [])],
      skillAcquisitionPrograms: [...(p?.skillAcquisitionPrograms ?? [])],
      interventions: [...(p?.interventions ?? [])],
    });
    setAuthorizationExpiresOn(p?.assessmentAuthorizationExpiresOn ?? null);
    // Preserve step parameter from URL if provided, otherwise default to 1
    const urlStep = searchParams.get("step");
    if (!urlStep) {
      setStep(1);
    }
    setHydrated(true);
  }, [isEdit, detailLoading, detailError, detailRes, setLocation]);

  function cancelDestination() {
    if (isEdit) return "/clients";
    return returnTo === "wizard" ? "/wizard" : "/clients";
  }

  function goBack() {
    if (isSectionEdit) {
      setLocation("/clients");
      return;
    }
    if (isFirstStep) setLocation(cancelDestination());
    else if (typeof prevStep === "number") setStep(prevStep);
  }

  function canContinue() {
    if (step === 1) {
      return (
        step1.firstName.trim() !== "" &&
        step1.lastName.trim() !== "" &&
        step1.dateOfBirth.length === 10 &&
        step1.gender !== ""
      );
    }
    return true;
  }

  function canSaveSection(): boolean {
    if (!editSection) return false;
    if (editSection === "personal") {
      return (
        step1.firstName.trim() !== "" &&
        step1.lastName.trim() !== "" &&
        step1.dateOfBirth.length === 10 &&
        step1.gender !== ""
      );
    }
    if (editSection === "assessment") {
      return step2.file !== null;
    }
    return true;
  }

  async function handleSectionSave() {
    if (!isSectionEdit || !editSection) return;
    setSaving(true);
    setSaveError(null);
    try {
      let payload: UpdateClientRequest = {};
      if (editSection === "personal") {
        payload = {
          firstName: step1.firstName.trim(),
          lastName: step1.lastName.trim(),
          dateOfBirth: step1.dateOfBirth,
          gender: step1.gender,
        };
      } else if (editSection === "behaviors") {
        payload = {
          maladaptiveBehaviors: step3.maladaptiveBehaviors,
          maladaptiveBehaviorTargets: step3.maladaptiveBehaviors.map((name) => ({
            name,
            topography: step3.maladaptiveBehaviorTargets[name]?.trim() || null,
          })),
        };
      } else if (editSection === "programs") {
        payload = {
          replacementPrograms: step3.replacementPrograms,
          skillAcquisitionPrograms: step3.skillAcquisitionPrograms,
        };
      } else if (editSection === "assessment") {
        if (!step2.file) {
          setSaveError("Choose a PDF file to upload.");
          setSaving(false);
          return;
        }
        await uploadClientAssessmentDocument(numericId, { file: step2.file });
        await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
        setSaving(false);
        setLocation("/clients");
        return;
      } else {
        payload = { interventions: step3.interventions };
      }
      await updateClient(numericId, payload);
      // For the behaviors section, flush every behavior's draft approved-program selections
      // before invalidating queries (otherwise the approvalsQ refetch would reset the drafts).
      if (editSection === "behaviors") {
        const flushResult = await flushBehaviorApprovalsRef.current?.();
        if (flushResult && !flushResult.ok) {
          await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
          await queryClient.invalidateQueries({
            queryKey: ["/api/clients", numericId, "behavior-program-approvals"],
          });
          const failed = Object.entries(flushResult.errors)
            .map(([name, msg]) => `${name}: ${msg}`)
            .join("; ");
          setSaving(false);
          setSaveError(`Saved behaviors, but some approved-program saves failed — ${failed}`);
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
      await queryClient.invalidateQueries({
        queryKey: ["/api/clients", numericId, "behavior-program-approvals"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/clients", numericId, "replacement-programs"],
      });
      setSaving(false);
      setLocation("/clients");
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : "Save failed. Try again.");
    }
  }

  async function handleNext() {
    if (isSectionEdit) return;
    if (!isLastStep && typeof nextStep === "number") {
      setSaveError(null);
      setStep(nextStep);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit && !isSectionEdit) {
        const payload: UpdateClientRequest = {
          firstName: step1.firstName.trim(),
          lastName: step1.lastName.trim(),
          dateOfBirth: step1.dateOfBirth,
          gender: step1.gender,
          maladaptiveBehaviors: step3.maladaptiveBehaviors,
          maladaptiveBehaviorTargets: step3.maladaptiveBehaviors.map((name) => ({
            name,
            topography: step3.maladaptiveBehaviorTargets[name]?.trim() || null,
          })),
          replacementPrograms: step3.replacementPrograms,
          skillAcquisitionPrograms: step3.skillAcquisitionPrograms,
          interventions: step3.interventions,
          assessmentAuthorizationExpiresOn: authorizationExpiresOn,
        };
        if (step2.file) {
          payload.hasAssessment = true;
          payload.assessmentStatus = "uploaded";
          payload.assessmentFileName = step2.file.name;
        }
        await updateClient(numericId, payload);
        if (step2.file) {
          await uploadClientAssessmentDocument(numericId, { file: step2.file });
        }
        // Flush every behavior's draft approved-program selections (registered by BehaviorSection
        // when it renders inside Step3) before invalidating queries, so the user's per-behavior
        // program selections save in the same "Save changes" click as the rest of the profile.
        const flushResult = await flushBehaviorApprovalsRef.current?.();
        if (flushResult && !flushResult.ok) {
          await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
          await queryClient.invalidateQueries({
            queryKey: ["/api/clients", numericId, "behavior-program-approvals"],
          });
          const failed = Object.entries(flushResult.errors)
            .map(([name, msg]) => `${name}: ${msg}`)
            .join("; ");
          setSaving(false);
          setSaveError(`Saved client, but some approved-program saves failed — ${failed}`);
          return;
        }
      } else {
        const created = await createClient({
          firstName: step1.firstName.trim(),
          lastName: step1.lastName.trim(),
          dateOfBirth: step1.dateOfBirth,
          gender: step1.gender,
          hasAssessment: !!step2.file,
          assessmentStatus: step2.file ? "uploaded" : "missing",
          assessmentFileName: step2.file?.name ?? null,
          maladaptiveBehaviors: step3.maladaptiveBehaviors,
          maladaptiveBehaviorTargets: step3.maladaptiveBehaviors.map((name) => ({
            name,
            topography: step3.maladaptiveBehaviorTargets[name]?.trim() || null,
          })),
          replacementPrograms: step3.replacementPrograms,
          skillAcquisitionPrograms: step3.skillAcquisitionPrograms,
          interventions: step3.interventions,
          assessmentAuthorizationExpiresOn: authorizationExpiresOn,
        });
        if (step2.file) {
          await uploadClientAssessmentDocument(created.data.id, { file: step2.file });
        }
        // Fire-and-forget avatar generation. We don't await: the request can take ~5–15s and we want
        // the user back on the clients page immediately. The clients-list query is invalidated by the
        // hook on success, so the avatar swaps in for the new card the next time it renders.
        const newClientId = created.data.id;
        generateAvatarMutation.mutate(newClientId, {
          onError: (err) => {
            // Log only — never block the create flow on avatar generation. The user can retry later
            // from the edit screen.
            const msg = err instanceof Error ? err.message : "Avatar generation failed";
            console.warn(`Avatar generation failed for new client ${newClientId}:`, msg);
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (isEdit && !isSectionEdit) {
        await queryClient.invalidateQueries({ queryKey: ["/api/clients", numericId] });
      }
      setSaving(false);
      setLocation(returnTo === "wizard" && !isEdit ? "/wizard" : "/clients");
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : "Save failed. Try again.");
    }
  }

  if (isEdit && !hydrated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#C27A8A]" />
        <p className="text-sm text-[#877870]">Loading client…</p>
      </div>
    );
  }

  const priorAssessmentFileName =
    isEdit && !step2.file && detailRes?.data?.profile?.assessmentFileName
      ? (detailRes.data.profile.assessmentFileName ?? undefined)
      : undefined;

  if (isSectionEdit && editSection) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SectionEditHeader
          title={SECTION_EDIT_LABELS[editSection]}
          onBack={() => setLocation("/clients")}
          onCancel={() => setLocation("/clients")}
        />

        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={editSection}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2523] tracking-tight">
                  {SECTION_EDIT_LABELS[editSection]}
                </h2>
                <p className="text-[#877870] mt-1">{SECTION_EDIT_SUBTITLES[editSection]}</p>
              </div>

              {editSection === "personal" && (
                <Step1 data={step1} onChange={setStep1} avatarPanel={renderEditModeAvatarPanel()} />
              )}
              {editSection === "assessment" && (
                <Step2
                  data={step2}
                  onChange={setStep2}
                  priorAssessmentFileName={priorAssessmentFileName}
                  extracting={extractMutation.isPending}
                  extractError={extractError}
                  extractSuccess={extractSuccess}
                  onExtractFromPdf={handleExtractFromPdf}
                  onClearStoredAssessment={handleClearStoredAssessment}
                  clearingStoredAssessment={clearingStoredAssessment}
                  authorizationExpiresOn={authorizationExpiresOn}
                  onAuthorizationExpiresOnChange={setAuthorizationExpiresOn}
                />
              )}
              {editSection !== "personal" && editSection !== "assessment" && (
                <div className="space-y-5">
                  <p className="text-[#877870] text-sm leading-relaxed">
                    These details are used when generating session notes.
                  </p>
                  <Step3SingleSection
                    section={editSection}
                    data={step3}
                    onChange={setStep3}
                    clientId={numericId}
                    onPersistBehaviors={persistBehaviorsToProfile}
                    flushApprovalsRef={flushBehaviorApprovalsRef}
                  />
                </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                {saveError && (
                  <p className="text-sm text-rose-600 font-medium">{saveError}</p>
                )}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSectionSave}
                    disabled={!canSaveSection() || saving}
                    className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    style={{ background: "#C27A8A", boxShadow: "0 8px 20px rgba(194,122,138,0.25)" }}
                  >
                    {saving ? (
                      "Saving…"
                    ) : editSection === "assessment" ? (
                      <>
                        <Upload className="w-4 h-4 pop-icon-white" /> Upload PDF
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 pop-icon-white" /> Save changes
                      </>
                    )}
                  </button>
                  <span className="text-sm text-[#877870] font-medium">
                    {editSection === "personal"
                      ? canSaveSection()
                        ? "Looking good!"
                        : "Fill in all fields to save"
                      : editSection === "assessment"
                        ? canSaveSection()
                          ? "Save uploads the new PDF to the server."
                          : "Select a PDF to save, or remove the current file with the button above."
                        : "Press Enter or + to add each item"}
                  </span>
                </div>
              </div>

              <div className="mt-12 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
                <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Danger zone
                </h3>
                <p className="text-xs text-rose-700/80 mt-1 leading-relaxed">
                  Permanently delete this client, all their session notes, program links, and behavior approvals.
                  This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteClientFromEdit}
                  disabled={deleteClientMutation.isPending}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4 pop-icon-white" />
                  {deleteClientMutation.isPending ? "Deleting…" : "Delete client"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ProgressHeader
        step={step}
        onBack={goBack}
        onCancel={() => setLocation(cancelDestination())}
        mode={isEdit ? "edit" : "create"}
      />
      {!isSectionEdit && (
        <StepBar
          progress={(safeStepIndex + 1) / STEP_ORDER.length}
        />
      )}

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Step indicator dots — full wizard only (not section edit). Render in the wizard's actual order
            (assessment-first vs canonical) so the highlighted dot tracks the user's true position. */}
        {!isSectionEdit && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {STEP_ORDER.map((n, i) => (
              <div
                key={n}
                className={`rounded-full transition-all duration-300 ${
                  i < safeStepIndex
                    ? "w-6 h-2 bg-[#C27A8A]"
                    : i === safeStepIndex
                    ? "w-8 h-2 bg-[#C27A8A]"
                    : "w-2 h-2 bg-[#F0E4E1]"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step heading */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#2D2523] tracking-tight">
                {step === 1 && (isEdit ? "Update client" : "Client Information")}
                {step === 2 && "Assessment PDF"}
                {step === 3 && "Programs & Behaviors"}
              </h2>
              <p className="text-[#877870] mt-1">
                {step === 1 &&
                  (isEdit
                    ? "Update name, date of birth, or gender."
                    : "Enter the client's basic information.")}
                {step === 2 &&
                  (isEdit
                    ? "Replace the assessment PDF or keep the current file."
                    : "Upload their behavior assessment document.")}
                {step === 3 &&
                  (isEdit
                    ? "Update behaviors, programs, and interventions."
                    : "Add their treatment targets and strategies.")}
              </p>
            </div>

            {step === 1 && returnTo === "wizard" && !isEdit && (
              <WizardExistingClientPicker onChosen={() => setLocation("/wizard")} />
            )}

            {step === 1 && (
              <Step1
                data={step1}
                onChange={setStep1}
                avatarPanel={isEdit ? renderEditModeAvatarPanel() : undefined}
              />
            )}
            {step === 2 && (
              <Step2
                data={step2}
                onChange={setStep2}
                priorAssessmentFileName={priorAssessmentFileName}
                extracting={extractMutation.isPending}
                extractError={extractError}
                extractSuccess={extractSuccess}
                onExtractFromPdf={handleExtractFromPdf}
                onClearStoredAssessment={isEdit ? handleClearStoredAssessment : undefined}
                clearingStoredAssessment={clearingStoredAssessment}
                authorizationExpiresOn={authorizationExpiresOn}
                onAuthorizationExpiresOnChange={setAuthorizationExpiresOn}
              />
            )}
            {step === 3 && (
              <Step3
                data={step3}
                onChange={setStep3}
                clientId={isEdit ? numericId : undefined}
                onPersistBehaviors={isEdit ? persistBehaviorsToProfile : undefined}
                flushApprovalsRef={isEdit ? flushBehaviorApprovalsRef : undefined}
              />
            )}

            <div className="mt-8 flex flex-col gap-2">
              {saveError && (
                <p className="text-sm text-rose-600 font-medium">{saveError}</p>
              )}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleNext}
                  disabled={!canContinue() || saving}
                  className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ background: "#C27A8A", boxShadow: "0 8px 20px rgba(194,122,138,0.25)" }}
                >
                  {saving ? (
                    <>Saving...</>
                  ) : isLastStep ? (
                    <>
                      <User className="w-4 h-4 pop-icon-white" /> {isEdit ? "Save changes" : "Save Client"}
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="w-4 h-4 pop-icon-white" />
                    </>
                  )}
                </button>
                <span className="text-sm text-[#877870] font-medium">
                  {step === 2 &&
                    !step2.file &&
                    (priorAssessmentFileName
                      ? "Keeping current PDF unless you upload a new one"
                      : "You can skip this step")}
                  {step === 3 && "Press Enter or + to add each item"}
                  {step === 1 && (canContinue() ? "Looking good!" : "Fill in all fields to continue")}
                </span>
              </div>
            </div>

            {isEdit && step === 3 && (
              <div className="mt-12 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
                <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Danger zone
                </h3>
                <p className="text-xs text-rose-700/80 mt-1 leading-relaxed">
                  Permanently delete this client, all their session notes, program links, and behavior approvals.
                  This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteClientFromEdit}
                  disabled={deleteClientMutation.isPending}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4 pop-icon-white" />
                  {deleteClientMutation.isPending ? "Deleting…" : "Delete client"}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/** Edit flow: `/clients/edit/:clientId?section=personal|assessment|behaviors|programs|interventions` */
export function EditClientPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const search = useSearch();
  if (!clientId) return <Redirect to="/clients" />;
  const n = Number.parseInt(clientId, 10);
  if (!Number.isFinite(n) || n <= 0) return <Redirect to="/clients" />;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sectionRaw = params.get("section");
  const stepRaw = params.get("step");
  
  // If step parameter is provided, skip section validation (allow multi-step form)
  if (stepRaw) {
    return <NewClientForm editClientId={clientId} />;
  }
  
  // Otherwise, require a valid section parameter
  if (!isEditSection(sectionRaw)) {
    return <Redirect to={`/clients/edit/${clientId}?section=personal`} />;
  }
  return <NewClientForm editClientId={clientId} editSection={sectionRaw} />;
}

export default function NewClient() {
  return <NewClientForm />;
}
