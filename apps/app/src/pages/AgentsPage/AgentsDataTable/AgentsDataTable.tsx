import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { Agent } from "@repo/schemas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { AgentNameCell } from "./AgentNameCell";
import { CapabilitiesCell } from "./CapabilitiesCell";
import { RuntimeCell } from "./RuntimeCell";
import { TagsCell } from "./TagsCell";
import { ToolsCell } from "./ToolsCell";

const s = "agents";

const columns: ColumnDef<Agent>[] = [
  {
    id: "agent",
    accessorFn: (row) => row.name,
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.title`);
    },
    cell: ({ row }) => <AgentNameCell agent={row.original} />,
  },
  {
    id: "runtime",
    accessorFn: (row) => row.defaultRuntime,
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.defaultRuntime`);
    },
    cell: ({ row }) => <RuntimeCell agent={row.original} />,
  },
  {
    id: "capabilities",
    accessorFn: (row) => row.capabilities.length,
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.capabilities`);
    },
    cell: ({ row }) => <CapabilitiesCell agent={row.original} />,
  },
  {
    id: "tools",
    accessorFn: (row) => row.allowedTools.length,
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.allowedTools`);
    },
    cell: ({ row }) => <ToolsCell agent={row.original} />,
  },
  {
    id: "tags",
    accessorFn: (row) => row.tags.join(", "),
    header: () => {
      const { t } = useTranslation();

      return t(`${s}.tags`);
    },
    cell: ({ row }) => <TagsCell agent={row.original} />,
  },
];

export const AgentsDataTable = ({ data }: { data: Agent[] }) => {
  const navigate = useNavigate();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleRowClick = useCallback(
    (agentId: string) => {
      navigate({ to: "/agents/$agentId", params: { agentId } });
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
