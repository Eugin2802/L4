import { Router, type IRouter } from "express";
import healthRouter from "./health";
import l4Router from "./l4";

const router: IRouter = Router();

router.use(healthRouter);
router.use(l4Router);

export default router;
