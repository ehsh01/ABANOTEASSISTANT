import { Router, type IRouter } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { GetClientParams, GetClientResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { clientsTable, type ClientProfileRow } from "@workspace/db/schema";
import {
  extractTextFromPdfBuffer,
  truncateAssessmentTextForStorage,
} from "../assessment-extract";
import { clientRowToApiData } from "../client-profile-api";

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
    try {
      const { text } = await extractTextFromPdfBuffer(file.buffer);
      rawText = text ?? "";
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to read PDF";
      res.status(400).json({ success: false, error: message, messages: [] });
      return;
    }

    const { text: snapshot, truncated } = truncateAssessmentTextForStorage(rawText);
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
      replacementPrograms: [],
      interventions: [],
    };

    const nextProfile: ClientProfileRow = {
      ...base,
      assessmentFileName: file.originalname || base.assessmentFileName,
    };
    if (snapshot.length > 0) {
      nextProfile.assessmentTextSnapshot = snapshot;
    }

    const [updated] = await db
      .update(clientsTable)
      .set({
        hasAssessment: true,
        assessmentStatus: "ready",
        profile: nextProfile,
        updatedAt: new Date(),
      })
      .where(and(eq(clientsTable.id, params.data.clientId), eq(clientsTable.companyId, companyId)))
      .returning();

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
