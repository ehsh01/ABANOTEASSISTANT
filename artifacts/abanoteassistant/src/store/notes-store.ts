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
  content: string;
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
    content: `Session Date: 05/08/2025
Client: Jayden Barahona
Session Time: 9:00 AM – 3:00 PM (6 hours)
Billing Code: 97153 – Adaptive Behavior Treatment by Protocol
Provider Type: RBT

SUMMARY OF SESSION:
Jayden participated in a 6-hour discrete trial training (DTT) session targeting communication, adaptive behavior, and social skills goals as outlined in the current treatment plan. He presented as alert and cooperative throughout the session.

SKILL ACQUISITION:
Jayden demonstrated mastery on 3 of 5 targets in the "Requesting" program, correctly labeling preferred items in 4 of 5 trials. The "Following Multi-Step Instructions" program showed improvement; Jayden responded to 2-step instructions with one gestural prompt in 80% of trials. The "Identifying Emotions" program was introduced and Jayden correctly identified "happy" and "sad" from picture cards with minimal prompting.

BEHAVIOR MANAGEMENT:
No significant problem behaviors were observed during this session. One instance of vocal protest occurred during the transition from a preferred to a non-preferred activity; the behavior lasted approximately 30 seconds and was managed through planned ignoring and verbal redirection.

ENVIRONMENTAL CONDITIONS:
Session conducted in the home setting with standard materials. No environmental changes noted.

NEXT SESSION FOCUS:
Continue reinforcing "Requesting" mastery targets. Introduce a third emotion to the "Identifying Emotions" program. Begin collecting baseline data on "Independent Play" targets.

RBT Signature: On file
Supervising BCBA: Dr. M. Santos`,
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
    content: `Session Date: 05/06/2025
Client: James R.
Session Time: 10:00 AM – 2:00 PM (4 hours)
Billing Code: 97153 – Adaptive Behavior Treatment by Protocol
Provider Type: RBT

SUMMARY OF SESSION:
James participated in a 4-hour session focused on communication and daily living skills. He arrived in a positive mood and engaged well with structured activities for the majority of the session.

SKILL ACQUISITION:
The "Functional Communication Training (FCT)" program showed continued progress; James independently used his AAC device to request a break 3 times without prompting. The "Mand Training" program was conducted across 6 trials; James vocally requested "water" and "crackers" in 5 of 6 trials at an independent level.

BEHAVIOR MANAGEMENT:
Two episodes of hand-wringing observed, each lasting under 15 seconds. Behavior appeared to correlate with transitions between tasks. Differential reinforcement of alternative behavior (DRA) was implemented; James accepted verbal redirection effectively on both occasions.

ENVIRONMENTAL CONDITIONS:
Session held in home setting. Parent was present for the first hour and participated in a brief training on prompting procedures.

NEXT SESSION FOCUS:
Expand FCT to include requests for "help" and "more." Probe mand generalization with novel staff member.

RBT Signature: On file
Supervising BCBA: Dr. M. Santos`,
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
    content: `Session Date: 05/05/2025
Client: Sophia M.
Session Time: 11:00 AM – 12:00 PM (1 hour)
Billing Code: 97155 – Adaptive Behavior Treatment with Protocol Modification
Provider Type: BCBA

SUMMARY OF SESSION:
This session consisted of a direct observation and protocol modification meeting. Sophia was observed during a 30-minute structured session with her RBT, followed by a 30-minute parent consultation and program update.

DIRECT OBSERVATION FINDINGS:
Sophia demonstrated consistent progress across her current skill acquisition targets. Observed prompting hierarchy was implemented correctly by the RBT. Sophia reached the mastery criterion (80% correct across 3 consecutive sessions) for the "Matching by Category" program.

PROTOCOL MODIFICATIONS:
- "Matching by Category" program moved to maintenance schedule (probe weekly).
- New target introduced: "Sorting Objects by Size" (3 levels: small/medium/large).
- Reinforcer assessment conducted; updated preferred item list to include puzzle activities.
- Behavior Intervention Plan reviewed; no modifications required at this time.

PARENT CONSULTATION:
Reviewed current treatment goals and progress data with parent. Parent reported that Sophia has been initiating play with a sibling at home, which aligns with generalization of social skills targets. Home programming recommendations were updated to include 10 minutes of structured sibling play per day.

NEXT STEPS:
Update program materials for new sorting target. Schedule 30-day progress review.

BCBA Signature: On file`,
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
    content: `Session Date: 05/02/2025
Client: Ethan T.
Session Time: 8:00 AM – 1:00 PM (5 hours)
Billing Code: 97153 – Adaptive Behavior Treatment by Protocol
Provider Type: RBT

SUMMARY OF SESSION:
Ethan participated in a 5-hour session. He required additional warm-up time at session start and was resistant to the first structured activity. After a preferred activity was offered as a transition support, engagement improved significantly.

SKILL ACQUISITION:
[DRAFT — data entry in progress]
"Imitation" program: trials conducted, data to be transferred from paper data sheet.
"Receptive Identification" program: Ethan identified 4 of 6 target items correctly.

BEHAVIOR MANAGEMENT:
[DRAFT — awaiting supervisor review of incident notes]
One significant behavioral incident occurred at approximately 9:45 AM during transition. Duration and intensity logged on separate incident report form.

ENVIRONMENTAL CONDITIONS:
Clinic setting. New therapy room used for the first time — some initial exploration behavior observed which was expected and managed.

NOTE STATUS: DRAFT — Pending BCBA review and data sheet reconciliation before finalizing.

RBT Signature: On file
Supervising BCBA: Dr. M. Santos`,
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
    content: `Session Date: 04/30/2025
Client: Olivia W.
Session Time: 1:00 PM – 2:00 PM (1 hour)
Billing Code: 97156 – Adaptive Behavior Treatment with Caregiver/Training
Provider Type: BCBA

SUMMARY OF SESSION:
This session was a dedicated caregiver training session conducted with Olivia's primary caregiver (mother). Olivia was present for the final 20 minutes to allow the caregiver to practice skills in vivo.

CAREGIVER TRAINING CONTENT:
Training focused on implementing the "First-Then" board as a visual support for transitions. Caregiver demonstrated understanding of the procedure through role-play and was able to correctly implement the strategy with Olivia during the live practice segment. Error correction procedures were reviewed and caregiver achieved 90% accuracy on competency check.

Additional topics covered:
- Understanding function of behavior (brief review of FBA findings)
- Consistent reinforcer delivery timing
- Data collection using the simplified home data sheet

CAREGIVER PERFORMANCE:
Caregiver was engaged and asked clarifying questions. She reported feeling more confident implementing transition supports compared to the prior session. Areas for continued practice: maintaining consistent schedule and avoiding inadvertent escape-maintained reinforcement.

OLIVIA'S PARTICIPATION:
During the final 20 minutes, Olivia transitioned between 2 activities using the First-Then board with no problem behaviors. One instance of verbal protest occurred and was managed correctly by the caregiver using practiced techniques.

NEXT SESSION:
Review home data from the week. Address any challenges with First-Then board implementation.

BCBA Signature: On file`,
  },
];

interface NotesState {
  notes: SessionNote[];
  addNote: (note: SessionNote) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<SessionNote>) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: INITIAL_NOTES,
  addNote: (note) =>
    set((state) => ({ notes: [note, ...state.notes] })),
  deleteNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
}));
