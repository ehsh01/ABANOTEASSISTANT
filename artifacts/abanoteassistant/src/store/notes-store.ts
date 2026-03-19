import { create } from 'zustand';

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
}

const INITIAL_NOTES: SessionNote[] = [
  {
    id: "n1",
    clientName: "Jayden Barahona",
    type: "RBT",
    billingCode: "97153",
    sessionDate: "05/08/2025",
    startTime: "09:00",
    endTime: "15:00",
    status: "final",
    createdAt: "2025-05-08T15:10:00.000Z",
  },
  {
    id: "n2",
    clientName: "James R.",
    type: "RBT",
    billingCode: "97153",
    sessionDate: "05/06/2025",
    startTime: "10:00",
    endTime: "14:00",
    status: "final",
    createdAt: "2025-05-06T14:05:00.000Z",
  },
  {
    id: "n3",
    clientName: "Sophia M.",
    type: "BCBA",
    billingCode: "97155",
    sessionDate: "05/05/2025",
    startTime: "11:00",
    endTime: "12:00",
    status: "final",
    createdAt: "2025-05-05T12:15:00.000Z",
  },
  {
    id: "n4",
    clientName: "Ethan T.",
    type: "RBT",
    billingCode: "97153",
    sessionDate: "05/02/2025",
    startTime: "08:00",
    endTime: "13:00",
    status: "draft",
    createdAt: "2025-05-02T13:20:00.000Z",
  },
  {
    id: "n5",
    clientName: "Olivia W.",
    type: "BCBA",
    billingCode: "97156",
    sessionDate: "04/30/2025",
    startTime: "13:00",
    endTime: "14:00",
    status: "final",
    createdAt: "2025-04-30T14:30:00.000Z",
  },
];

interface NotesState {
  notes: SessionNote[];
  addNote: (note: SessionNote) => void;
  deleteNote: (id: string) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: INITIAL_NOTES,
  addNote: (note) =>
    set((state) => ({ notes: [note, ...state.notes] })),
  deleteNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
}));
