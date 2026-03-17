import { Router, Request, Response } from "express";
import adStyles from "../lib/ad-styles.json";

const router = Router();

/** GET /ad-styles — public config for frontend (static + video styles). */
router.get("/", (_req: Request, res: Response) => {
  res.json(adStyles);
});

export default router;
