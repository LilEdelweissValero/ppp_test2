"use client";

import { quarterRange } from "@/lib/quarters";

interface QuarterSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  invalid?: boolean;
}

export default function QuarterSelect({
  value,
  onChange,
  label,
  required,
  invalid,
}: QuarterSelectProps) {
  const quarters = quarterRange(2, 2);
  const baseClass = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ";
  const selectClass = invalid
    ? baseClass + "border-red-500 focus:ring-red-500"
    : baseClass + "border-gray-300 focus:ring-blue-500";

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={selectClass}
      >
        <option value="">Select quarter</option>
        {quarters.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
    </div>
  );
}
