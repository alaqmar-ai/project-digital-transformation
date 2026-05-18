import { Construction } from 'lucide-react';

export default function PagePlaceholder({
  title,
  subtitle,
  phase,
}: {
  title: string;
  subtitle?: string;
  phase?: string;
}) {
  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
      </div>
      <div className="bg-white border border-border rounded-2xl shadow-card p-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center text-primary mb-4">
          <Construction size={26} />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Coming soon</h2>
        <p className="text-sm text-text-muted mt-2 max-w-md">
          This module will be wired up in {phase ?? 'an upcoming phase'}. The foundation, theme,
          and RBAC are in place - content modules follow.
        </p>
      </div>
    </div>
  );
}
