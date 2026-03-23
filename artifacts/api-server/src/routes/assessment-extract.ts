import { Router, type IRouter } from "express";
import multer from "multer";

import { extractAssessmentFromPdfBuffer } from "../assessment-extract";

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
  "/clients/assessment/extract",
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({
          success: false,
          error: message,
          messages: [],
        });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({
        success: false,
        error: "No PDF file uploaded (use multipart field name: file)",
        messages: [],
      });
      return;
    }

    try {
      const result = await extractAssessmentFromPdfBuffer(file.buffer);
      res.json({
        success: true,
        data: result,
        error: null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Extraction failed";
      if (message.includes("OPENAI_API_KEY")) {
        res.status(503).json({
          success: false,
          error: "AI extraction is not configured on the server",
          messages: [],
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: message,
        messages: [],
      });
    }
  },
);

export default router;
