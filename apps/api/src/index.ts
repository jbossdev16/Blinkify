import "./load-env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { requireAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";
import workspaceRoutes from "./routes/workspace";
import projectRoutes from "./routes/projects";
import invitationRoutes from "./routes/invitations";
import generationRoutes from "./routes/generations";
import videoGenerationRoutes from "./routes/video-generations";
import assetCollectionRoutes from "./routes/asset-collection";
import creativeStudioChatRoutes from "./routes/creative-studio-chat";
import cleanupFailedGenerationsRoutes from "./routes/cleanup-failed-generations";
import campaignRoutes from "./routes/campaign";
import adStylesRoutes from "./routes/ad-styles.js";
import adminRoutes from "./routes/admin";
import checkoutRoutes from "./routes/checkout";
import waitlistRoutes from "./routes/waitlist";
import { runCleanupFailedGenerations } from "./lib/cleanup-failed-generations";
import { runCleanupUnsavedGenerations } from "./lib/cleanup-unsaved-generations";
import { ensureEmailAssetsBucket } from "./lib/storage-constants";

const app = express();

/** Run failed-generations cleanup every 24h for the whole DB. Disable by setting to 0. */
const CLEANUP_INTERVAL_MS = process.env.CLEANUP_FAILED_GENERATIONS_INTERVAL_MS
  ? Number(process.env.CLEANUP_FAILED_GENERATIONS_INTERVAL_MS)
  : 24 * 60 * 60 * 1000;

/** Run unsaved-generations storage cleanup every 24h. Removes files for generations older than 7 days that are not in Asset Collection. Disable by setting to 0. */
const CLEANUP_UNSAVED_INTERVAL_MS = process.env.CLEANUP_UNSAVED_GENERATIONS_INTERVAL_MS
  ? Number(process.env.CLEANUP_UNSAVED_GENERATIONS_INTERVAL_MS)
  : 24 * 60 * 60 * 1000;
const PORT = process.env.PORT ?? 4001;

app.use(helmet());
const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, origin ? origin : true);
      } else {
        cb(null, false);
      }
    },
  })
);
app.use(morgan("combined"));
// Allow large payloads for /generate (base64 reference images; up to 10)
app.use(express.json({ limit: "50mb" }));

// ─── Public routes ───────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.redirect(302, "/health");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/ad-styles", adStylesRoutes);

// ─── Auth routes (public) ─────────────────────────────────────────────────────

app.use("/auth", authRoutes);
app.use("/waitlist", waitlistRoutes);
app.use("/checkout", checkoutRoutes);

// ─── Protected routes ────────────────────────────────────────────────────────

app.get("/me", requireAuth, (req, res) => {
  res.json({ auth: req.auth });
});

app.use("/workspaces", workspaceRoutes);
app.use("/workspaces", projectRoutes);
app.use("/invitations", invitationRoutes);
app.use("/workspaces", generationRoutes);
app.use("/workspaces", videoGenerationRoutes);
app.use("/workspaces", assetCollectionRoutes);
app.use("/workspaces", creativeStudioChatRoutes);
app.use("/workspaces", cleanupFailedGenerationsRoutes);
app.use("/workspaces", campaignRoutes);
app.use("/admin", adminRoutes);

// ─── Error handler ───────────────────────────────────────────────────────────

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err.status ?? 500;
    res.status(status).json({
      error: err.message || "Internal server error",
    });
  }
);

/** Export for Vercel serverless. When not on Vercel, start the server and scheduled jobs. */
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
    ensureEmailAssetsBucket().catch((err: unknown) => {
      const code = (err as { cause?: { code?: string }; originalError?: { cause?: { code?: string } } })?.cause?.code
        ?? (err as { originalError?: { cause?: { code?: string } } })?.originalError?.cause?.code;
      const msg = code === "UND_ERR_CONNECT_TIMEOUT"
        ? "Supabase Storage unreachable (connect timeout). Email-assets bucket not ensured."
        : (err as Error)?.message ?? String(err);
      console.warn("ensureEmailAssetsBucket:", msg);
    });
    if (CLEANUP_INTERVAL_MS > 0) {
      setInterval(() => {
        runCleanupFailedGenerations()
          .then((r) => {
            if (r.deletedGenerations > 0 || r.deletedVideoGenerations > 0 || r.storageFilesRemoved > 0) {
              console.log("cleanup-failed-generations:", r);
            }
          })
          .catch((err) => console.error("cleanup-failed-generations error:", err));
      }, CLEANUP_INTERVAL_MS);
    }
    if (CLEANUP_UNSAVED_INTERVAL_MS > 0) {
      setInterval(() => {
        runCleanupUnsavedGenerations()
          .then((r) => {
            if (r.imageGenerationsCleaned > 0 || r.videoGenerationsCleaned > 0 || r.storageFilesRemoved > 0) {
              console.log("cleanup-unsaved-generations:", r);
            }
          })
          .catch((err) => console.error("cleanup-unsaved-generations error:", err));
      }, CLEANUP_UNSAVED_INTERVAL_MS);
    }
  });
}
