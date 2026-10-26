export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "paid":
      return "bg-emerald-100 text-emerald-700";
    case "active":
      return "bg-blue-100 text-blue-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "overdue":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};