import type { ReactNode } from "react";

export type DataTableColumn<TData> = {
  key: string;
  header: ReactNode;
  cell: (row: TData) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
};

type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  getRowKey: (row: TData, index: number) => string;
  emptyState?: ReactNode;
  caption?: string;
  className?: string;
};

const alignClasses: Record<
  NonNullable<DataTableColumn<unknown>["align"]>,
  string
> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<TData>({
  columns,
  data,
  getRowKey,
  emptyState = "No records to display.",
  caption,
  className = "",
}: DataTableProps<TData>) {
  return (
    <div
      className={[
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-100">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600",
                    alignClasses[column.align ?? "left"],
                    column.className ?? "",
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr
                  key={getRowKey(row, rowIndex)}
                  className="hover:bg-slate-50"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        "px-4 py-3 align-middle text-slate-700",
                        alignClasses[column.align ?? "left"],
                        column.className ?? "",
                      ].join(" ")}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
