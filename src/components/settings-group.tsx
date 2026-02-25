interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05]">
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  border?: boolean;
}

export function SettingsRow({ label, description, children, border = true }: SettingsRowProps) {
  return (
    <div
      className={`px-4 py-3 flex items-center justify-between gap-4 ${
        border ? "border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-gray-900 dark:text-gray-100">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
