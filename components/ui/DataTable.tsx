"use client";

import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  getPaginationRowModel,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  AlertCircle,
} from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumn?: string;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Filter records...",
  searchColumn,
  isLoading = false,
  error = null,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries matching your current filters.",
  onRowClick,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className={cn("space-y-3", className)}>
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        {/* Controls: Columns visibility */}
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Columns</span>
          </button>

          {showVisibilityMenu && (
            <div className="absolute right-0 top-9 z-30 w-44 rounded-lg border border-border bg-surface p-2 shadow-xl">
              <div className="text-[11px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider">
                Toggle Columns
              </div>
              <div className="mt-1 space-y-1">
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-2 py-1 text-xs text-text hover:bg-surface-2 rounded cursor-pointer capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={(e) => column.toggleVisibility(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-0 bg-surface-2"
                      />
                      <span>{column.id}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {/* Error State */}
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-danger">
            <AlertCircle className="h-6 w-6 mb-2" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        ) : isLoading ? (
          /* Loading Skeleton State */
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-9 w-full rounded bg-surface-2 animate-pulse"
              />
            ))}
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          /* Empty State */
          <div className="p-8">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : (
          /* Data Table */
          <div className="overflow-x-auto">
            <table className="w-full text-table text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-border bg-surface-2/60 text-text-muted font-medium"
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-2.5 text-xs font-medium tracking-tight whitespace-nowrap"
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              <ArrowUpDown className="h-3 w-3 text-text-muted/60" />
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={cn(
                      "hover:bg-surface-hover/70 transition-colors",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2.5 whitespace-nowrap text-text"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && !error && table.getPageCount() > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted pt-1">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-text font-medium">
                {table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  1}
              </strong>{" "}
              to{" "}
              <strong className="text-text font-medium">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}
              </strong>{" "}
              of{" "}
              <strong className="text-text font-medium">
                {table.getFilteredRowModel().rows.length}
              </strong>{" "}
              entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px]">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="rounded border border-border p-1 hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="rounded border border-border p-1 hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="rounded border border-border p-1 hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="rounded border border-border p-1 hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
