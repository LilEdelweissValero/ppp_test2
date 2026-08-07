"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

interface LogEntry {
  id: number;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  remarks: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: "Project" | "Task";
  entityId: number;
}

export default function ChangeHistoryModal({
  open,
  onClose,
  entityType,
  entityId,
}: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`/api/change-history?entityType=${entityType}&entityId=${entityId}`)
        .then((res) => res.json())
        .then((data) => {
          setLogs(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, entityType, entityId]);

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

  return (
    <Modal open={open} onClose={onClose} title="Change History">
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No changes recorded.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="border border-gray-200 rounded-md p-3 text-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    log.changeType === "status"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {log.changeType === "status" ? "Status" : "Quarter"}
                </span>
                <span className="text-gray-400 text-xs">
                  {formatDate(log.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{log.oldValue}</span>
                <span className="text-gray-400">&rarr;</span>
                <span className="font-medium">{log.newValue}</span>
              </div>
              {log.remarks && (
                <p className="mt-1 text-gray-600">{log.remarks}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
