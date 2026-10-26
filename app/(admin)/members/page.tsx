"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { motion, AnimatePresence } from "motion/react";

type Member = {
  id: number;
  name: string;
  heads: number;
};

function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [heads, setHeads] = useState<number>(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editHeads, setEditHeads] = useState<number>(1);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const RATE = 50;

  useEffect(() => {
    void fetchMembers();
  }, []);

  // Fetch members
  const fetchMembers = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      setMembers((data || []) as Member[]);
    } catch (error) {
      console.error("Error fetching members:", error);
      alert("Unable to load members.");
    } finally {
      setLoading(false);
    }
  };

  // Currency formatter
  const formatCurrency = (value: number) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Add member
  const addMember = async () => {
    if (adding) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      alert("Please enter the member's name.");
      return;
    }

    if (!Number.isInteger(heads) || heads < 1) {
      alert("Heads must be at least 1.");
      return;
    }

    setAdding(true);

    try {
      const { error } = await supabase.from("members").insert([
        {
          name: trimmedName,
          heads,
        },
      ]);

      if (error) throw error;

      setName("");
      setHeads(1);

      await fetchMembers();
      alert("Member added successfully.");
    } catch (error) {
      console.error("Error adding member:", error);
      alert(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setAdding(false);
    }
  };

  // Delete member
  const deleteMember = async (id: number) => {
    if (deletingId !== null) return;

    if (!confirm("Are you sure you want to delete this member?")) {
      return;
    }

    setDeletingId(id);

    try {
      const { error } = await supabase.from("members").delete().eq("id", id);

      if (error) throw error;

      await fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
      alert(
        error instanceof Error ? error.message : "Unable to delete member.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Start editing
  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditHeads(member.heads);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditHeads(1);
  };

  // Save edited member
  const saveEdit = async (id: number) => {
    if (saving) return;

    if (!Number.isInteger(editHeads) || editHeads < 1) {
      alert("Heads must be at least 1.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("members")
        .update({ heads: editHeads })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      await fetchMembers();
    } catch (error) {
      console.error("Error updating member:", error);
      alert(
        error instanceof Error ? error.message : "Unable to update member.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Weekly contribution
  const weeklyDue = (count: number) => count * RATE;

  // Summary calculations
  const totalHeads = members.reduce(
    (sum, member) => sum + Number(member.heads || 0),
    0,
  );

  const totalWeeklyDue = members.reduce(
    (sum, member) => sum + weeklyDue(Number(member.heads || 0)),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Members
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage members, head counts, and weekly contributions.
        </p>
      </div>

      {/* Summary cards */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Members</p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: loading ? 0.5 : 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-blue-700"
          >
            {loading ? "—" : members.length.toLocaleString()}
          </motion.p>
          <p className="mt-1 text-xs text-slate-500">Registered members</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Heads</p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: loading ? 0.5 : 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-indigo-700"
          >
            {loading ? "—" : totalHeads.toLocaleString("en-PH")}
          </motion.p>
          <p className="mt-1 text-xs text-slate-500">Combined head count</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-sm font-medium text-slate-500">
            Total Weekly Contribution
          </p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: loading ? 0.5 : 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-emerald-700"
          >
            {loading ? "—" : formatCurrency(totalWeeklyDue)}
          </motion.p>
          <p className="mt-1 text-xs text-slate-500">
            ₱50.00 per head each week
          </p>
        </div>
      </div>

      {/* Add member form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add New Member</h2>

        <p className="mt-1 text-sm text-slate-500">
          Enter the member's name and number of heads to calculate their weekly
          contribution.
        </p>

        <form
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void addMember();
          }}
        >
          {/* Member name */}
          <div className="min-w-0">
            <label
              htmlFor="memberName"
              className="mb-2 block text-sm font-semibold leading-5 text-slate-700"
            >
              Member Name <span className="text-red-500">*</span>
            </label>

            <input
              id="memberName"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter member name"
              required
              maxLength={150}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          {/* Number of heads */}
          <div className="min-w-0">
            <label
              htmlFor="memberHeads"
              className="mb-2 block text-sm font-semibold leading-5 text-slate-700"
            >
              Number of Heads <span className="text-red-500">*</span>
            </label>

            <input
              id="memberHeads"
              type="number"
              min={1}
              step={1}
              value={heads}
              onChange={(event) =>
                setHeads(
                  event.target.value === "" ? 0 : Number(event.target.value),
                )
              }
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          {/* Add button */}
          <div className="flex min-w-0 items-end sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              disabled={adding || loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {adding ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Add Member
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live contribution preview */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">
            Weekly contribution preview
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            {heads > 0 && Number.isInteger(heads)
              ? `${heads} ${heads === 1 ? "head" : "heads"} × ${formatCurrency(RATE)} = ${formatCurrency(weeklyDue(heads))} per week`
              : "Enter a valid number of heads to calculate the weekly contribution."}
          </p>
        </div>
      </section>

      {/* Members table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Member Records</h2>
            <p className="mt-1 text-sm text-slate-500">
              View and manage member details and weekly contributions.
            </p>
          </div>

          <span className="mt-2 inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:mt-0">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        {/* Members table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-100 overflow-y-scroll">
            <table className="w-full min-w-175 table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="w-[40%] border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Member
                  </th>
                  <th className="w-[15%] border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Heads
                  </th>
                  <th className="w-[20%] border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Weekly Due
                  </th>
                  <th className="w-[25%] border-b border-slate-200 px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="h-87.5 px-5 text-center align-middle text-slate-500"
                    >
                      <span className="inline-flex items-center justify-center gap-3">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                        Loading members...
                      </span>
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="h-87.5 px-5 text-center align-middle"
                    >
                      <p className="font-semibold text-slate-800">
                        No members yet
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Add your first member using the form above.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {members.map((member) => {
                      const isEditing = editingId === member.id;
                      const currentHeads = isEditing ? editHeads : member.heads;

                      return (
                        <motion.tr
                          key={member.id}
                          layout
                          initial={{ opacity: 0, y: -12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{
                            duration: 0.3,
                            ease: "easeOut",
                            layout: { duration: 0.25 },
                          }}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="overflow-hidden px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                                {member.name.trim().charAt(0).toUpperCase() ||
                                  "M"}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-800">
                                  {member.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Member ID: {member.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={editHeads}
                                onChange={(event) =>
                                  setEditHeads(
                                    event.target.value === ""
                                      ? 0
                                      : Number(event.target.value),
                                  )
                                }
                                aria-label={`Heads for ${member.name}`}
                                className="h-10 w-20 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                              />
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 font-medium tabular-nums text-slate-700">
                                {member.heads}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <p className="font-semibold tabular-nums text-emerald-700">
                              {formatCurrency(
                                weeklyDue(Number(currentHeads || 0)),
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Per week
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void saveEdit(member.id)}
                                    disabled={saving}
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    {saving ? "Saving..." : "Save"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(member)}
                                    disabled={saving || deletingId !== null}
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void deleteMember(member.id)}
                                    disabled={deletingId !== null || saving}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {deletingId === member.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table footer */}
        {!loading && members.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {members.length} member
              {members.length === 1 ? "" : "s"} · {totalHeads} total heads
              {" · "}
              {formatCurrency(totalWeeklyDue)} weekly contribution
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default withAuth(MembersPage, "admin");
