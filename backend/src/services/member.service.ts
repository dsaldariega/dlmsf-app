import { getMembers } from "../repositories/member.repository.js";

export async function fetchMembers() {
  return await getMembers();
}