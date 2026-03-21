import { create } from "zustand";

export type NoteType = "RBT" | "BCBA";
export type BillingCode = "97153" | "97155" | "97156";
export type NoteStatus = "draft" | "final";

export interface SessionNote {
  id: string;
  clientName: string;
  type: NoteType;
  billingCode: BillingCode;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: NoteStatus;
  createdAt: string;
  content: string;
}

interface NotesState {
  notes: SessionNote[];
  addNote: (note: SessionNote) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<SessionNote>) => void;
  /** Clear local notes (e.g. on logout). */
  reset: () => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  addNote: (note) =>
    set((state) => ({ notes: [note, ...state.notes] })),
  deleteNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  reset: () => set({ notes: [] }),
}));
