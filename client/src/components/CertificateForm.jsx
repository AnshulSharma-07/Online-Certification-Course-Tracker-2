import { useState } from 'react';
import { Alert, Field } from './ui';

export const PLATFORMS = ['NPTEL', 'Coursera', 'Udemy', 'edX', 'SWAYAM', 'Other'];
const MAX_BYTES = 5 * 1024 * 1024;

const toInput = (c) => ({
  title: c?.title || '',
  platform: c?.platform || 'NPTEL',
  category: c?.category || 'Technical',
  durationWeeks: c?.durationWeeks ?? 4,
  assessmentScore: c?.assessmentScore ?? '',
  certificateId: c?.certificateId || '',
  issueDate: c?.issueDate ? c.issueDate.slice(0, 10) : '',
  proofUrl: c?.proofUrl || '',
});

/** Shared by "Submit" and "Resubmit after correction". Sends multipart so a file can be attached. */
export default function CertificateForm({ initial, submitLabel, onSubmit }) {
  const [form, setForm] = useState(toInput(initial));
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const hadFile = Boolean(initial?.proofFile);

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > MAX_BYTES) { setError('File is too large (maximum 5 MB)'); e.target.value = ''; return; }
    setError('');
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file && !form.proofUrl.trim() && !hadFile) return setError('Attach your certificate file or provide a proof link');
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    if (file) data.append('proofFile', file);
    setBusy(true);
    try { await onSubmit(data); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 grid sm:grid-cols-2 gap-4">
      <Field className="sm:col-span-2" label="Course / certificate title"><input className="field" name="title" value={form.title} onChange={change} required minLength={3} maxLength={180} /></Field>
      <Field label="Learning platform">
        <select className="field" name="platform" value={form.platform} onChange={change}>{[...new Set([form.platform, ...PLATFORMS])].map((x) => <option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Category"><input className="field" name="category" value={form.category} onChange={change} maxLength={80} /></Field>
      <Field label="Course duration (weeks)"><input className="field" type="number" min="1" max="104" step="1" name="durationWeeks" value={form.durationWeeks} onChange={change} required /></Field>
      <Field label="Assessment score (%)"><input className="field" type="number" min="0" max="100" step="any" name="assessmentScore" value={form.assessmentScore} onChange={change} placeholder="Optional" /></Field>
      <Field label="Certificate ID" hint="As printed on the certificate. Helps faculty verify it."><input className="field" name="certificateId" value={form.certificateId} onChange={change} maxLength={120} /></Field>
      <Field label="Issue date"><input className="field" type="date" name="issueDate" value={form.issueDate} onChange={change} max={new Date().toISOString().slice(0, 10)} /></Field>

      <fieldset className="sm:col-span-2 rounded-xl border border-dashed p-4 space-y-3">
        <legend className="px-2 text-sm font-semibold">Proof of completion</legend>
        <Field label="Upload certificate (PDF, PNG or JPEG, max 5 MB)" hint={hadFile && !file ? 'A file is already attached. Choose a new one only to replace it.' : ''}>
          <input className="field" type="file" accept="application/pdf,image/png,image/jpeg" onChange={pickFile} />
        </Field>
        <Field label="…or a verification link" hint="Many platforms give a public verification URL. Provide this and/or a file.">
          <input className="field" type="url" name="proofUrl" value={form.proofUrl} onChange={change} placeholder="https://" />
        </Field>
      </fieldset>

      <div className="sm:col-span-2"><Alert>{error}</Alert></div>
      <div className="sm:col-span-2 flex justify-end"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div>
    </form>
  );
}
