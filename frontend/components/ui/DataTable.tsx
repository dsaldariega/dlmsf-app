"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
}: DataTableProps<T>) {
  return (
    <table className={`${tableClassName} relative`} style={{ width: "100%" }}>
      <thead className="sticky top-0 z-10 bg-slate-50">
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
                <div className="flex flex-col items-center justify-center gap-3 py-6">
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
              {emptyContent ?? emptyMessage}
            </td>
          </tr>
        ) : (
          <AnimatePresence mode="sync">
            {data.map((row, index) => (
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
  );
}
