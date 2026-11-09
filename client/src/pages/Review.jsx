import { useEffect, useState } from 'react';
import { ExternalLink, FileText, History, AlertTriangle } from 'lucide-react';
import api, { openProof } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLoad from '../hooks/useLoad';
import { Alert, Empty, FLAG_TEXT, HistoryList, PageHeader, Pagination, Spinner, StatusPill, fmtDate } from '../components/ui';

function Card({ cert, isAdmin, faculty, onDone }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(null);
  const actionable = ['PENDING', 'UNDER_REVIEW'].includes(cert.status);

  const act = async (decision) => {
    setError('');
    setBusy(true);
    try { await api.patch(`/certifications/${cert._id}/review`, { decision, comment }); onDone(); } catch (e) { setError(e.message); setBusy(false); }
  };
  const assign = async (e) => {
    try { await api.patch(`/certifications/${cert._id}/assign`, { facultyId: e.target.value || null }); onDone(); } catch (err) { setError(err.message); }
  };
  const toggleHistory = async () => {
    setShowHistory(!showHistory);
    if (!history) { try { setHistory((await api.get(`/certifications/${cert._id}`)).data.certification.history); } catch (e) { setError(e.message); } }
  };
  const view = async () => { try { await openProof(cert._id); } catch (e) { setError(e.message); } };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-bold text-lg">{cert.title}</h2>
          <p className="muted text-sm">{cert.student?.name} · {cert.student?.email} · {cert.student?.department || 'No department'}{cert.student?.rollNumber ? ` · ${cert.student.rollNumber}` : ''}</p>
        </div>
        <div className="text-right"><StatusPill status={cert.status} /><div className="text-xs muted mt-1">Submitted {fmtDate(cert.createdAt)}</div></div>
      </div>

      {cert.flags?.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 text-sm p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div><div className="font-semibold">Check carefully</div>{cert.flags.map((f) => <div key={f}>{FLAG_TEXT[f] || f}</div>)}</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm mt-4">
        {[['Platform', cert.platform], ['Duration', `${cert.durationWeeks} weeks`], ['Score', cert.assessmentScore ?? 'Not provided'], ['Certificate ID', cert.certificateId || '—'], ['Issued', fmtDate(cert.issueDate)]].map(([k, v]) => (
          <div key={k}><span className="muted">{k}</span><div className="font-semibold break-words">{v}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {cert.proofFile && <button className="btn btn-secondary btn-sm" onClick={view}><FileText size={14} /> View uploaded file</button>}
        {cert.proofUrl && <a className="btn btn-secondary btn-sm" href={cert.proofUrl} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open proof link</a>}
        <button className="btn btn-secondary btn-sm" onClick={toggleHistory}><History size={14} /> History</button>
        {isAdmin && cert.status !== 'APPROVED' && cert.status !== 'REJECTED' && (
          <label className="text-sm flex items-center gap-2 ml-auto">Assigned to
            <select className="field !w-auto !py-1.5" value={cert.assignedTo?._id || ''} onChange={assign}>
              <option value="">Department pool</option>
              {faculty.map((f) => <option key={f._id} value={f._id}>{f.name}{f.department ? ` (${f.department})` : ''}</option>)}
            </select>
          </label>
        )}
        {!isAdmin && cert.assignedTo?.name && <span className="text-xs muted ml-auto">Assigned to {cert.assignedTo.name}</span>}
      </div>
      {showHistory && <div className="mt-4">{history ? <HistoryList history={history} /> : <p className="muted text-sm">Loading…</p>}</div>}

      {actionable ? (
        <>
          <textarea className="field mt-4" rows="2" maxLength={1000} placeholder="Feedback to the student (required to reject or request a correction)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Reviewer feedback" />
          <div className="flex flex-wrap gap-2 mt-3">
            {cert.status === 'PENDING' && <button disabled={busy} className="btn btn-secondary" onClick={() => act('review')}>Mark under review</button>}
            <button disabled={busy} className="btn btn-primary" onClick={() => act('approve')}>Approve</button>
            <button disabled={busy} className="btn btn-danger" onClick={() => act('reject')}>Reject</button>
            <button disabled={busy} className="btn btn-secondary" onClick={() => act('correction')}>Request correction</button>
          </div>
        </>
      ) : (
        <div className="mt-4 text-sm">
          {cert.facultyComment && <p><span className="muted">Feedback:</span> {cert.facultyComment}</p>}
          {cert.status === 'APPROVED' && <p className="mt-1"><span className="muted">Credits awarded:</span> <b>{cert.creditsAwarded}</b>{cert.creditNote ? <span className="text-amber-700"> · {cert.creditNote}</span> : null}</p>}
          {cert.status === 'CORRECTION_REQUIRED' && <p className="muted mt-1">Waiting for the student to correct and resubmit.</p>}
        </div>
      )}
      <div className="mt-3"><Alert>{error}</Alert></div>
    </div>
  );
}

export default function Review() {
  const { user } = useAuth();
  const isAdmin = user.role !== 'FACULTY';
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const [assignedFilter, setAssignedFilter] = useState('');
  const { data, error, loading, reload } = useLoad(
    () => api.get('/certifications/review-queue', { params: { tab, page, ...(assignedFilter ? { assignedTo: assignedFilter } : {}) } }).then((r) => r.data),
    [tab, page, assignedFilter]
  );
  const [faculty, setFaculty] = useState([]);
  useEffect(() => { if (isAdmin) api.get('/admin/faculty').then((r) => setFaculty(r.data.faculty)).catch(() => {}); }, [isAdmin]);

  const counts = data?.counts || {};
  const tabs = [['open', 'To review', counts.open], ['correction', 'Awaiting student', counts.correction], ['reviewed', isAdmin ? 'Finalized' : 'Reviewed by me', counts.reviewed]];

  return (
    <div>
      <PageHeader title="Verification queue" subtitle="Review student submissions and record a decision." />
      <div className="flex flex-wrap items-center gap-2 mb-5" role="tablist">
        {tabs.map(([k, text, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'tab-active' : ''}`} onClick={() => { setTab(k); setPage(1); }}>{text}{n != null ? ` (${n})` : ''}</button>
        ))}
        {isAdmin && (
          <select className="field !w-auto !py-1.5 ml-auto" value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }} aria-label="Filter by assignee">
            <option value="">All assignees</option><option value="unassigned">Department pool</option>
            {faculty.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        )}
      </div>
      <Alert>{error}</Alert>
      {loading && !data ? <Spinner /> : (
        <div className="space-y-4">
          {(data?.certifications || []).map((c) => <Card key={c._id} cert={c} isAdmin={isAdmin} faculty={faculty} onDone={reload} />)}
          {!data?.certifications?.length && <div className="card"><Empty>{tab === 'open' ? 'No submissions are waiting for review.' : 'Nothing here yet.'}</Empty></div>}
          <Pagination page={data?.page || 1} pages={data?.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
