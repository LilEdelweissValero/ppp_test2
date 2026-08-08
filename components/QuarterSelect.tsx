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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ink-secondary)",
    marginBottom: 4,
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${invalid ? "#B91C1C" : "var(--rule-strong)"}`,
    borderRadius: 3,
    padding: "7px 12px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--surface)",
    outline: "none",
  };

  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={selectStyle}
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
