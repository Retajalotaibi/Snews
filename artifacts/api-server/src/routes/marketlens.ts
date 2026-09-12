import { Router, type IRouter } from "express";
import { GetNewsQueryParams } from "@workspace/api-zod";
import {
  getMarketComparison,
  getMarketOverview,
  getNews,
  logMarketlensError,
} from "../lib/marketlens.js";

const router: IRouter = Router();

router.get("/market/overview", async (req, res) => {
  try {
    res.json(await getMarketOverview());
  } catch (error) {
    logMarketlensError(error, "market overview");
    res.status(502).json({ error: "Live market data is unavailable right now. Please try again shortly." });
  }
});

router.get("/market/comparison", async (_req, res) => {
  try {
    res.json(await getMarketComparison());
  } catch (error) {
    logMarketlensError(error, "market comparison");
    res.status(502).json({ error: "The comparison data is unavailable right now. Please try again shortly." });
  }
});

router.get("/news", async (req, res) => {
  try {
    const parsed = GetNewsQueryParams.safeParse({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Limit must be a number between 1 and 20." });
      return;
    }
    res.json(await getNews(parsed.data.limit));
  } catch (error) {
    logMarketlensError(error, "news");
    res.status(502).json({ error: "Current news is unavailable right now. Please try again shortly." });
  }
});

export default router;