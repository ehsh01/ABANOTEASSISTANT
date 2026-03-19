import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  X,
  Plus,
  CheckCircle2,
  User,
  AlertTriangle,
  Zap,
  Shield,
} from "lucide-react";
import { useClientsStore, type Client } from "@/store/clients-store";
import { generateId } from "@/lib/utils";

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
  replacementPrograms: string[];
  interventions: string[];
}

// ── DOB formatter ────────────────────────────────────────────────────────────
function formatDOB(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
        <X className="w-3 h-3" />
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
          <Icon className={`w-5 h-5 ${iconColor}`} />
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
          <Plus className="w-5 h-5" />
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
}: {
  step: number;
  onBack: () => void;
  onCancel: () => void;
}) {
  const labels = ["Personal Info", "Assessment", "Programs & Behaviors"];
  return (
    <header className="bg-primary sticky top-0 z-50 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors font-semibold text-sm"
      >
        <ChevronLeft className="w-5 h-5" />
        Back
      </button>
      <div className="text-center">
        <div className="text-white font-bold text-sm">{labels[step - 1]}</div>
        <div className="text-white/60 text-xs mt-0.5">Step {step} of 3</div>
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

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  return (
    <div className="w-full h-1 bg-[#F0E4E1]">
      <div
        className="h-full bg-[#C27A8A] transition-all duration-500 ease-out"
        style={{ width: `${(step / 3) * 100}%` }}
      />
    </div>
  );
}

// ── Step 1 ───────────────────────────────────────────────────────────────────
function Step1({
  data,
  onChange,
}: {
  data: Step1Data;
  onChange: (d: Step1Data) => void;
}) {
  const genders = ["Male", "Female", "Non-binary", "Prefer not to say"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* First name */}
        <div>
          <label className="block text-sm font-semibold text-[#2D2523] mb-2">First Name</label>
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
          <label className="block text-sm font-semibold text-[#2D2523] mb-2">Last Name</label>
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
        <label className="block text-sm font-semibold text-[#2D2523] mb-2">
          Date of Birth
          <span className="ml-2 text-xs font-normal text-[#877870]">mm/dd/yyyy</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={data.dateOfBirth}
          onChange={(e) => onChange({ ...data, dateOfBirth: formatDOB(e.target.value) })}
          placeholder="mm/dd/yyyy"
          maxLength={10}
          className="w-full px-4 py-3 rounded-xl border border-[#F0E4E1] bg-white text-[#2D2523] placeholder:text-[#877870] text-sm focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
        />
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-semibold text-[#2D2523] mb-3">Gender</label>
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
}: {
  data: Step2Data;
  onChange: (d: Step2Data) => void;
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

      {data.file ? (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800 text-sm truncate">{data.file.name}</p>
            <p className="text-emerald-600 text-xs mt-0.5">{(data.file.size / 1024).toFixed(0)} KB · PDF</p>
          </div>
          <button
            onClick={() => onChange({ file: null })}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
            <Upload className="w-7 h-7 text-[#C27A8A]" />
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

      <p className="text-xs text-[#877870] flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        This is optional — you can upload the assessment at any time from the client's profile.
      </p>
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
function Step3({
  data,
  onChange,
}: {
  data: Step3Data;
  onChange: (d: Step3Data) => void;
}) {
  function addTo(key: keyof Step3Data, val: string) {
    onChange({ ...data, [key]: [...data[key], val] });
  }

  function removeFrom(key: keyof Step3Data, i: number) {
    onChange({ ...data, [key]: data[key].filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5">
      <p className="text-[#877870] text-sm leading-relaxed">
        Add the client's documented behaviors, goals, and intervention strategies. These will be available when generating session notes.
      </p>

      <TagSection
        title="Maladaptive Behaviors"
        icon={AlertTriangle}
        iconColor="text-rose-600"
        iconBg="bg-rose-50"
        placeholder="e.g. Aggression, Self-injurious behavior..."
        items={data.maladaptiveBehaviors}
        onAdd={(v) => addTo("maladaptiveBehaviors", v)}
        onRemove={(i) => removeFrom("maladaptiveBehaviors", i)}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewClient() {
  const [, setLocation] = useLocation();
  const { addClient } = useClientsStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });

  const [step2, setStep2] = useState<Step2Data>({ file: null });

  const [step3, setStep3] = useState<Step3Data>({
    maladaptiveBehaviors: [],
    replacementPrograms: [],
    interventions: [],
  });

  function goBack() {
    if (step === 1) setLocation("/clients");
    else setStep(step - 1);
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

  async function handleNext() {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    // Save
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700)); // mock delay
    const newClient: Client = {
      id: `c_${generateId()}`,
      firstName: step1.firstName.trim(),
      lastName: step1.lastName.trim(),
      dateOfBirth: step1.dateOfBirth,
      gender: step1.gender,
      hasAssessment: !!step2.file,
      assessmentStatus: step2.file ? "uploaded" : "missing",
      assessmentFileName: step2.file?.name,
      maladaptiveBehaviors: step3.maladaptiveBehaviors,
      replacementPrograms: step3.replacementPrograms,
      interventions: step3.interventions,
      createdAt: new Date().toISOString(),
    };
    addClient(newClient);
    setSaving(false);
    setLocation("/clients");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ProgressHeader step={step} onBack={goBack} onCancel={() => setLocation("/clients")} />
      <StepBar step={step} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`rounded-full transition-all duration-300 ${
                n < step
                  ? "w-6 h-2 bg-[#C27A8A]"
                  : n === step
                  ? "w-8 h-2 bg-[#C27A8A]"
                  : "w-2 h-2 bg-[#F0E4E1]"
              }`}
            />
          ))}
        </div>

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
                {step === 1 && "Client Information"}
                {step === 2 && "Assessment PDF"}
                {step === 3 && "Programs & Behaviors"}
              </h2>
              <p className="text-[#877870] mt-1">
                {step === 1 && "Enter the client's basic information."}
                {step === 2 && "Upload their behavior assessment document."}
                {step === 3 && "Add their treatment targets and strategies."}
              </p>
            </div>

            {step === 1 && <Step1 data={step1} onChange={setStep1} />}
            {step === 2 && <Step2 data={step2} onChange={setStep2} />}
            {step === 3 && <Step3 data={step3} onChange={setStep3} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-[#F0E4E1] px-4 sm:px-6 py-4 flex items-center justify-between">
        <span className="text-sm text-[#877870] font-medium">
          {step === 2 && !step2.file && "You can skip this step"}
          {step === 3 && "Press Enter or + to add each item"}
          {step === 1 && (canContinue() ? "Looking good!" : "Fill in all fields to continue")}
        </span>
        <button
          onClick={handleNext}
          disabled={!canContinue() || saving}
          className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          style={{ background: "#C27A8A", boxShadow: "0 8px 20px rgba(194,122,138,0.25)" }}
        >
          {saving ? (
            <>Saving...</>
          ) : step === 3 ? (
            <>
              <User className="w-4 h-4" /> Save Client
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
