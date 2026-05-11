import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import registerRouter from "./register.js";
import attendanceRouter from "./attendance.js";
import authRouter from "./auth.js";
import adminStatsRouter from "./adminStats.js";
import publicStatsRouter from "./publicStats.js";
import dashboardRouter from "./dashboard.js";
import teachersRouter from "./teachers.js";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(publicStatsRouter);
router.use(registerRouter);
router.use(attendanceRouter);
router.use(adminStatsRouter);
router.use(dashboardRouter);
router.use(teachersRouter);

export default router;
