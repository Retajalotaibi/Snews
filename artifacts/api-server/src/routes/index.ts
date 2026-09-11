import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketlensRouter from "./marketlens";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketlensRouter);

export default router;
