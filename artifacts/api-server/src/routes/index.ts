import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import marketlensRouter from "./marketlens.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketlensRouter);

export default router;
