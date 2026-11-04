import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center px-4 py-12">
      <LoaderCircle size={42} className="animate-spin text-blue-600" />
      <h2 className="text-lg font-semibold text-slate-800">Loading...</h2>
    </div>
  );
}
