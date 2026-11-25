export function currency(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function wholeCurrency(value: number | string | null | undefined): string {
  const amount = Math.round(Number(value || 0));
  return `₱${amount.toLocaleString("en-PH")}`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function statusTone(status: string | null | undefined): "blue" | "green" | "red" | "amber" | "slate" {
  const value = String(status || "").toLowerCase();
  if (value.includes("approved") || value.includes("confirmed") || value === "paid") return "green";
  if (value.includes("reject")) return "red";
  if (value.includes("pending")) return "amber";
  if (value.includes("active")) return "blue";
  return "slate";
}
