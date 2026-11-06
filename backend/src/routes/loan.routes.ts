import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getLoans, createLoan, updateLoan, deleteLoan } from "../controllers/loan.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", getLoans);
router.post("/", authorize("admin"), createLoan);
router.patch("/:id", authorize("admin"), updateLoan);
router.delete("/:id", authorize("admin"), deleteLoan);
export default router;
