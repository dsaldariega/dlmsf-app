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
  getRowKey: (row: T) => string | number;
};

export default function DataTable<T>({
  data,
  columns,
  tableClassName = "",
  thClassName = "",
  tdClassName = "",
  loading = false,
  loadingMessage = "Loading...",
  emptyMessage = "No data available.",
  getRowKey,
}: DataTableProps<T>) {
  return (
    <motion.table
      layout
      className={`${tableClassName} relative`}
      style={{ width: "100%" }}
      transition={{
        layout: {
          duration: 0.3,
          ease: "easeInOut",
        },
      }}
    >
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

      <tbody>
        {loading ? (
          <tr>
            <td
              colSpan={columns.length}
              className={`${tdClassName} text-center`}
            >
              {loadingMessage}
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className={`${tdClassName} text-center`}
            >
              {emptyMessage}
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
    </motion.table>
  );
}
