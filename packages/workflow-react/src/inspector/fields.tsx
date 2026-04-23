import type { ChangeEvent, ReactNode } from "react";

/** Minimal uncontrolled field wrappers used by the per-selection forms. */
export function TextField({
  label,
  value,
  onCommit,
  disabled,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        defaultValue={value}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        onBlur={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.value !== value) onCommit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        style={inputStyle}
      />
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label style={{ ...rowStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
      />
      <span style={{ ...labelStyle, marginBottom: 0 }}>{label}</span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        data-testid={testId}
        style={inputStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <header style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
        {title}
      </header>
      {children}
    </section>
  );
}

const rowStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
};

const labelStyle = {
  fontSize: 12,
  color: "#475569",
  marginBottom: 2,
};

const inputStyle = {
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #CBD5E1",
  borderRadius: 4,
  background: "white",
};
