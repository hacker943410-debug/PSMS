import type { CSSProperties, ReactNode } from "react";

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
  getRowClassName?: (row: TData, index: number) => string;
  emptyState?: ReactNode;
  caption?: string;
  className?: string;
  bodyMaxHeight?: string | number;
  bodyClassName?: string;
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
  getRowClassName,
  emptyState = "No records to display.",
  caption,
  className = "",
  bodyMaxHeight,
  bodyClassName = "",
}: DataTableProps<TData>) {
  const tableBodyStyle: CSSProperties | undefined = bodyMaxHeight
    ? {
        maxHeight:
          typeof bodyMaxHeight === "number"
            ? `${bodyMaxHeight}px`
            : bodyMaxHeight,
      }
    : undefined;

  return (
    <div
      className={[
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "overflow-x-auto",
          bodyMaxHeight ? "overflow-y-auto" : "",
          bodyClassName,
        ].join(" ")}
        style={tableBodyStyle}
      >
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    "whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-slate-500",
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
                  className={[
                    "transition-colors hover:bg-blue-50/60",
                    getRowClassName?.(row, rowIndex) ?? "",
                  ].join(" ")}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        "whitespace-nowrap px-3 py-2 align-middle text-slate-700",
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
                  className="px-3 py-6 text-center text-sm text-slate-500"
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
