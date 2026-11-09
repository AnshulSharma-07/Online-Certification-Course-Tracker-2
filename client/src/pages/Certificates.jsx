import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api, { openProof } from '../services/api';
import useLoad from '../hooks/useLoad';
import CertificateForm from '../components/CertificateForm';
import { Alert, Empty, HistoryList, PageHeader, Spinner, StatusPill, fmtDate } from '../components/ui';

function Row({ cert, onChanged }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const toggle = async () => {
    setOpen(!open);
    if (!open && !detail) {
      try { setDetail((await api.get(`/certifications/${cert._id}`)).data.certification); } catch (e) { setError(e.message); }
    }
  };
  const withdraw = async () => {
    if (!window.confirm(`Withdraw “${cert.title}”? This cannot be undone.`)) return;
    try { await api.delete(`/certifications/${cert._id}`); onChanged(); } catch (e) { setError(e.message); }
  };
  const view = async () => { try { await openProof(cert._id); } catch (e) { setError(e.message); } };
  const canWithdraw = ['PENDING', 'CORRECTION_REQUIRED'].includes(cert.status);

  return (
    <>
      <tr className="border-t hover:bg-slate-50/50">
        <td className="td"><button className="font-semibold text-left flex items-center gap-1" onClick={toggle} aria-expanded={open}>{cert.title}{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button><div className="text-xs muted">{fmtDate(cert.createdAt)}</div></td>
        <td className="td">{cert.platform}</td>
        <td className="td whitespace-nowrap">{cert.durationWeeks} weeks</td>
        <td className="td"><StatusPill status={cert.status} /></td>
        <td className="td">{cert.creditsAwarded || 0}</td>
        <td className="td max-w-xs">{cert.facultyComment || '—'}{cert.status === 'APPROVED' && cert.creditNote && <div className="text-xs text-amber-700 mt-1">{cert.creditNote}</div>}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan="6" className="p-5">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {cert.proofFile && <button className="btn btn-secondary btn-sm" onClick={view}><FileText size={14} /> View uploaded file</button>}
                  {cert.proofUrl && <a className="btn btn-secondary btn-sm" href={cert.proofUrl} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open proof link</a>}
                  {cert.status === 'CORRECTION_REQUIRED' && <button className="btn btn-primary btn-sm" onClick={() => setEditing(!editing)}><Pencil size={14} /> {editing ? 'Cancel edit' : 'Edit & resubmit'}</button>}
                  {canWithdraw && <button className="btn btn-danger btn-sm" onClick={withdraw}><Trash2 size={14} /> Withdraw</button>}
                </div>
                <dl className="text-sm grid grid-cols-2 gap-2">
                  <dt className="muted">Certificate ID</dt><dd>{cert.certificateId || '—'}</dd>
                  <dt className="muted">Score</dt><dd>{cert.assessmentScore ?? '—'}</dd>
                  <dt className="muted">Assigned to</dt><dd>{cert.assignedTo?.name || 'Department pool'}</dd>
                </dl>
                <Alert>{error}</Alert>
              </div>
              <div><h3 className="font-bold text-sm mb-3">Timeline</h3>{detail ? <HistoryList history={detail.history} /> : <p className="muted text-sm">Loading…</p>}</div>
            </div>
            {editing && (
              <div className="mt-6">
                <CertificateForm initial={cert} submitLabel="Resubmit for verification" onSubmit={async (data) => { await api.put(`/certifications/${cert._id}`, data); setEditing(false); setOpen(false); setDetail(null); onChanged(); }} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function Certificates() {
  const { data, error, loading, reload } = useLoad(() => api.get('/certifications/my').then((r) => r.data.certifications), []);
  const items = data || [];
  return (
    <div>
      <PageHeader title="My certificates" subtitle="Track submitted certificates and faculty feedback.">
        <Link to="/submit" className="btn btn-primary">Submit new</Link>
      </PageHeader>
      <Alert>{error}</Alert>
      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50"><tr>{['Certificate', 'Platform', 'Duration', 'Status', 'Credits', 'Feedback'].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
            <tbody>{items.map((c) => <Row key={c._id} cert={c} onChanged={reload} />)}</tbody>
          </table>
        )}
        {!loading && !items.length && <Empty>No certificates submitted yet.</Empty>}
      </div>
    </div>
  );
}
