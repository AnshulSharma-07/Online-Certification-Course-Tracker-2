import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const label = (s) => String(s || '').replaceAll('_', ' ');

export function StatusPill({ status }) {
  return <span className={`pill status-${status}`}>{label(status)}</span>;
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && <p className="text-sm text-blue-700 font-bold uppercase tracking-wide">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const styles = type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800';
  const Icon = type === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 text-sm rounded-lg p-3 ${styles}`}>
      <Icon size={17} className="mt-0.5 shrink-0" /> <span>{children}</span>
    </div>
  );
}

export function Spinner({ text = 'Loading…' }) {
  return <div className="flex items-center justify-center gap-2 p-10 muted"><Loader2 className="animate-spin" size={18} /> {text}</div>;
}

export function Empty({ children }) {
  return <div className="p-10 text-center muted">{children}</div>;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-3 p-3 text-sm">
      <button className="btn btn-secondary !p-2" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn btn-secondary !p-2" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  );
}

export function Field({ label: text, hint, children, className = '' }) {
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      {text}
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs muted font-normal">{hint}</span>}
    </label>
  );
}

export function HistoryList({ history = [] }) {
  return (
    <ol className="border-l-2 border-slate-200 ml-2 space-y-3">
      {history.map((h, i) => (
        <li key={i} className="pl-4 relative">
          <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={h.status} /><span className="text-xs muted">{fmtDateTime(h.at)}{h.actor?.name ? ` · ${h.actor.name}` : ''}</span></div>
          {h.comment && <p className="text-sm mt-1">{h.comment}</p>}
        </li>
      ))}
    </ol>
  );
}

export const FLAG_TEXT = {
  DUPLICATE_FILE: 'The same file was uploaded by another student',
  DUPLICATE_CERTIFICATE_ID: 'This certificate ID was used by another student',
};
