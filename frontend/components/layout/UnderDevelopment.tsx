"use client";

import Link from "next/link";
import { Construction, ArrowLeft, Clock3 } from "lucide-react";
import type { UnderDevelopmentProps } from "@/lib/types";

export default function UnderDevelopment({
  title = "Page Under Development",
  description = "We're currently working on this section to make it available for you. Please check back soon!",
}: UnderDevelopmentProps) {
  return (
    <div className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Construction size={38} strokeWidth={1.7} />
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          <Clock3 size={14} />
          UNDER DEVELOPMENT
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
          {title}
        </h1>

        <p className="mx-auto max-w-md text-sm leading-7 text-slate-500 sm:text-base">
          {description}
        </p>

        <div className="mx-auto my-8 h-px w-16 bg-slate-200" />

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <p className="mt-6 text-xs text-slate-400">DLMSF Monitoring System</p>
      </div>
    </div>
  );
}
