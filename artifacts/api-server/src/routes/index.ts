import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import practiceRouter from "./practice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(openaiRouter);
router.use(practiceRouter);

export default router;
