"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return alert(error.message);
    if (!user) return;

    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("auth_id", user.id)
      .single();

    if (!member) return alert("Member record not found");

    let roles: string[] = [];
    if (Array.isArray(member.roles)) roles = member.roles;
    else if (typeof member.roles === "string") {
      try {
        roles = JSON.parse(member.roles);
      } catch {
        roles = [member.roles];
      }
    }

    if (roles.includes("admin"))
      router.push("/"); // Admin dashboard
    else if (roles.includes("member"))
      router.push("/dashboard"); // Member dashboard
    else alert("No valid role assigned");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
          Login
        </h1>

        <label className="block text-sm text-gray-700 mb-4">
          Email
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
          />
        </label>

        <label className="block text-sm text-gray-700 mb-4">
          Password
          <input
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
          />
        </label>

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition mt-2"
        >
          Log In
        </button>
      </div>
    </div>
  );
}
