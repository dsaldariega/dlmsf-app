import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getMembers, createMember, updateMember, deleteMember } from "../controllers/member.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", getMembers);
router.post("/", authorize("admin"), createMember);
router.patch("/:id", authorize("admin"), updateMember);
router.delete("/:id", authorize("admin"), deleteMember);

export default router;
