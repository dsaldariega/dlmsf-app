"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  tableClassName?: string;
  thClassName?: string;
  tdClassName?: string;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  tbodyClassName?: string;
  loadingContent?: ReactNode;
  emptyContent?: ReactNode;
  loadingRow?: ReactNode;
  getRowKey: (row: T) => string | number;
  pageSize?: number;
};

export default function DataTable<T>({
  data,
  columns,
  tableClassName = "w-full min-w-175 table-auto text-left text-sm",
  thClassName = "border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500",
  tdClassName = "border-b border-slate-100 px-5 py-4 text-slate-700",
  loading = false,
  loadingMessage = "",
  emptyMessage = "No data available.",
  tbodyClassName = "divide-y divide-slate-100",
  emptyContent,
  loadingRow,
  getRowKey,
  pageSize = 10,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, pageSize, safePage],
  );
  const showPagination = !loading && data.length > pageSize;
  const firstItem = data.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, data.length);
  return (
    <div className="dlmsf-table-responsive">
      <table className={`${tableClassName} dlmsf-table dlmsf-table-striped relative`} style={{ width: "100%" }}>
      <thead className="bg-slate-50">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={`${thClassName} ${column.headerClassName ?? ""}`}
            >
              <motion.div
                layout
                transition={{
                  layout: { duration: 0.3, ease: "easeInOut" },
                }}
              >
                {column.header}
              </motion.div>
            </th>
          ))}
        </tr>
      </thead>

      <tbody className={tbodyClassName}>
        {loading ? (
          (loadingRow ?? (
            <tr>
              <td
                colSpan={columns.length}
                className={`${tdClassName} text-center`}
              >
                <div className="flex flex-col items-center justify-center gap-3 py-8" aria-live="polite">
                  <span
                    className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"
                    role="status"
                    aria-label="Loading"
                  />
                  <span className="text-sm text-slate-500">
                    {loadingMessage || "Loading..."}
                  </span>
                </div>
              </td>
            </tr>
          ))
        ) : data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className={`${tdClassName} text-center`}
            >
              {emptyContent ?? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Inbox size={30} className="text-slate-300" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-500">{emptyMessage}</span>
                </div>
              )}
            </td>
          </tr>
        ) : (
          <AnimatePresence mode="sync">
            {paginatedData.map((row, index) => (
              <motion.tr
                key={getRowKey(row)}
                layout
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut",
                  layout: { duration: 0.3, ease: "easeInOut" },
                }}
                className="hover:bg-slate-50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${tdClassName} ${column.cellClassName ?? ""}`}
                  >
                    <motion.div
                      layout
                      transition={{
                        layout: {
                          duration: 0.3,
                          ease: "easeInOut",
                        },
                      }}
                    >
                      {column.render(row, index)}
                    </motion.div>
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        )}
      </tbody>
      </table>
      {showPagination && (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500" aria-live="polite">
            Showing <span className="font-semibold text-slate-700">{firstItem}</span>–<span className="font-semibold text-slate-700">{lastItem}</span> of <span className="font-semibold text-slate-700">{data.length}</span>
          </p>
          <div className="flex items-center gap-1" role="navigation" aria-label="Table pagination">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={safePage === 1}
              className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !min-h-0 !px-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).slice(
              Math.max(0, safePage - 3),
              Math.min(totalPages, safePage + 2),
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                aria-current={safePage === pageNumber ? "page" : undefined}
                className={safePage === pageNumber
                  ? "dlmsf-btn dlmsf-btn-primary dlmsf-btn-sm !min-h-0 !min-w-8 !px-2"
                  : "dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !min-h-0 !min-w-8 !px-2"}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={safePage === totalPages}
              className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !min-h-0 !px-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
