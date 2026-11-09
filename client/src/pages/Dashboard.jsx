import { Award, Clock, CheckCircle, Coins, XCircle, ArrowUpRight, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLoad from '../hooks/useLoad';
import { Alert, StatusPill, fmtDate, label } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, error } = useLoad(() => api.get('/certifications/dashboard').then((r) => r.data), []);
  const isStudent = user?.role === 'STUDENT';
  const v = (x) => x ?? '—';

  const cards = isStudent
    ? [['Certificates submitted', v(stats?.total), Award], ['Awaiting review', v(stats?.pending), Clock], ['Approved', v(stats?.approved), CheckCircle], ['Credits earned', v(stats?.credits), Coins]]
    : [['Total submissions', v(stats?.total), Award], ['Awaiting your review', v(stats?.pending), Clock], ['Approved', v(stats?.approved), CheckCircle], ['Rejected', v(stats?.rejected), XCircle]];

  const links = isStudent
    ? [['Submit a certificate', 'Add course details and proof.', '/submit'], ['Track verification', 'See faculty decisions and feedback.', '/certificates']]
    : [['Review submissions', 'Open the verification queue.', '/review'], ...(user?.role === 'FACULTY' ? [['Update your profile', 'Keep your department up to date so students are routed to you.', '/profile']] : [['Credit policy', 'Check the configured credit policy.', '/policy']])];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-blue-700 font-bold">WORKSPACE OVERVIEW</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">Good to see you, {user?.name?.split(' ')[0]}</h1>
          <p className="muted mt-1">Here is the latest activity in your certification tracker.</p>
        </div>
        {isStudent && <Link to="/submit" className="btn btn-primary"><ArrowUpRight size={17} /> Submit certificate</Link>}
      </div>
      <Alert>{error}</Alert>
      {isStudent && stats?.needsCorrection > 0 && (
        <Link to="/certificates" className="flex items-center gap-3 rounded-xl bg-orange-50 text-orange-900 p-4 text-sm font-semibold">
          <AlertTriangle size={18} /> {stats.needsCorrection} submission{stats.needsCorrection > 1 ? 's need' : ' needs'} your correction. Review the feedback →
        </Link>
      )}
      {!isStudent && stats?.myReviewed != null && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 text-blue-900 p-4 text-sm"><ClipboardCheck size={18} /> You have reviewed {stats.myReviewed} submission{stats.myReviewed === 1 ? '' : 's'} so far.</div>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(([text, value, Icon]) => (
          <div className="card p-5" key={text}>
            <div className="flex justify-between"><span className="text-sm muted">{text}</span><span className="bg-blue-50 text-blue-700 p-2 rounded-xl"><Icon size={19} /></span></div>
            <div className="text-3xl font-extrabold mt-4">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card p-6 lg:col-span-2">
          {isStudent && stats?.recent?.length > 0 ? (
            <>
              <h2 className="font-bold text-lg mb-3">Recent submissions</h2>
              <ul className="divide-y">
                {stats.recent.map((c) => (
                  <li key={c._id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div><div className="font-semibold">{c.title}</div><div className="text-xs muted">{c.platform} · {fmtDate(c.createdAt)}</div></div>
                    <div className="flex items-center gap-3">{c.creditsAwarded > 0 && <span className="text-sm font-semibold text-blue-700">+{c.creditsAwarded} cr</span>}<StatusPill status={c.status} /></div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="font-bold text-lg">Getting started</h2>
              <p className="muted text-sm mt-1">Use your workspace to manage verified learning achievements.</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {links.map(([t, d, u]) => (
                  <Link to={u} key={t} className="rounded-xl border p-4 hover:border-blue-300">
                    <div className="font-semibold">{t}</div><p className="muted text-sm mt-1">{d}</p><span className="text-blue-700 text-sm font-semibold inline-block mt-3">Open →</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card p-6">
          <h2 className="font-bold">Account role</h2>
          <div className="text-2xl font-extrabold text-blue-700 mt-3">{label(user?.role)}</div>
          <p className="muted text-sm mt-2">Your permissions and available workspace tools are based on this role.</p>
        </div>
      </div>
    </div>
  );
}
