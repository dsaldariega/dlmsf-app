import type { Request, Response, NextFunction } from "express";
import { fetchMembers } from "../services/member.service.js";

export async function getMembers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const members = await fetchMembers();

    res.status(200).json({
      success: true,
      data: members
    });
  } catch (error) {
    next(error);
  }
}