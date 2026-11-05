import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { getMembers } from "../controllers/member.controller.js";

const router = Router();

router.get("/", authenticate, getMembers);

export default router;