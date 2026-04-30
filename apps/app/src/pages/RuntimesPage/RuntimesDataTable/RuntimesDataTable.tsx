import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { RuntimeIcon } from "../RuntimeIcon";

const s = "runtimes";

const RuntimeNameCell = ({ runtime }: { runtime: AgentRuntimeConfig }) => (
  <div className="flex items-center gap-3">
    <RuntimeIcon className="h-5 w-5 shrink-0" type={runtime.type} />
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{runtime.name || "Unnamed Runtime"}</div>
      <div className="truncate text-xs text-muted-foreground">
        {runtime.connection.mode === "ssh" && runtime.connection.host
          ? runtime.connection.host
          : "localhost"}
      </div>
    </div>
  </div>
);

const columns: ColumnDef<AgentRuntimeConfig>[] = [
  {
    id: "runtime",
    accessorFn: (row) => row.name,
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.runtime`);
    },
    cell: ({ row }) => <RuntimeNameCell runtime={row.original} />,
  },
  {
    accessorKey: "connection.mode",
    id: "connectionMode",
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.connectionMode`);
    },
  },
  {
    accessorKey: "type",
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.type`);
    },
  },
  {
    id: "actions",
    cell: () => <MoreHorizontal className="h-4 w-4 text-muted-foreground" />,
  },
];

export const RuntimesDataTable = ({ data }: { data: AgentRuntimeConfig[] }) => {
  const navigate = useNavigate();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleRowClick = useCallback(
    (runtimeId: string) => {
      navigate({ to: "/runtimes/$runtimeId", params: { runtimeId } });
    },
    [navigate]
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => handleRowClick(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
