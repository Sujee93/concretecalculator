/**
 * Express entry point — self-hosted replacement for the Vercel serverless
 * functions. Serves the built SPA (dist/) and the /api/* + /uploads/* routes
 * from a single long-running Node process, which is what shared/cloud hosts
 * like Hostinger's Node.js app runner expect (one startup file, one port).
 *
 * Production: `npm run build` (frontend + this file) then `npm start`
 * (runs dist-server/index.js). See HOSTINGER_DEPLOYMENT.md for the full
 * hosting setup.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { UPLOADS_DIR } from "./lib/storage.js";
import { uploadMiddleware } from "./lib/uploads.js";
import { partialLeadHandler } from "./routes/partialLead.js";
import { getPricingConfig, postPricingConfig } from "./routes/pricingConfig.js";
import { submitHandler } from "./routes/submit.js";
import { uploadHandler } from "./routes/upload.js";
import { getWelcomeConfig, postWelcomeConfig } from "./routes/welcomeConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist-server/index.js (compiled) sits one level below the repo root.
const DIST_DIR = path.resolve(__dirname, "..", "dist");

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));

app.post("/api/submit", asyncRoute(submitHandler));
app.post("/api/partial-lead", asyncRoute(partialLeadHandler));
app.get("/api/pricing-config", asyncRoute(getPricingConfig));
app.post("/api/pricing-config", asyncRoute(postPricingConfig));
app.get("/api/welcome-config", asyncRoute(getWelcomeConfig));
app.post("/api/welcome-config", asyncRoute(postWelcomeConfig));
app.post("/api/upload", uploadMiddleware, asyncRoute(uploadHandler));

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(DIST_DIR));

// Client-side routes (e.g. /admin) — fall back to index.html so deep links
// and refreshes work. Anything under /api or /uploads that reached here
// genuinely doesn't exist, so it 404s instead of returning the SPA shell.
app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is larger than the 10 MB limit."
        : err.message;
    res.status(400).json({ error: message });
    return;
  }
  console.error("Unhandled server error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
};
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Smooth Concrete server listening on port ${PORT}`);
});
