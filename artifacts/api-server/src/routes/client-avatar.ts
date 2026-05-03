/**
 * Client AI-avatar endpoints.
 *
 * Two routers are exported:
 *
 *   1. `clientAvatarPublicRouter` — mounted **before** `requireAuth` so an HTML `<img src=…>` tag can
 *      load the binary without sending the JWT bearer header. Authentication is enforced via an
 *      HMAC-signed token bound to (clientId, avatarUpdatedAt). Tokens are invalidated implicitly when
 *      the avatar is regenerated (the `updatedAt` changes), so the URL is effectively versioned.
 *
 *   2. `clientAvatarTenantRouter` — mounted **after** `requireAuth` + `rejectSuperAdminFromTenantData`.
 *      Provides the `POST /clients/:id/avatar/generate` and `DELETE /clients/:id/avatar` JSON
 *      endpoints used by the React app.
 */

import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { clientsTable, type ClientProfileRow } from "@workspace/db/schema";
import { GetClientParams } from "@workspace/api-zod";
import {
  buildAvatarUrl,
  generateClientAvatar,
  verifyAvatarToken,
} from "../avatar-generation";
import { clientRowToApiData } from "../client-profile-api";

export const clientAvatarPublicRouter: IRouter = Router();
export const clientAvatarTenantRouter: IRouter = Router();

/**
 * GET /api/clients/:clientId/avatar
 * Auth: HMAC-signed query token (`v=…&token=…`); no Bearer required.
 * Returns the raw PNG. 304-able via ETag based on `avatarUpdatedAt`.
 */
clientAvatarPublicRouter.get(
  "/clients/:clientId/avatar",
  async (req, res, next) => {
    try {
      const params = GetClientParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ success: false, error: "Invalid client id", messages: [] });
        return;
      }

      const versionRaw = req.query["v"];
      const tokenRaw = req.query["token"];
      const versionMs = typeof versionRaw === "string" ? Number(versionRaw) : Number.NaN;
      const candidateToken = typeof tokenRaw === "string" ? tokenRaw : "";
      if (!Number.isFinite(versionMs) || !candidateToken) {
        res.status(401).json({ success: false, error: "Invalid avatar URL", messages: [] });
        return;
      }
      if (!verifyAvatarToken(params.data.clientId, versionMs, candidateToken)) {
        res.status(401).json({ success: false, error: "Invalid or expired avatar URL", messages: [] });
        return;
      }

      const rows = await db
        .select({
          id: clientsTable.id,
          avatarPngBase64: clientsTable.avatarPngBase64,
          avatarUpdatedAt: clientsTable.avatarUpdatedAt,
        })
        .from(clientsTable)
        .where(eq(clientsTable.id, params.data.clientId))
        .limit(1);
      const row = rows[0];

      if (!row || !row.avatarPngBase64 || !row.avatarUpdatedAt) {
        res.status(404).json({ success: false, error: "Avatar not found", messages: [] });
        return;
      }
      // The signed token already binds to a specific updatedAt, but if the avatar was regenerated since
      // the URL was minted the version won't match; treat that as "stale" and 410 so the client refetches
      // the parent resource (which surfaces the new signed URL).
      if (row.avatarUpdatedAt.getTime() !== versionMs) {
        res.status(410).json({ success: false, error: "Avatar URL is stale", messages: [] });
        return;
      }

      const buffer = Buffer.from(row.avatarPngBase64, "base64");
      const etag = `W/"${row.avatarUpdatedAt.getTime()}"`;
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("ETag", etag);
      // Token is bound to `v` (the updatedAt), so caching is safe — a new avatar mints a new URL.
      res.setHeader("Cache-Control", "private, max-age=86400, immutable");
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/clients/:clientId/avatar/generate
 * Auth: tenant Bearer + same-company.
 * Generates a fresh AI avatar from the client's first name / DOB / gender, stores it, returns the new
 * `avatarUrl` and `avatarUpdatedAt` for the React Query cache.
 */
clientAvatarTenantRouter.post(
  "/clients/:clientId/avatar/generate",
  async (req, res, next) => {
    try {
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

      const rows = await db
        .select()
        .from(clientsTable)
        .where(
          and(eq(clientsTable.id, params.data.clientId), eq(clientsTable.companyId, companyId)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        res.status(404).json({ success: false, error: "Client not found", messages: [] });
        return;
      }

      const profile = (row.profile as ClientProfileRow | null | undefined) ?? null;
      // Fall back to the `name` column when the profile isn't filled out yet (e.g. brand-new client
      // that hasn't been hydrated). We want avatar generation to work as soon as a name exists.
      const fallbackFirstName = (row.name ?? "").trim().split(/\s+/)[0] ?? "";
      const firstName = (profile?.firstName?.trim() || fallbackFirstName).trim();
      if (!firstName) {
        res.status(400).json({
          success: false,
          error: "First name is required to generate an avatar",
          messages: [],
        });
        return;
      }

      const generated = await generateClientAvatar({
        firstName,
        dateOfBirth: profile?.dateOfBirth ?? null,
        gender: profile?.gender ?? null,
      });

      const now = new Date();
      await db
        .update(clientsTable)
        .set({
          avatarPngBase64: generated.pngBase64,
          avatarUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(clientsTable.id, params.data.clientId));

      const updatedRow = { ...row, avatarUpdatedAt: now, updatedAt: now };
      const data = clientRowToApiData(updatedRow);
      res.json({
        success: true,
        data: {
          avatarUrl: buildAvatarUrl(updatedRow.id, now),
          avatarUpdatedAt: now.toISOString(),
          client: data,
        },
        error: null,
        messages: [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Avatar generation failed";
      // Avatar generation can fail for many reasons (model not enabled on the org, content policy
      // refusal, OpenAI quota). Return a structured 502 so the UI can show a useful message.
      console.error("Failed to generate client avatar", err);
      res.status(502).json({ success: false, error: message, messages: [] });
    }
  },
);

/**
 * DELETE /api/clients/:clientId/avatar
 * Auth: tenant Bearer + same-company.
 * Clears the stored avatar bytes; the client falls back to initials.
 */
clientAvatarTenantRouter.delete(
  "/clients/:clientId/avatar",
  async (req, res, next) => {
    try {
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

      const rows = await db
        .select()
        .from(clientsTable)
        .where(
          and(eq(clientsTable.id, params.data.clientId), eq(clientsTable.companyId, companyId)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        res.status(404).json({ success: false, error: "Client not found", messages: [] });
        return;
      }

      const now = new Date();
      await db
        .update(clientsTable)
        .set({
          avatarPngBase64: null,
          avatarUpdatedAt: null,
          updatedAt: now,
        })
        .where(eq(clientsTable.id, params.data.clientId));

      const updatedRow = { ...row, avatarPngBase64: null, avatarUpdatedAt: null, updatedAt: now };
      const data = clientRowToApiData(updatedRow);
      res.json({
        success: true,
        data: { client: data },
        error: null,
        messages: [],
      });
    } catch (err) {
      next(err);
    }
  },
);
