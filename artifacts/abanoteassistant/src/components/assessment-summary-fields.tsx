import { BookOpen, ClipboardList, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ClientAssessmentSummary } from "@workspace/api-client-react";

export type AssessmentSummaryFormState = {
  assessor: string;
  assessmentDate: string;
  authorizedHours: string;
  summary: string;
  diagnoses: string[];
  recommendations: string[];
  medicalHistory: string;
  behaviorProfiles: string[];
  reinforcementPreferences: string[];
  precursorBehaviors: string[];
  crisisProtocol: string;
  parentTrainingGoals: string[];
  supervisorRequirements: string;
};

export function emptyAssessmentSummaryForm(): AssessmentSummaryFormState {
  return {
    assessor: "",
    assessmentDate: "",
    authorizedHours: "",
    summary: "",
    diagnoses: [],
    recommendations: [],
    medicalHistory: "",
    behaviorProfiles: [],
    reinforcementPreferences: [],
    precursorBehaviors: [],
    crisisProtocol: "",
    parentTrainingGoals: [],
    supervisorRequirements: "",
  };
}

export function assessmentSummaryFormFromProfile(
  raw?: ClientAssessmentSummary | null,
): AssessmentSummaryFormState {
  if (!raw) return emptyAssessmentSummaryForm();
  return {
    assessor: raw.assessor ?? "",
    assessmentDate: raw.assessmentDate ?? "",
    authorizedHours: raw.authorizedHours ?? "",
    summary: raw.summary ?? "",
    diagnoses: [...(raw.diagnoses ?? [])],
    recommendations: [...(raw.recommendations ?? [])],
    medicalHistory: raw.medicalHistory ?? "",
    behaviorProfiles: [...(raw.behaviorProfiles ?? [])],
    reinforcementPreferences: [...(raw.reinforcementPreferences ?? [])],
    precursorBehaviors: [...(raw.precursorBehaviors ?? [])],
    crisisProtocol: raw.crisisProtocol ?? "",
    parentTrainingGoals: [...(raw.parentTrainingGoals ?? [])],
    supervisorRequirements: raw.supervisorRequirements ?? "",
  };
}

export function assessmentSummaryFormFromExtract(
  raw?: ClientAssessmentSummary,
): AssessmentSummaryFormState {
  return assessmentSummaryFormFromProfile(raw ?? null);
}

export function assessmentSummaryToApiPayload(
  form: AssessmentSummaryFormState,
): ClientAssessmentSummary {
  return {
    assessor: form.assessor.trim() || null,
    assessmentDate: form.assessmentDate.trim() || null,
    authorizedHours: form.authorizedHours.trim() || null,
    summary: form.summary.trim() || null,
    diagnoses: form.diagnoses.map((s) => s.trim()).filter(Boolean),
    recommendations: form.recommendations.map((s) => s.trim()).filter(Boolean),
    medicalHistory: form.medicalHistory.trim() || null,
    behaviorProfiles: form.behaviorProfiles.map((s) => s.trim()).filter(Boolean),
    reinforcementPreferences: form.reinforcementPreferences.map((s) => s.trim()).filter(Boolean),
    precursorBehaviors: form.precursorBehaviors.map((s) => s.trim()).filter(Boolean),
    crisisProtocol: form.crisisProtocol.trim() || null,
    parentTrainingGoals: form.parentTrainingGoals.map((s) => s.trim()).filter(Boolean),
    supervisorRequirements: form.supervisorRequirements.trim() || null,
  };
}

export function assessmentSummaryHasContent(form: AssessmentSummaryFormState): boolean {
  const api = assessmentSummaryToApiPayload(form);
  return (
    !!api.assessor ||
    !!api.assessmentDate ||
    !!api.authorizedHours ||
    !!api.summary ||
    !!api.medicalHistory ||
    !!api.crisisProtocol ||
    !!api.supervisorRequirements ||
    (api.diagnoses?.length ?? 0) > 0 ||
    (api.recommendations?.length ?? 0) > 0 ||
    (api.behaviorProfiles?.length ?? 0) > 0 ||
    (api.reinforcementPreferences?.length ?? 0) > 0 ||
    (api.precursorBehaviors?.length ?? 0) > 0 ||
    (api.parentTrainingGoals?.length ?? 0) > 0
  );
}

function SummaryTagList({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t) return;
    if (items.some((i) => i.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, t]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-widest text-[#877870]">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#FDFAF7] text-[#2D2523] border-[#F0E4E1]"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-[#877870] hover:text-rose-600"
              aria-label={`Remove ${item}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-sm text-[#2D2523] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/40"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 rounded-lg border border-[#F0E4E1] text-[#C27A8A] hover:bg-[#FCEEF1] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SummaryTextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-widest text-[#877870]">{label}</label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-sm text-[#2D2523] focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/40 resize-y min-h-[5rem]"
      />
    </div>
  );
}

export function AssessmentSummaryFields({
  value,
  onChange,
  compact,
}: {
  value: AssessmentSummaryFormState;
  onChange: (next: AssessmentSummaryFormState) => void;
  /** When true, hide the section intro (edit section mode). */
  compact?: boolean;
}) {
  const patch = (partial: Partial<AssessmentSummaryFormState>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-5">
      {!compact ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FDFAF7] border border-[#F0E4E1]">
          <div className="w-10 h-10 rounded-xl bg-[#FCEEF1] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-[#C27A8A]" />
          </div>
          <div>
            <p className="font-semibold text-[#2D2523] text-sm">Assessment summary</p>
            <p className="text-xs text-[#877870] mt-1 leading-relaxed">
              Imported from the PDF when available. Review diagnosis, recommendations, medical history, and
              other overview sections before saving the client.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#877870]">Assessor</label>
          <input
            type="text"
            value={value.assessor}
            placeholder="e.g. Annia Soto, BCBA"
            onChange={(e) => patch({ assessor: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#877870]">
            Assessment date
          </label>
          <input
            type="date"
            value={value.assessmentDate}
            onChange={(e) => patch({ assessmentDate: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#F0E4E1] bg-[#FDFAF7] text-sm"
          />
        </div>
      </div>

      <SummaryTextArea
        label="Authorized hours"
        value={value.authorizedHours}
        onChange={(authorizedHours) => patch({ authorizedHours })}
        rows={3}
        placeholder="e.g. 30 hours/week RBT, 5 hours/week Lead Analyst..."
      />

      <SummaryTextArea
        label="Summary"
        value={value.summary}
        onChange={(summary) => patch({ summary })}
        rows={5}
        placeholder="Clinical overview paragraph from the assessment..."
      />

      <SummaryTagList
        label="Diagnosis"
        placeholder="Add a diagnosis line..."
        items={value.diagnoses}
        onChange={(diagnoses) => patch({ diagnoses })}
      />

      <SummaryTagList
        label="Recommendations"
        placeholder="Add a recommendation..."
        items={value.recommendations}
        onChange={(recommendations) => patch({ recommendations })}
      />

      <SummaryTextArea
        label="Medical history"
        value={value.medicalHistory}
        onChange={(medicalHistory) => patch({ medicalHistory })}
        rows={4}
      />

      <SummaryTagList
        label="Behavior profiles"
        placeholder="Add a behavior profile label..."
        items={value.behaviorProfiles}
        onChange={(behaviorProfiles) => patch({ behaviorProfiles })}
      />

      <SummaryTagList
        label="Reinforcement preferences"
        placeholder="Add reinforcer or preference..."
        items={value.reinforcementPreferences}
        onChange={(reinforcementPreferences) => patch({ reinforcementPreferences })}
      />

      <SummaryTagList
        label="Precursor behaviors"
        placeholder="Add precursor behavior..."
        items={value.precursorBehaviors}
        onChange={(precursorBehaviors) => patch({ precursorBehaviors })}
      />

      <SummaryTextArea
        label="Crisis protocol"
        value={value.crisisProtocol}
        onChange={(crisisProtocol) => patch({ crisisProtocol })}
        rows={5}
      />

      <SummaryTagList
        label="Parent training goals"
        placeholder="Add caregiver training goal..."
        items={value.parentTrainingGoals}
        onChange={(parentTrainingGoals) => patch({ parentTrainingGoals })}
      />

      <SummaryTextArea
        label="Supervisor requirements"
        value={value.supervisorRequirements}
        onChange={(supervisorRequirements) => patch({ supervisorRequirements })}
        rows={4}
      />
    </div>
  );
}

export function AssessmentSummaryReadOnly({ summary }: { summary: ClientAssessmentSummary }) {
  const list = (title: string, items?: string[]) =>
    items && items.length > 0 ? (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#877870]">{title}</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-[#2D2523]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null;

  const prose = (title: string, text?: string | null) =>
    text?.trim() ? (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#877870]">{title}</h3>
        <p className="text-sm text-[#2D2523] leading-relaxed whitespace-pre-wrap">{text.trim()}</p>
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[#C27A8A]">
        <BookOpen className="w-4 h-4" />
        <h2 className="text-sm font-bold text-[#2D2523]">Assessment summary</h2>
      </div>
      {(summary.assessor || summary.assessmentDate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {summary.assessor ? (
            <div>
              <span className="text-xs font-semibold text-[#877870] uppercase tracking-wide">Assessor</span>
              <p className="text-[#2D2523] mt-0.5">{summary.assessor}</p>
            </div>
          ) : null}
          {summary.assessmentDate ? (
            <div>
              <span className="text-xs font-semibold text-[#877870] uppercase tracking-wide">
                Assessment date
              </span>
              <p className="text-[#2D2523] mt-0.5">{summary.assessmentDate}</p>
            </div>
          ) : null}
        </div>
      )}
      {prose("Authorized hours", summary.authorizedHours)}
      {prose("Summary", summary.summary)}
      {list("Diagnosis", summary.diagnoses)}
      {list("Recommendations", summary.recommendations)}
      {prose("Medical history", summary.medicalHistory)}
      {list("Behavior profiles", summary.behaviorProfiles)}
      {list("Reinforcement preferences", summary.reinforcementPreferences)}
      {list("Precursor behaviors", summary.precursorBehaviors)}
      {prose("Crisis protocol", summary.crisisProtocol)}
      {list("Parent training goals", summary.parentTrainingGoals)}
      {prose("Supervisor requirements", summary.supervisorRequirements)}
    </div>
  );
}
