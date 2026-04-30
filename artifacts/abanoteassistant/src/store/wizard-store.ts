import { create } from 'zustand';
import type { GenerateNoteRequest, GeneratedNote } from '@workspace/api-client-react';

export type WizardData = Partial<GenerateNoteRequest>;

/** Per-program trial data chosen by the therapist on the Programs step. */
export interface ProgramTrialData {
  /** Total number of trials conducted (1–10). */
  count: number | null;
  /** Which trial numbers (1-based) were successful. */
  effectiveTrials: number[];
}

interface WizardState {
  step: number;
  data: WizardData;
  generatedNote: GeneratedNote | null;
  /** Server warnings from successful POST /notes/generate (e.g. compliance hints). */
  generateWarnings: string[] | undefined;
  // UI-only: tracks which env-change options are selected in the dropdown.
  selectedEnvChanges: string[];
  /** UI-only: maps program id → trial data (count + which trials were effective). */
  programTrialData: Record<number, ProgramTrialData>;
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  setGeneratedNote: (note: GeneratedNote | null, warnings?: string[]) => void;
  setSelectedEnvChanges: (items: string[]) => void;
  setProgramTrialCount: (programId: number, count: number | null) => void;
  toggleProgramEffectiveTrial: (programId: number, trialNum: number) => void;
  clearProgramTrialData: (programId: number) => void;
  /** Clears wizard form only; keeps last generatedNote until a new generate succeeds. */
  resetWizardForm: () => void;
  reset: () => void;
}

const initialData: WizardData = {
  presentPeople: [],
  selectedReplacements: [],
  hasEnvironmentalChanges: false,
};

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  data: initialData,
  generatedNote: null,
  generateWarnings: undefined,
  selectedEnvChanges: [],
  programTrialData: {},
  setStep: (step) => set({ step }),
  updateData: (updates) => set((state) => ({ data: { ...state.data, ...updates } })),
  setGeneratedNote: (generatedNote, warnings) =>
    set({
      generatedNote,
      generateWarnings: generatedNote ? warnings : undefined,
    }),
  setSelectedEnvChanges: (selectedEnvChanges) => set({ selectedEnvChanges }),
  setProgramTrialCount: (programId, count) =>
    set((state) => {
      const existing = state.programTrialData[programId] ?? { count: null, effectiveTrials: [] };
      // When count changes, drop any effective trials that exceed the new count
      const effectiveTrials = count == null
        ? []
        : existing.effectiveTrials.filter((t) => t <= count);
      return {
        programTrialData: {
          ...state.programTrialData,
          [programId]: { count, effectiveTrials },
        },
      };
    }),
  toggleProgramEffectiveTrial: (programId, trialNum) =>
    set((state) => {
      const existing = state.programTrialData[programId] ?? { count: null, effectiveTrials: [] };
      const already = existing.effectiveTrials.includes(trialNum);
      const effectiveTrials = already
        ? existing.effectiveTrials.filter((t) => t !== trialNum)
        : [...existing.effectiveTrials, trialNum].sort((a, b) => a - b);
      return {
        programTrialData: {
          ...state.programTrialData,
          [programId]: { ...existing, effectiveTrials },
        },
      };
    }),
  clearProgramTrialData: (programId) =>
    set((state) => {
      const next = { ...state.programTrialData };
      delete next[programId];
      return { programTrialData: next };
    }),
  resetWizardForm: () =>
    set({
      step: 1,
      data: initialData,
      generateWarnings: undefined,
      selectedEnvChanges: [],
      programTrialData: {},
    }),
  reset: () =>
    set({
      step: 1,
      data: initialData,
      generatedNote: null,
      generateWarnings: undefined,
      selectedEnvChanges: [],
      programTrialData: {},
    }),
}));
