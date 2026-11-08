"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import { motion, AnimatePresence } from "motion/react";
import { RATE } from "@/lib/constants/member";
import { Member, Toast } from "@/lib/types/member";
import { formatCurrency } from "@/lib/utils/members";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import TableLoading from "@/components/ui/TableLoading";

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    void fetchMembers();
  }, []);

  // Fetch members
  const fetchMembers = async () => {
    setLoading(true);

    try {
      const data = await apiRequest<Member[]>("/api/members");
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
      showToast(
        "error",
        "Unable to load members",
        "Please try refreshing the page.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Add member
  const addMember = async () => {
    if (adding) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      showToast("warning", "Name required", "Please enter the member's name.");
      return;
    }

    if (!Number.isInteger(heads) || heads < 1) {
      showToast(
        "warning",
        "Invalid head count",
        "The number of heads must be a whole number of at least 1.",
      );
      return;
    }

    setAdding(true);

    try {
      const result = await apiRequest<{ member: Member; loginEmail: string; temporaryPassword: string }>("/api/members", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName, heads }),
      });

      // Add only the newly created member to the existing list.
      setMembers((currentMembers) => [result.member, ...currentMembers]);
      setCreatedCredentials({ email: result.loginEmail, password: result.temporaryPassword });

      // Reset and close the add-member modal.
      setName("");
      setHeads(1);
      setIsAddModalOpen(false);

      showToast(
        "success",
        "Member added successfully",
        `${trimmedName} has been added. Copy the one-time login details shown on this page.`,
      );
    } catch (error) {
      console.error("Error adding member:", error);

      showToast(
        "error",
        "Failed to add member",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAdding(false);
    }
  };

  const closeAddModal = () => {
    if (adding) return;

    setIsAddModalOpen(false);
    setName("");
    setHeads(1);
  };

  // Delete member

  const deleteMember = async () => {
    if (!deleteTarget || deletingId !== null) return;

    const member = deleteTarget;
    setDeletingId(member.id);

    try {
      await apiRequest<{ id: number }>(`/api/members/${member.id}`, {
        method: "DELETE",
      });

      // Remove only the deleted member from local state.
      setMembers((currentMembers) =>
        currentMembers.filter((item) => item.id !== member.id),
      );

      setDeleteTarget(null);

      showToast(
        "success",
        "Member deleted",
        `${member.name} has been removed from your member records.`,
      );
    } catch (error) {
      console.error("Error deleting member:", error);

      showToast(
        "error",
        "Failed to delete member",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Open Edit Member modal
  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditHeads(member.heads);
  };

  // Close Edit Member modal without saving
  const cancelEdit = () => {
    if (saving) return;

    setEditingId(null);
    setEditHeads(1);
  };

  // Save edited member

  const saveEdit = async (id: number) => {
    if (saving) return;

    if (!Number.isInteger(editHeads) || editHeads < 1) {
      showToast(
        "warning",
        "Invalid head count",
        "The number of heads must be a whole number of at least 1.",
      );
      return;
    }

    setSaving(true);

    try {
      const updated = await apiRequest<Member>(`/api/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ heads: editHeads }),
      });

      // Update only the edited member in local state.
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === id ? updated : member,
        ),
      );

      setEditingId(null);
      setEditHeads(1);

      showToast(
        "success",
        "Changes saved",
        "The member's head count has been updated.",
      );
    } catch (error) {
      console.error("Error updating member:", error);

      showToast(
        "error",
        "Update failed",
        error instanceof Error ? error.message : "Please try again.",
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

  const showToast = (type: Toast["type"], title: string, message: string) => {
    setToast({
      id: Date.now(),
      type,
      title,
      message,
    });
  };

  const copyCreatedCredentials = async () => {
    if (!createdCredentials) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${createdCredentials.email}\nTemporary password: ${createdCredentials.password}`,
      );
      showToast("success", "Credentials copied", "Share them with the member through a secure channel.");
    } catch {
      showToast("warning", "Copy unavailable", "Select and copy the login details manually.");
    }
  };

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [toast]);

  const memberColumns: DataTableColumn<(typeof members)[number]>[] = [
    {
      key: "member",
      header: "Member",
      headerClassName: "w-1/3",
      cellClassName: "overflow-hidden px-5 py-4",
      render: (member) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
            {member.name.trim().charAt(0).toUpperCase() || "M"}
          </span>

          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{member.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "heads",
      header: "Heads",
      headerClassName: "w-1/3",
      cellClassName: "whitespace-nowrap px-5 py-4",
      render: (member) => (
        <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 font-medium tabular-nums text-slate-700">
          {member.heads}
        </span>
      ),
    },
    {
      key: "weeklyDue",
      header: "Weekly Due",
      headerClassName: "w-1/3",
      cellClassName: "whitespace-nowrap px-5 py-4",
      render: (member) => (
        <>
          <p className="font-semibold tabular-nums text-emerald-700">
            {formatCurrency(weeklyDue(Number(member.heads || 0)))}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Per week</p>
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "w-1/3 text-right",
      cellClassName: "whitespace-nowrap px-5 py-4",
      render: (member) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => startEdit(member)}
            disabled={saving || deletingId !== null}
            className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => setDeleteTarget(member)}
            disabled={deletingId !== null || saving}
            className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {createdCredentials && (
        <section aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold">One-time member login details</h2>
              <p className="mt-1 text-sm">Copy these details and share them with the member through a secure channel. The temporary password will not be shown again after you dismiss this notice.</p>
              <p className="mt-3 text-sm"><span className="font-semibold">Login email:</span> {createdCredentials.email}</p>
              <p className="mt-1 break-all text-sm"><span className="font-semibold">Temporary password:</span> <code>{createdCredentials.password}</code></p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => void copyCreatedCredentials()} className="dlmsf-btn dlmsf-btn-warning">Copy details</button>
              <button type="button" onClick={() => setCreatedCredentials(null)} className="dlmsf-btn dlmsf-btn-outline">Dismiss</button>
            </div>
          </div>
        </section>
      )}
      {/* Animated Toast Notifications */}
      <div
        className="pointer-events-none fixed right-4 top-4 z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`pointer-events-auto overflow-hidden rounded-xl border bg-white shadow-xl ${
                toast.type === "success"
                  ? "border-emerald-200"
                  : toast.type === "error"
                    ? "border-red-200"
                    : toast.type === "warning"
                      ? "border-amber-200"
                      : "border-blue-200"
              }`}
              role={toast.type === "error" ? "alert" : "status"}
            >
              <div className="flex items-start gap-3 p-4">
                {/* Status icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    toast.type === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : toast.type === "error"
                        ? "bg-red-50 text-red-600"
                        : toast.type === "warning"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {toast.type === "success" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  ) : toast.type === "error" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m15 9-6 6" />
                      <path d="m9 9 6 6" />
                    </svg>
                  ) : toast.type === "warning" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  )}
                </div>

                {/* Message */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {toast.title}
                  </p>
                  <p className="mt-1 wrap-break-word text-sm leading-5 text-slate-500">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  aria-label="Dismiss notification"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m18 6-12 12" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Animated countdown bar */}
              <motion.div
                key={`progress-${toast.id}`}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: "linear" }}
                style={{ transformOrigin: "left" }}
                className={`h-1 ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                      ? "bg-red-500"
                      : toast.type === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            key="delete-confirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto dlmsf-modal-backdrop p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && deletingId === null) {
                setDeleteTarget(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-member-title"
              aria-describedby="delete-member-description"
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Dialog content */}
              <div className="px-6 pb-5 pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="m19 6-1 14H6L5 6" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      id="delete-member-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Delete Member?
                    </h2>

                    <p
                      id="delete-member-description"
                      className="mt-2 text-sm leading-6 text-slate-500"
                    >
                      Are you sure you want to delete{" "}
                      <span className="font-semibold text-slate-800">
                        {deleteTarget.name}
                      </span>
                      ? This action cannot be undone.
                    </p>

                    <div className="mt-4 rounded-lg border border-red-100 bg-red-50/70 px-3 py-3">
                      <p className="mt-1 text-xs text-red-600">
                        This member will be removed from your records, and the linked development login account will also be permanently deleted. This cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialog footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500/10"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void deleteMember()}
                  disabled={deletingId !== null}
                  className="dlmsf-btn dlmsf-btn-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId !== null ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Member"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
            Estimate Weekly Contribution
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

      {/* Add Member button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          disabled={loading}
          className="dlmsf-btn dlmsf-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
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
        </button>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            key="add-member-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto dlmsf-modal-backdrop p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeAddModal();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-member-title"
              className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="10" cy="7" r="4" />
                      <path d="M20 8v6" />
                      <path d="M23 11h-6" />
                    </svg>
                  </div>

                  <div>
                    <h2
                      id="add-member-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Add New Member
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      Enter the member details and calculate their weekly
                      contribution.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={adding}
                  aria-label="Close dialog"
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m18 6-12 12" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal form */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void addMember();
                }}
              >
                <div className="space-y-5 px-6 py-6">
                  {/* Member name */}
                  <div>
                    <label
                      htmlFor="memberName"
                      className="mb-2 block text-sm font-semibold text-slate-700"
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
                      autoFocus
                      className="dlmsf-control"
                    />
                  </div>

                  {/* Number of heads */}
                  <div>
                    <label
                      htmlFor="memberHeads"
                      className="mb-2 block text-sm font-semibold text-slate-700"
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
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value),
                        )
                      }
                      required
                      className="dlmsf-control"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Each head contributes ₱50.00 per week.
                    </p>
                  </div>

                  {/* Live contribution preview */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Estimated Weekly Contribution
                    </p>

                    <p className="mt-2 text-2xl font-bold tabular-nums text-blue-700">
                      {Number.isInteger(heads) && heads >= 1
                        ? formatCurrency(weeklyDue(heads))
                        : "—"}
                    </p>

                    <p className="mt-1 text-xs text-blue-700">
                      {Number.isInteger(heads) && heads >= 1
                        ? `${heads} ${heads === 1 ? "head" : "heads"} × ${formatCurrency(RATE)} per week`
                        : "Enter a valid number of heads."}
                    </p>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    disabled={adding}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={adding || loading}
                    className="dlmsf-btn dlmsf-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingId !== null &&
          (() => {
            const editingMember = members.find(
              (member) => member.id === editingId,
            );

            if (!editingMember) return null;

            return (
              <motion.div
                key="edit-member-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto dlmsf-modal-backdrop p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !saving) {
                    cancelEdit();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="edit-member-title"
                  className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                >
                  {/* Modal header */}
                  <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                        </svg>
                      </div>

                      <div>
                        <h2
                          id="edit-member-title"
                          className="text-lg font-bold text-slate-900"
                        >
                          Edit Member
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          Update the head count for this member.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      aria-label="Close dialog"
                      className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m18 6-12 12" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal form */}
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveEdit(editingMember.id);
                    }}
                  >
                    <div className="space-y-5 px-6 py-6">
                      {/* Member name */}
                      <div>
                        <label
                          htmlFor="editMemberName"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Member Name
                        </label>

                        <input
                          id="editMemberName"
                          type="text"
                          value={editingMember.name}
                          readOnly
                          className="dlmsf-control"
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          Member names cannot be changed here.
                        </p>
                      </div>

                      {/* Number of heads */}
                      <div>
                        <label
                          htmlFor="editMemberHeads"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Number of Heads{" "}
                          <span className="text-red-500">*</span>
                        </label>

                        <input
                          id="editMemberHeads"
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
                          required
                          autoFocus
                          disabled={saving}
                          className="dlmsf-control disabled:opacity-60"
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          Each head contributes {formatCurrency(RATE)} per week.
                        </p>
                      </div>

                      {/* Live contribution preview */}
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-900">
                          Estimated Weekly Contribution
                        </p>

                        <p className="mt-2 text-2xl font-bold tabular-nums text-blue-700">
                          {Number.isInteger(editHeads) && editHeads >= 1
                            ? formatCurrency(weeklyDue(editHeads))
                            : "—"}
                        </p>

                        <p className="mt-1 text-xs text-blue-700">
                          {Number.isInteger(editHeads) && editHeads >= 1
                            ? `${editHeads} ${editHeads === 1 ? "head" : "heads"} × ${formatCurrency(RATE)} per week`
                            : "Enter a valid number of heads."}
                        </p>
                      </div>
                    </div>

                    {/* Modal footer */}
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        className="dlmsf-btn dlmsf-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Saving...
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
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

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
          <div className="h-105 overflow-y-scroll">
            <DataTable
              data={members}
              columns={memberColumns}
              getRowKey={(member) => member.id}
              tableClassName={tableClass}
              thClassName={thClass}
              tdClassName={tdClass}
              tbodyClassName="divide-y divide-slate-100"
              loading={loading}
              loadingRow={<TableLoading message="Loading members..." />}
              emptyContent={
                <div>
                  <p className="font-semibold text-slate-800">No members yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add your first member using the form above.
                  </p>
                </div>
              }
            />
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
