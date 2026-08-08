"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

interface LogEntry {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  remarks: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CHANGE_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  create: { bg: "bg-green-100", text: "text-green-700", label: "ADD" },
  update: { bg: "bg-blue-100", text: "text-blue-700", label: "MODIFY" },
  delete: { bg: "bg-red-100", text: "text-red-700", label: "DELETE" },
  import: { bg: "bg-purple-100", text: "text-purple-700", label: "IMPORT" },
  quarter: { bg: "bg-amber-100", text: "text-amber-700", label: "QUARTER" },
  status: { bg: "bg-indigo-100", text: "text-indigo-700", label: "STATUS" },
};

export default function HistoryLogModal({ open, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [changeFilter, setChangeFilter] = useState("");

  useEffect(() => {
    if (open) {
      setPage(1);
      setEntityFilter("");
      setChangeFilter("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityFilter) params.set("entityType", entityFilter);
    if (changeFilter) params.set("changeType", changeFilter);

    fetch(`/api/change-history/all?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, page, entityFilter, changeFilter]);

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function getStyle(changeType: string) {
    return (
      CHANGE_TYPE_STYLES[changeType] || {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: changeType.toUpperCase(),
      }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="History Log">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3 text-sm">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All Entity Types</option>
            <option value="Framework">Framework</option>
            <option value="Program">Program</option>
            <option value="Project">Project</option>
            <option value="Task">Task</option>
            <option value="Import">Import</option>
          </select>
          <select
            value={changeFilter}
            onChange={(e) => {
              setChangeFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All Actions</option>
            <option value="create">Add</option>
            <option value="update">Modify</option>
            <option value="delete">Delete</option>
            <option value="import">Import</option>
            <option value="quarter">Quarter Change</option>
            <option value="status">Status Change</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">No history records found.</p>
        ) : (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => {
                const style = getStyle(log.changeType);
                return (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-md p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${style.bg} ${style.text}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {log.entityType}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <div className="text-gray-800 font-medium">
                      {log.entityName || `${log.entityType} #${log.entityId}`}
                    </div>
                    {log.oldValue && log.newValue && (
                      <div className="text-xs text-gray-500 mt-1">
                        {log.oldValue} &rarr; {log.newValue}
                      </div>
                    )}
                    {!log.oldValue && log.newValue && (
                      <div className="text-xs text-gray-500 mt-1">
                        {log.newValue}
                      </div>
                    )}
                    {log.details && (
                      <div className="text-xs text-gray-500 mt-1">
                        {log.details}
                      </div>
                    )}
                    {log.remarks && (
                      <p className="mt-1 text-xs text-gray-500 italic">
                        {log.remarks}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-gray-500 text-xs">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
