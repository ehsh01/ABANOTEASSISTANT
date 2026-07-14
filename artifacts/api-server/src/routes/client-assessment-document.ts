import { Router, type IRouter } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { GetClientParams, GetClientResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { clientsTable, type ClientProfileRow } from "@workspace/db/schema";
import {
  extractAssessmentFromPdfText,
  extractBehaviorMapsFromBipText,
  extractTextFromPdfBuffer,
  enrichMaladaptiveTargetsWithAssessmentTopography,
  truncateAssessmentTextForStorage,
} from "../assessment-extract";
import { clientRowToApiData } from "../client-profile-api";
import { sanitizeTextForJsonStorage } from "../sanitize-text-for-json";
import { refreshProfileFromAssessmentUpload } from "../assessment-persistence";
import { MIN_USABLE_ASSESSMENT_TEXT_CHARS } from "../note-readiness";
import { enrichMaladaptiveTargetsWithAssessmentFunctions } from "../clinical-behavior-function";

function extractDeepestDriverMessage(err: unknown): string {
  let best = err instanceof Error ? err.message : String(err);
  const cur = err as { cause?: unknown };
  let c: unknown = cur?.cause;
  while (c) {
    if (c instanceof Error && c.message.trim()) best = c.message;
    c = typeof c === "object" && c !== null && "cause" in c ? (c as { cause?: unknown }).cause : undefined;
  }
  return best;
}

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post(
  "/clients/:clientId/assessment/document",
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ success: false, error: message, messages: [] });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const companyId = req.companyId;
    if (companyId === undefined) {
      res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
      return;
    }

    const params = GetClientParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ success: false, error: "Invalid client id", messages: [] });
      return;
    }

    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({
        success: false,
        error: "No PDF file uploaded (multipart field name: file)",
        messages: [],
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(clientsTable)
      .where(and(eq(clientsTable.id, params.data.clientId), eq(clientsTable.companyId, companyId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: "Client not found", messages: [] });
      return;
    }

    let rawText: string;
    let pdfPageCount = 0;
    try {
      const { text, numpages } = await extractTextFromPdfBuffer(file.buffer);
      rawText = text ?? "";
      pdfPageCount = numpages;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to read PDF";
      res.status(400).json({ success: false, error: message, messages: [] });
      return;
    }

    const { text: snapshot, truncated } = truncateAssessmentTextForStorage(rawText);
    if (snapshot.length < MIN_USABLE_ASSESSMENT_TEXT_CHARS) {
      res.status(422).json({
        success: false,
        error: "Assessment PDF does not contain usable text",
        messages: [
          `Only ${snapshot.length} readable characters were extracted; at least ${MIN_USABLE_ASSESSMENT_TEXT_CHARS} are required for grounded note generation. If this PDF is scanned or image-only, run OCR or export it with a selectable text layer, then upload it again.`,
        ],
      });
      return;
    }
    if (truncated) {
      console.warn(
        `[clients/${params.data.clientId}/assessment/document] Stored text truncated to ${snapshot.length} chars`,
      );
    }

    const base = (existing.profile as ClientProfileRow | null | undefined) ?? {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      maladaptiveBehaviors: [],
      maladaptiveBehaviorTargets: [],
      replacementPrograms: [],
      skillAcquisitionPrograms: [],
      interventions: [],
    };

    const profilePrograms = [
      ...(base.replacementPrograms ?? []),
      ...(base.skillAcquisitionPrograms ?? []),
    ];
    const deterministicMaps = extractBehaviorMapsFromBipText(
      rawText,
      base.maladaptiveBehaviors ?? [],
      profilePrograms,
      base.interventions ?? [],
    );
    const blankTargets = (base.maladaptiveBehaviors ?? []).map((name) => ({
      name,
      topography: null as string | null,
      functions: null,
    }));
    const deterministicTargets = enrichMaladaptiveTargetsWithAssessmentTopography(
      enrichMaladaptiveTargetsWithAssessmentFunctions(blankTargets, rawText),
      rawText,
    );

    // The upload endpoint owns persistence. LLM extraction is best-effort enrichment; a temporary
    // extraction failure never discards the usable authoritative text or deterministic fields.
    let llmExtracted: Awaited<ReturnType<typeof extractAssessmentFromPdfText>>["extracted"] | null =
      null;
    try {
      llmExtracted = (await extractAssessmentFromPdfText(rawText, pdfPageCount)).extracted;
    } catch (error) {
      console.warn(
        `[clients/${params.data.clientId}/assessment/document] optional LLM extraction failed; ` +
          `persisting deterministic assessment fields: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const mergeMapValues = (
      primary: Record<string, string[]> | undefined,
      fallback: Record<string, string[]>,
    ): Record<string, string[]> => {
      const merged = { ...(primary ?? {}) };
      for (const [behavior, values] of Object.entries(fallback)) {
        merged[behavior] = [...new Set([...(merged[behavior] ?? []), ...values])];
      }
      return merged;
    };
    const llmTargetsByLower = new Map(
      (llmExtracted?.maladaptiveBehaviorTopographies ?? []).map((target) => [
        target.name.trim().toLowerCase(),
        target,
      ]),
    );
    const extractedTargets = deterministicTargets.map((target) => {
      const llm = llmTargetsByLower.get(target.name.trim().toLowerCase());
      return {
        name: target.name,
        topography: llm?.topography?.trim() || target.topography,
        ...(llm?.functions !== undefined
          ? { functions: llm.functions }
          : target.functions != null
            ? { functions: target.functions }
            : {}),
      };
    });
    const nextProfile = refreshProfileFromAssessmentUpload({
      profile: base,
      fileName:
        sanitizeTextForJsonStorage(file.originalname || base.assessmentFileName || "").trim() ||
        base.assessmentFileName ||
        "assessment.pdf",
      assessmentTextSnapshot: snapshot,
      extracted: {
        maladaptiveBehaviorTopographies: extractedTargets,
        behaviorReplacementMap: mergeMapValues(
          llmExtracted?.behaviorReplacementMap,
          deterministicMaps.behaviorToReplacements,
        ),
        behaviorInterventionMap: mergeMapValues(
          llmExtracted?.behaviorInterventionMap,
          deterministicMaps.behaviorToInterventions,
        ),
        assessmentSummary: llmExtracted?.assessmentSummary,
      },
    });

    console.log(
      `[clients/${params.data.clientId}/assessment/document] assessmentStructured maps: ` +
        `${Object.keys(nextProfile.assessmentStructured?.behavior_to_replacements_map ?? {}).length} behavior→replacement, ` +
        `${Object.keys(nextProfile.assessmentStructured?.behavior_to_interventions_map ?? {}).length} behavior→intervention`,
    );

    let updated;
    try {
      [updated] = await db
        .update(clientsTable)
        .set({
          hasAssessment: true,
          assessmentStatus: "ready",
          profile: nextProfile,
          updatedAt: new Date(),
        })
        .where(and(eq(clientsTable.id, params.data.clientId), eq(clientsTable.companyId, companyId)))
        .returning();
    } catch (err) {
      console.error(`[POST /clients/${params.data.clientId}/assessment/document] update failed`, err);
      const detail = extractDeepestDriverMessage(err);
      res.status(500).json({
        success: false,
        error: "Failed to store assessment document on client profile",
        messages: [detail.length > 400 ? `${detail.slice(0, 400)}…` : detail],
      });
      return;
    }

    if (!updated) {
      res.status(500).json({ success: false, error: "Failed to update client", messages: [] });
      return;
    }

    const data = GetClientResponse.parse({
      success: true,
      data: clientRowToApiData(updated),
      error: null,
    });
    res.json(data);
  },
);

export default router;
