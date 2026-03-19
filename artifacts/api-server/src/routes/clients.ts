import { Router, type IRouter } from "express";
import {
  ListClientsResponse,
  GetClientParams,
  GetClientResponse,
  ListClientProgramsParams,
  ListClientProgramsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MOCK_CLIENTS = [
  {
    id: "c1",
    name: "James R.",
    ageBand: "6-10 yrs",
    hasAssessment: true,
    assessmentStatus: "ready" as const,
  },
  {
    id: "c2",
    name: "Sophia M.",
    ageBand: "3-5 yrs",
    hasAssessment: false,
    assessmentStatus: "missing" as const,
  },
  {
    id: "c3",
    name: "Ethan T.",
    ageBand: "11-14 yrs",
    hasAssessment: true,
    assessmentStatus: "processing" as const,
  },
  {
    id: "c4",
    name: "Olivia K.",
    ageBand: "6-10 yrs",
    hasAssessment: true,
    assessmentStatus: "ready" as const,
  },
  {
    id: "c5",
    name: "Liam B.",
    ageBand: "3-5 yrs",
    hasAssessment: true,
    assessmentStatus: "uploaded" as const,
  },
];

const MOCK_PROGRAMS: Record<string, { id: string; name: string; type: "primary" | "supplemental"; description: string }[]> = {
  c1: [
    { id: "p1", name: "Manding for Preferred Items", type: "primary", description: "Requesting preferred items using appropriate communication." },
    { id: "p2", name: "Joint Attention", type: "primary", description: "Making and maintaining eye contact during interactions." },
    { id: "p3", name: "Tacting Objects", type: "primary", description: "Labeling objects in the environment." },
    { id: "p4", name: "Following One-Step Instructions", type: "primary", description: "Complying with simple one-step instructions." },
    { id: "p5", name: "Intraverbal Responding", type: "supplemental", description: "Responding to conversational speech." },
    { id: "p6", name: "Listener Responding", type: "supplemental", description: "Following instructions based on listener behavior." },
    { id: "p7", name: "Transitioning Between Activities", type: "primary", description: "Moving between activities without problem behavior." },
    { id: "p8", name: "Tolerating Delays", type: "supplemental", description: "Waiting for preferred items without problem behavior." },
  ],
  c2: [
    { id: "p9", name: "Gross Motor Imitation", type: "primary", description: "Imitating large motor movements." },
    { id: "p10", name: "Basic Self-Help Skills", type: "primary", description: "Completing self-help routines independently." },
    { id: "p11", name: "Requesting Help", type: "primary", description: "Appropriately requesting assistance from others." },
    { id: "p12", name: "Peer Interaction Skills", type: "supplemental", description: "Engaging in play and conversation with peers." },
    { id: "p13", name: "Matching Objects", type: "primary", description: "Matching identical objects." },
  ],
  c3: [
    { id: "p14", name: "Social Skills Training", type: "primary", description: "Learning and practicing social interaction skills." },
    { id: "p15", name: "Academic Readiness", type: "primary", description: "Preparing for academic tasks and classroom expectations." },
    { id: "p16", name: "Emotional Regulation", type: "primary", description: "Identifying and managing emotional states appropriately." },
    { id: "p17", name: "Problem Solving", type: "supplemental", description: "Using strategies to solve common problems." },
    { id: "p18", name: "Self-Monitoring", type: "supplemental", description: "Tracking own behavior and performance." },
    { id: "p19", name: "Accepting Feedback", type: "primary", description: "Responding appropriately to corrective feedback." },
  ],
  c4: [
    { id: "p20", name: "Requesting Preferred Activities", type: "primary", description: "Using appropriate communication to request activities." },
    { id: "p21", name: "Following Multi-Step Instructions", type: "primary", description: "Complying with two and three-step instructions." },
    { id: "p22", name: "Expressing Emotions", type: "primary", description: "Labeling and expressing emotions appropriately." },
    { id: "p23", name: "Sharing and Turn-Taking", type: "supplemental", description: "Participating in shared activities with peers." },
    { id: "p24", name: "Perspective Taking", type: "supplemental", description: "Understanding others' thoughts and feelings." },
  ],
  c5: [
    { id: "p25", name: "Picture Exchange Communication", type: "primary", description: "Using picture cards to communicate needs." },
    { id: "p26", name: "Play Skills", type: "primary", description: "Engaging in functional and symbolic play." },
    { id: "p27", name: "Tolerating Non-Preferred Activities", type: "primary", description: "Participating in non-preferred activities without problem behavior." },
    { id: "p28", name: "Imitation Skills", type: "supplemental", description: "Imitating actions, sounds, and words." },
  ],
};

router.get("/clients", (_req, res) => {
  const data = ListClientsResponse.parse({ success: true, data: MOCK_CLIENTS, error: null });
  res.json(data);
});

router.get("/clients/:clientId", (req, res) => {
  const params = GetClientParams.parse(req.params);
  const client = MOCK_CLIENTS.find((c) => c.id === params.clientId);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  const data = GetClientResponse.parse({ success: true, data: client, error: null });
  res.json(data);
});

router.get("/clients/:clientId/programs", (req, res) => {
  const params = ListClientProgramsParams.parse(req.params);
  const programs = MOCK_PROGRAMS[params.clientId] ?? [];
  const sessionHours = Number(req.query.sessionHours) || 1;
  const minimumRequired = Math.max(sessionHours, 1);

  const data = ListClientProgramsResponse.parse({
    success: true,
    data: programs,
    minimumRequired,
    error: null,
  });
  res.json(data);
});

export default router;
