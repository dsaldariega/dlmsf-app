import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { getLoans, createLoan, updateLoan, deleteLoan } from "../controllers/loan.controller.js";
<<<<<<< HEAD
import { listLoanRequests, submitLoanRequest, reviewLoanRequest } from "../controllers/member-workflow.controller.js";
const router = Router();
router.use(authenticate);
router.get("/", getLoans);
router.get("/requests", listLoanRequests);
router.post("/requests", authorize("member"), submitLoanRequest);
router.patch("/requests/:id", authorize("admin"), reviewLoanRequest);
=======

const router = Router();
router.use(authenticate);
router.get("/", getLoans);
>>>>>>> 71a310415f8d3313954374505d479551c9e77442
router.post("/", authorize("admin"), createLoan);
router.patch("/:id", authorize("admin"), updateLoan);
router.delete("/:id", authorize("admin"), deleteLoan);
export default router;
