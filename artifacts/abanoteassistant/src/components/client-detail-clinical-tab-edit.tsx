import { useState } from "react";
import { AlertTriangle, BookOpen, Loader2, Pencil, Plus, Shield, X, Zap } from "lucide-react";
import {
  updateClient,
  type ClinicalFunction,
  type ClientProfile,
  type MaladaptiveBehaviorProfileEntry,
  type UpdateClientRequest,
} from "@workspace/api-client-react";
import { formatClinicalFunctionsDisplay } from "@/lib/clinical-behavior-function-display";

export type ClinicalTabSection = "behaviors" | "programs" | "interventions";

export type ClinicalProfileDraft = {
  maladaptiveBehaviors: string[];
  maladaptiveBehaviorTargets: Record<string, string>;
  maladaptiveBehaviorFunctions: Record<string, ClinicalFunction[] | null | undefined>;
  replacementPrograms: string[];
  skillAcquisitionPrograms: string[];
  interventions: string[];
};

export function clinicalProfileDraftFromClient(profile: ClientProfile | undefined): ClinicalProfileDraft {
  const targets = profile?.maladaptiveBehaviorTargets ?? [];
  const maladaptiveBehaviorTargets: Record<string, string> = {};
  const maladaptiveBehaviorFunctions: Record<string, ClinicalFunction[] | null | undefined> = {};
  for (const entry of targets) {
    if (entry.topography?.trim()) {
      maladaptiveBehaviorTargets[entry.name] = entry.topography.trim();
    }
    if (entry.functions !== undefined) {
      maladaptiveBehaviorFunctions[entry.name] = entry.functions;
    }
  }
  return {
    maladaptiveBehaviors: profile?.maladaptiveBehaviors ?? [],
    maladaptiveBehaviorTargets,
    maladaptiveBehaviorFunctions,
    replacementPrograms: profile?.replacementPrograms ?? [],
    skillAcquisitionPrograms: profile?.skillAcquisitionPrograms ?? [],
    interventions: profile?.interventions ?? [],
  };
}

export function maladaptiveBehaviorTargetsPayload(
  behaviors: string[],
  targets: Record<string, string>,
  functions: Record<string, ClinicalFunction[] | null | undefined>,
): MaladaptiveBehaviorProfileEntry[] {
  return behaviors.map((name) => {
    const entry: MaladaptiveBehaviorProfileEntry = {
      name,
      topography: targets[name]?.trim() || null,
    };
    if (Object.prototype.hasOwnProperty.call(functions, name)) {
      entry.functions = functions[name] ?? null;
    }
    return entry;
  });
}

function buildUpdatePayload(section: ClinicalTabSection, draft: ClinicalProfileDraft): UpdateClientRequest {
  if (section === "behaviors") {
    return {
      maladaptiveBehaviors: draft.maladaptiveBehaviors,
      maladaptiveBehaviorTargets: maladaptiveBehaviorTargetsPayload(
        draft.maladaptiveBehaviors,
        draft.maladaptiveBehaviorTargets,
        draft.maladaptiveBehaviorFunctions,
      ),
    };
  }
  if (section === "programs") {
    return {
      replacementPrograms: draft.replacementPrograms,
      skillAcquisitionPrograms: draft.skillAcquisitionPrograms,
    };
  }
  return { interventions: draft.interventions };
}

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDFAF7] border border-[#F0E4E1] text-sm text-[#2D2523] font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[#877870] hover:text-[#C27A8A] hover:bg-[#F0E4E1] transition-colors"
        aria-label={`Remove ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function TagListEditor({
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
  onRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (!value || items.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onAdd(value);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-[#F0E4E1] bg-[#FDFAF7] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-semibold text-[#2D2523] text-sm">{title}</h3>
        <span className="ml-auto text-xs text-[#877870]">{items.length} added</span>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {items.length === 0 ? (
          <span className="text-sm text-[#877870] italic">None added yet</span>
        ) : (
          items.map((item, index) => (
            <TagChip key={`${item}-${index}`} label={item} onRemove={() => onRemove(index)} />
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg border border-[#F0E4E1] bg-white text-sm text-[#2D2523] placeholder:text-[#877870] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A]"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="w-9 h-9 rounded-lg bg-[#C27A8A] text-white flex items-center justify-center hover:bg-[#b06a79] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BehaviorListEditor({
  draft,
  onChange,
}: {
  draft: ClinicalProfileDraft;
  onChange: (next: ClinicalProfileDraft) => void;
}) {
  const [behaviorDraft, setBehaviorDraft] = useState("");

  function addBehavior(value: string) {
    onChange({
      ...draft,
      maladaptiveBehaviors: [...draft.maladaptiveBehaviors, value],
    });
  }

  function removeBehavior(index: number) {
    const name = draft.maladaptiveBehaviors[index];
    const nextTargets = { ...draft.maladaptiveBehaviorTargets };
    const nextFunctions = { ...draft.maladaptiveBehaviorFunctions };
    delete nextTargets[name];
    delete nextFunctions[name];
    onChange({
      ...draft,
      maladaptiveBehaviors: draft.maladaptiveBehaviors.filter((_, i) => i !== index),
      maladaptiveBehaviorTargets: nextTargets,
      maladaptiveBehaviorFunctions: nextFunctions,
    });
  }

  function setTopography(name: string, value: string) {
    onChange({
      ...draft,
      maladaptiveBehaviorTargets: { ...draft.maladaptiveBehaviorTargets, [name]: value },
    });
  }

  function commitBehavior() {
    const value = behaviorDraft.trim();
    if (!value || draft.maladaptiveBehaviors.some((b) => b.toLowerCase() === value.toLowerCase())) return;
    addBehavior(value);
    setBehaviorDraft("");
  }

  return (
    <div className="rounded-xl border border-[#F0E4E1] bg-[#FDFAF7] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
        </div>
        <h3 className="font-semibold text-[#2D2523] text-sm">Maladaptive Behaviors</h3>
        <span className="ml-auto text-xs text-[#877870]">{draft.maladaptiveBehaviors.length} added</span>
      </div>

      <div className="space-y-2">
        {draft.maladaptiveBehaviors.length === 0 ? (
          <p className="text-sm text-[#877870] italic">None added yet</p>
        ) : (
          draft.maladaptiveBehaviors.map((behavior, index) => (
            <div
              key={`${behavior}-${index}`}
              className="rounded-xl border border-[#F0E4E1] bg-white px-4 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#877870]">Behavior</p>
                  <p className="text-sm font-semibold text-[#2D2523]">{behavior}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeBehavior(index)}
                  className="text-[#877870] hover:text-rose-600 transition-colors shrink-0"
                  aria-label={`Remove ${behavior}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#877870]">Function</p>
                <p className="text-xs text-[#2D2523] leading-relaxed">
                  {formatClinicalFunctionsDisplay(
                    Object.prototype.hasOwnProperty.call(draft.maladaptiveBehaviorFunctions, behavior)
                      ? draft.maladaptiveBehaviorFunctions[behavior]
                      : undefined,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#877870] mb-1">Topography</p>
                <textarea
                  value={draft.maladaptiveBehaviorTargets[behavior] ?? ""}
                  onChange={(e) => setTopography(behavior, e.target.value)}
                  placeholder="Topography / operational definition (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-xs text-[#2D2523] placeholder:text-[#877870]/70 focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] resize-none"
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={behaviorDraft}
          onChange={(e) => setBehaviorDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitBehavior();
            }
          }}
          placeholder="e.g. Physical Aggression, Task Refusal..."
          className="flex-1 px-3 py-2 rounded-lg border border-[#F0E4E1] bg-white text-sm text-[#2D2523] placeholder:text-[#877870] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A]"
        />
        <button
          type="button"
          onClick={commitBehavior}
          disabled={!behaviorDraft.trim()}
          className="w-9 h-9 rounded-lg bg-[#C27A8A] text-white flex items-center justify-center hover:bg-[#b06a79] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ClientDetailClinicalTabEditor({
  section,
  clientId,
  initialDraft,
  onCancel,
  onSaved,
  labels,
}: {
  section: ClinicalTabSection;
  clientId: number;
  initialDraft: ClinicalProfileDraft;
  onCancel: () => void;
  onSaved: () => void;
  labels: {
    save: string;
    saving: string;
    cancel: string;
    saveFailed: string;
  };
}) {
  const [draft, setDraft] = useState<ClinicalProfileDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateClient(clientId, buildUpdatePayload(section, draft));
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : labels.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {section === "behaviors" ? (
        <BehaviorListEditor draft={draft} onChange={setDraft} />
      ) : section === "programs" ? (
        <div className="space-y-4">
          <TagListEditor
            title="Replacement Programs"
            icon={Zap}
            iconColor="text-[#C27A8A]"
            iconBg="bg-[#FCEEF1]"
            placeholder="e.g. Mand for desired items, Functional Play..."
            items={draft.replacementPrograms}
            onAdd={(value) =>
              setDraft((current) => ({
                ...current,
                replacementPrograms: [...current.replacementPrograms, value],
              }))
            }
            onRemove={(index) =>
              setDraft((current) => ({
                ...current,
                replacementPrograms: current.replacementPrograms.filter((_, i) => i !== index),
              }))
            }
          />
          <TagListEditor
            title="Skill Acquisition Programs"
            icon={BookOpen}
            iconColor="text-sky-700"
            iconBg="bg-sky-50"
            placeholder="e.g. Echoic skills, Manding skills..."
            items={draft.skillAcquisitionPrograms}
            onAdd={(value) =>
              setDraft((current) => ({
                ...current,
                skillAcquisitionPrograms: [...current.skillAcquisitionPrograms, value],
              }))
            }
            onRemove={(index) =>
              setDraft((current) => ({
                ...current,
                skillAcquisitionPrograms: current.skillAcquisitionPrograms.filter((_, i) => i !== index),
              }))
            }
          />
        </div>
      ) : (
        <TagListEditor
          title="Interventions"
          icon={Shield}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          placeholder="e.g. Token economy, Redirection, DRI..."
          items={draft.interventions}
          onAdd={(value) =>
            setDraft((current) => ({
              ...current,
              interventions: [...current.interventions, value],
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              interventions: current.interventions.filter((_, i) => i !== index),
            }))
          }
        />
      )}

      {saveError ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{saveError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C27A8A] text-white text-sm font-semibold hover:bg-[#b06a79] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? labels.saving : labels.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-[#F0E4E1] bg-white text-sm font-semibold text-[#877870] hover:border-[#C27A8A] hover:text-[#C27A8A] disabled:opacity-50 transition-colors"
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}

export function TabInlineEditToolbar({
  isEditing,
  onEdit,
  editLabel,
}: {
  isEditing: boolean;
  onEdit: () => void;
  editLabel: string;
}) {
  if (isEditing) return null;
  return (
    <div className="flex justify-end mb-3">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-xs font-semibold text-[#877870] hover:border-[#C27A8A] hover:text-[#C27A8A] transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        {editLabel}
      </button>
    </div>
  );
}
