type TableLoadingProps = {
  message: string;
  colSpan?: number;
};

export default function TableLoading({
  message,
  colSpan = 4,
}: TableLoadingProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="flex min-h-105 w-full flex-col items-center justify-center gap-3">
          <span
            className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"
            role="status"
            aria-label="Loading"
          />

          <span className="text-sm font-medium text-slate-500">{message}</span>
        </div>
      </td>
    </tr>
  );
}
