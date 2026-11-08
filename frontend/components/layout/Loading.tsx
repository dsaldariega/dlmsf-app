import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center gap-3 px-4 py-12"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-blue-50">
        <LoaderCircle size={30} className="animate-spin text-blue-600" />
      </span>
      <h2 className="text-sm font-semibold text-slate-700">
        Loading your workspace...
      </h2>
    </div>
  );
}
