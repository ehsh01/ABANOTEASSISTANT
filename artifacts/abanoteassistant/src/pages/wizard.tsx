import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, AlertCircle, Wand2, Loader2, X, ChevronsUpDown } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { useClients, useClientPrograms, useGenerateSessionNote } from "@/hooks/use-aba-api";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ─── Environmental change options ────────────────────────────────────────────
const ENV_CHANGE_OPTIONS: { group: string; items: string[] }[] = [
  {
    group: "Life Changes",
    items: [
      "Moved to a new house",
      "Birth of a sibling",
      "New sibling",
      "New stepfather",
      "New stepmother",
      "Change in legal custody or living arrangements",
      "Returning from vacation",
      "Family preparing to travel",
      "Puberty",
    ],
  },
  {
    group: "Medical & Health",
    items: [
      "Illness or injury",
      "Doctor's visit",
      "Dentist's visit",
      "Start of a new medication",
      "Changes in diet",
      "Changes in sleep routine",
    ],
  },
  {
    group: "Social & Emotional",
    items: [
      "Fight with a schoolmate",
      "Fight with a peer",
      "Fight with a family member",
      "Loss of a family member or friend",
      "Loss of a pet",
      "Changes in peer group or social dynamics",
      "Changes in parental attention",
    ],
  },
  {
    group: "Environmental & Sensory",
    items: [
      "New items in the environment",
      "New personal items",
      "Changes in ambient odor",
      "Changes in weather or seasons",
      "Change in technology use or access",
      "Disruptions due to emergencies or natural disasters",
      "Major global or local events",
    ],
  },
  {
    group: "School & Services",
    items: [
      "Child didn't attend school",
      "Change in school/teacher",
      "Change in service area",
      "Change in care provider",
      "Introduction of a new behavioral plan",
      "New analyst",
      "New BCaBA",
      "New RBT",
    ],
  },
  {
    group: "Other",
    items: [
      "New pet",
      "House renovations or re-decoration",
      "Holidays or special events",
    ],
  },
];

// ─── Per-category multi-select dropdown ──────────────────────────────────────
function EnvChangeMultiSelect({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: string[];
  selected: string[];
  onChange: (items: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const remove = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== item));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border-2 text-sm font-medium transition-all text-left",
              open
                ? "border-primary ring-4 ring-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-foreground truncate">{label}</span>
              {selected.length > 0 && (
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {selected.length}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 max-w-none"
          align="start"
          sideOffset={4}
          style={{ width: triggerRef.current?.offsetWidth }}
        >
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList className="max-h-56">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const isSelected = selected.includes(item);
                  return (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => toggle(item)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded border transition-colors shrink-0",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {item}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
            >
              {item}
              <button
                type="button"
                onClick={(e) => remove(item, e)}
                className="hover:text-destructive transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- WIZARD STEPS COMPONENTS ---

function Step1Client() {
  const { data: wizardData, updateData } = useWizardStore();
  const { data: clientsRes, isLoading } = useClients();

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const clients = clientsRes?.data || [];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Select Client</h2>
        <p className="text-muted-foreground mt-2">Who was this session with?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.map(client => {
          const isSelected = wizardData.clientId === client.id;
          const isMissing = client.assessmentStatus === "missing";
          
          return (
            <button
              key={client.id}
              onClick={() => !isMissing && updateData({ clientId: client.id })}
              className={cn(
                "relative text-left p-6 rounded-2xl border-2 transition-all duration-200 hover-elevate",
                isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card",
                isMissing && "opacity-60 cursor-not-allowed grayscale"
              )}
              disabled={isMissing}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="w-4 h-4" />
                </div>
              )}
              <h3 className="font-bold text-lg text-foreground">{client.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{client.ageBand}</p>
              
              <div className="flex items-center gap-2">
                {isMissing ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-3 h-3 mr-1" /> No Assessment
                  </span>
                ) : (
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border",
                    client.assessmentStatus === "ready" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    client.assessmentStatus === "processing" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-[#F6F3FC] text-[#6B3FA0] border-[#C4B5E8]"
                  )}>
                    Assessment: {client.assessmentStatus}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {clients.find(c => c.id === wizardData.clientId)?.assessmentStatus === "missing" && (
        <div className="mt-6 p-4 bg-destructive/10 rounded-xl border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-destructive">Assessment Missing</h4>
            <p className="text-sm text-destructive/80 mt-1">You must upload an assessment for this client before generating notes.</p>
            <button className="mt-3 px-4 py-2 bg-card border border-destructive/30 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
              Upload Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step2Hours() {
  const { data, updateData } = useWizardStore();
  const hours = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Session Length</h2>
        <p className="text-muted-foreground mt-2">How long was the session in whole hours?</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {hours.map(h => (
          <button
            key={h}
            onClick={() => updateData({ sessionHours: h })}
            className={cn(
              "aspect-square rounded-2xl border-2 text-2xl font-display font-bold transition-all hover-elevate",
              data.sessionHours === h 
                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                : "bg-card border-border text-foreground hover:border-primary/50"
            )}
          >
            {h}
          </button>
        ))}
      </div>
      
      {data.sessionHours && (
        <p className="text-center text-sm text-muted-foreground bg-secondary/50 p-4 rounded-xl">
          One ABC block per hour. You'll need at least <strong className="text-foreground">{data.sessionHours}</strong> replacement programs for this session.
        </p>
      )}
    </div>
  );
}

function Step3Date() {
  const { data, updateData } = useWizardStore();
  
  return (
    <div className="space-y-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Session Date</h2>
        <p className="text-muted-foreground mt-2">When did this session occur?</p>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <label className="block text-sm font-semibold text-foreground mb-2">Select Date</label>
        <input 
          type="date" 
          value={data.sessionDate || ""}
          onChange={(e) => updateData({ sessionDate: e.target.value })}
          className="w-full px-4 py-4 rounded-xl bg-background border-2 border-border text-foreground font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
        />
      </div>
    </div>
  );
}

function Step4People() {
  const { data, updateData } = useWizardStore();
  const presets = ["Mother", "Father", "Grandmother", "Grandfather", "Caregiver", "Sibling"];
  const [customVal, setCustomVal] = useState("");

  const selected = data.presentPeople || [];

  const togglePerson = (person: string) => {
    if (selected.includes(person)) {
      updateData({ presentPeople: selected.filter(p => p !== person) });
    } else {
      updateData({ presentPeople: [...selected, person] });
    }
  };

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customVal.trim() && !selected.includes(customVal.trim())) {
      updateData({ presentPeople: [...selected, customVal.trim()] });
      setCustomVal("");
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Who was present?</h2>
        <p className="text-muted-foreground mt-2">Select all individuals present during the session.</p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => togglePerson(p)}
            className={cn(
              "px-5 py-3 rounded-full text-sm font-semibold border-2 transition-all hover-elevate",
              selected.includes(p)
                ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-card border-border text-foreground hover:border-primary/50"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="pt-8 border-t border-border/50">
        <form onSubmit={addCustom} className="flex gap-3 max-w-md mx-auto">
          <input
            type="text"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            placeholder="Other (e.g. Teacher, Aunt)"
            className="flex-1 px-4 py-3 rounded-xl bg-card border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <button type="submit" className="px-6 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-colors">
            Add
          </button>
        </form>
      </div>

      {selected.filter(p => !presets.includes(p)).length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center pt-4">
          {selected.filter(p => !presets.includes(p)).map(p => (
            <span key={p} className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent-foreground font-medium text-sm">
              {p}
              <button onClick={() => togglePerson(p)} className="ml-2 hover:text-destructive"><X className="w-4 h-4" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Step5Env() {
  const { data, updateData, selectedEnvChanges, setSelectedEnvChanges } = useWizardStore();

  const buildTextareaValue = (items: string[], extra: string): string =>
    [items.length > 0 ? items.join(", ") : "", extra.trim()].filter(Boolean).join("\n\n");

  const extractManualSuffix = (fullText: string, prevItems: string[]): string => {
    if (prevItems.length === 0) return fullText;
    const prefix = prevItems.join(", ");
    if (!fullText.startsWith(prefix)) return fullText;
    return fullText.slice(prefix.length).replace(/^\n+/, "");
  };

  const handleCategoryChange = (groupItems: string[], newCategorySelection: string[]) => {
    // Replace only this category's items in the global selection; preserve all others.
    const otherItems = selectedEnvChanges.filter((s) => !groupItems.includes(s));
    const newAll = [...otherItems, ...newCategorySelection];
    const manualSuffix = extractManualSuffix(data.environmentalChanges ?? "", selectedEnvChanges);
    setSelectedEnvChanges(newAll);
    updateData({ environmentalChanges: buildTextareaValue(newAll, manualSuffix) });
  };

  const handleTextareaChange = (text: string) => {
    updateData({ environmentalChanges: text });
  };

  const handleToggleYes = () => {
    updateData({ hasEnvironmentalChanges: true });
  };

  const handleToggleNo = () => {
    setSelectedEnvChanges([]);
    updateData({ hasEnvironmentalChanges: false, environmentalChanges: "" });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Environmental Changes</h2>
        <p className="text-muted-foreground mt-2">Were there any changes in the environment during this session?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <button
          onClick={handleToggleNo}
          className={cn(
            "p-6 rounded-2xl border-2 font-semibold text-lg transition-all hover-elevate",
            data.hasEnvironmentalChanges === false
              ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card border-border text-foreground hover:border-primary/50"
          )}
        >
          No
        </button>
        <button
          onClick={handleToggleYes}
          className={cn(
            "p-6 rounded-2xl border-2 font-semibold text-lg transition-all hover-elevate",
            data.hasEnvironmentalChanges === true
              ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card border-border text-foreground hover:border-primary/50"
          )}
        >
          Yes
        </button>
      </div>

      <AnimatePresence>
        {data.hasEnvironmentalChanges && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 32 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-5">
              {/* Per-category dropdowns in a 2-column grid */}
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Select from each category — selected items appear in the description below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ENV_CHANGE_OPTIONS.map((group) => (
                    <EnvChangeMultiSelect
                      key={group.group}
                      label={group.group}
                      items={group.items}
                      selected={selectedEnvChanges.filter((s) => group.items.includes(s))}
                      onChange={(categoryItems) => handleCategoryChange(group.items, categoryItems)}
                    />
                  ))}
                </div>
              </div>

              {/* Free-text area — pre-filled with dropdown selections, fully editable */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">(edit freely)</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selections above are pre-filled here. Add context, reorder, or edit as needed.
                </p>
                <textarea
                  value={data.environmentalChanges ?? ""}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  placeholder="Select from categories above or describe changes here…"
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground min-h-[100px] resize-y focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step6Programs() {
  const { data, updateData } = useWizardStore();
  const { data: programsRes, isLoading } = useClientPrograms(data.clientId!);

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const programs = programsRes?.data || [];
  const minRequired = data.sessionHours || 1; // Fallback to 1 if not set
  const selected = data.selectedReplacements || [];

  const toggleProgram = (name: string) => {
    if (selected.includes(name)) {
      updateData({ selectedReplacements: selected.filter(n => n !== name) });
    } else {
      updateData({ selectedReplacements: [...selected, name] });
    }
  };

  const selectAll = () => {
    updateData({ selectedReplacements: programs.map(p => p.name) });
  };

  const hasEnough = selected.length >= minRequired;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Replacement Programs</h2>
        <p className="text-muted-foreground mt-2">Select the programs targeted during this session.</p>
      </div>

      <div className="flex items-center justify-between bg-secondary/50 p-4 rounded-xl border border-border/50">
        <div>
          <span className="text-sm font-medium text-foreground">Selected: </span>
          <span className={cn("text-lg font-bold ml-1", hasEnough ? "text-emerald-600" : "text-amber-600")}>
            {selected.length}
          </span>
          <span className="text-sm text-muted-foreground"> / {minRequired} required for {data.sessionHours} hrs</span>
        </div>
        <button onClick={selectAll} className="text-sm font-semibold text-primary hover:underline">Select All</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {programs.map(program => {
          const isSelected = selected.includes(program.name);
          return (
            <button
              key={program.id}
              onClick={() => toggleProgram(program.name)}
              className={cn(
                "flex items-start text-left p-4 rounded-xl border-2 transition-all hover-elevate",
                isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className={cn(
                "mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mr-3 border transition-colors",
                isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/30 bg-background"
              )}>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                  {program.name}
                  {program.type === 'supplemental' && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">Supp</span>
                  )}
                </div>
                {program.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{program.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step7NextDate() {
  const { data, updateData } = useWizardStore();
  
  return (
    <div className="space-y-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Next Session</h2>
        <p className="text-muted-foreground mt-2">When is the next scheduled session? (Optional)</p>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Select Date</label>
          <input 
            type="date" 
            value={data.nextSessionDate || ""}
            onChange={(e) => updateData({ nextSessionDate: e.target.value })}
            className="w-full px-4 py-4 rounded-xl bg-background border-2 border-border text-foreground font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
        
        <div className="text-center pt-4">
          <button 
            onClick={() => updateData({ nextSessionDate: "" })}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear Date
          </button>
        </div>
      </div>
    </div>
  );
}

function Step8Review() {
  const { data } = useWizardStore();
  const { data: clientsRes } = useClients();
  const clientName = clientsRes?.data?.find(c => c.id === data.clientId)?.name || "Unknown";

  const Item = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Review Details</h2>
        <p className="text-muted-foreground mt-2">Check your selections before generating the note.</p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-1">
        <Item label="Client" value={clientName} />
        <Item label="Session Date" value={data.sessionDate || "Not set"} />
        <Item label="Duration" value={`${data.sessionHours} hours`} />
        <Item label="Present" value={data.presentPeople?.length ? data.presentPeople.join(", ") : "Therapist only"} />
        <Item label="Env Changes" value={data.hasEnvironmentalChanges ? "Yes" : "No"} />
        <Item label="Programs" value={<span className="text-primary">{data.selectedReplacements?.length} selected</span>} />
        <Item label="Next Session" value={data.nextSessionDate || "Not scheduled"} />
      </div>
    </div>
  );
}

// --- MAIN WIZARD COMPONENT ---

export default function Wizard() {
  const [, setLocation] = useLocation();
  const { step, setStep, data, setGeneratedNote } = useWizardStore();
  const generateMutation = useGenerateSessionNote();

  const totalSteps = 8;
  const isGenerating = generateMutation.isPending;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else setLocation("/");
  };

  const handleGenerate = () => {
    generateMutation.mutate(data as any, {
      onSuccess: (res) => {
        setGeneratedNote(res.data);
        setLocation("/result");
      }
    });
  };

  // Validation per step
  const canProceed = () => {
    switch (step) {
      case 1: return !!data.clientId;
      case 2: return !!data.sessionHours;
      case 3: return !!data.sessionDate;
      case 4: return true; // Optional
      case 5: return data.hasEnvironmentalChanges === false || (data.hasEnvironmentalChanges === true && !!data.environmentalChanges?.trim());
      case 6: return (data.selectedReplacements?.length || 0) >= (data.sessionHours || 1);
      case 7: return true; // Optional
      case 8: return true;
      default: return false;
    }
  };

  // Prevent leaving easily
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center px-4 text-center"
          >
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              <Wand2 className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Generating Session Note...</h2>
            <p className="text-muted-foreground max-w-sm">
              Our AI is structuring your data into a compliant clinical format. This usually takes about 5 seconds.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Progress */}
      <header className="bg-card border-b border-border sticky top-0 z-10 px-4 sm:px-6 lg:px-8 h-16 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1">
          <button onClick={handleBack} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>
          <span className="text-sm font-bold text-foreground font-display">Step {step} of {totalSteps}</span>
          <button onClick={() => setLocation("/")} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full"
          >
            {step === 1 && <Step1Client />}
            {step === 2 && <Step2Hours />}
            {step === 3 && <Step3Date />}
            {step === 4 && <Step4People />}
            {step === 5 && <Step5Env />}
            {step === 6 && <Step6Programs />}
            {step === 7 && <Step7NextDate />}
            {step === 8 && <Step8Review />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Actions */}
      <footer className="bg-card border-t border-border p-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {step === 8 ? "Ready to generate" : "Complete this step to proceed"}
          </div>
          
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="ml-auto flex items-center justify-center px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
            >
              Continue <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto flex items-center justify-center px-10 py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-lg hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 transition-all"
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Generate Note
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
