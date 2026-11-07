import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getMembers, updateMember } from "../controllers/member.controller.js";
import { createMemberWithLogin, deleteMemberWithLogin } from "../controllers/member-account.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", getMembers);
router.post("/", authorize("admin"), createMemberWithLogin);
router.patch("/:id", authorize("admin"), updateMember);
router.delete("/:id", authorize("admin"), deleteMemberWithLogin);

export default router;
