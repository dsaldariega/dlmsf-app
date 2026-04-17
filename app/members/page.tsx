"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";

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

  const RATE = 50;

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("id", { ascending: false });
    setMembers(data || []);
  };

  const addMember = async () => {
    if (!name.trim() || heads <= 0) return;
    await supabase.from("members").insert([{ name, heads }]);
    setName("");
    setHeads(1);
    fetchMembers();
  };

  const deleteMember = async (id: number) => {
    const confirmed = confirm("Are you sure you want to delete this member?");
    if (!confirmed) return;
    await supabase.from("members").delete().eq("id", id);
    fetchMembers();
  };

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditHeads(member.heads);
  };

  const saveEdit = async (id: number) => {
    if (editHeads <= 0) return alert("Heads must be at least 1");
    await supabase.from("members").update({ heads: editHeads }).eq("id", id);
    setEditingId(null);
    fetchMembers();
  };

  const weeklyDue = (h: number) => h * RATE;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Members</h1>
        <p className="text-sm text-gray-500 mb-6">
          Weekly contribution: ₱{RATE} per head
        </p>

        {/* FORM */}
        <div className="bg-white rounded-lg shadow p-5 mb-6 hover:shadow-md transition-transform transform hover:-translate-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Member name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition"
              type="number"
              value={heads}
              min={1}
              onChange={(e) => setHeads(Number(e.target.value))}
              placeholder="Heads"
            />

            <button
              onClick={addMember}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Add Member
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="w-full overflow-hidden rounded-lg shadow-xs bg-white">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Heads</th>
                  <th className="px-4 py-3">Weekly Due</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      No members yet
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr
                      key={m.id}
                      className="text-gray-700 border-b border-gray-200"
                    >
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input
                            type="number"
                            value={editHeads}
                            min={1}
                            onChange={(e) =>
                              setEditHeads(Number(e.target.value))
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          m.heads
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-700">
                        ₱{weeklyDue(editingId === m.id ? editHeads : m.heads)}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        {editingId === m.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(m.id)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:underline text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(m)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteMember(m.id)}
                              className="text-red-500 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default withAuth(MembersPage, "admin");
