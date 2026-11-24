import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import {
  getActiveFiscalYear, listFiscalYears, createFiscalYear, updateFiscalYear, updateFiscalYearSettings, deleteFiscalYear, activateFiscalYear, closeFiscalYear,
  listFiscalYearSettings, updateTierSetting, assignMemberToFiscalYear, exportFiscalYear, purgeFiscalYear
} from "../controllers/fiscal-year.controller.js";

const router = Router();
router.use(authenticate);
router.get("/current", getActiveFiscalYear);
router.use(authorize("admin"));
router.get("/", listFiscalYears);
router.post("/", createFiscalYear);
router.patch("/:id", updateFiscalYear);
router.put("/:id/settings", updateFiscalYearSettings);
router.delete("/:id", deleteFiscalYear);
router.post("/:id/activate", activateFiscalYear);
router.post("/:id/close", closeFiscalYear);
router.get("/:id/settings", listFiscalYearSettings);
router.patch("/:id/tiers/:tierCode", updateTierSetting);
router.put("/:id/members/:memberId", assignMemberToFiscalYear);
router.get("/:id/export", exportFiscalYear);
router.post("/:id/purge", purgeFiscalYear);
export default router;
