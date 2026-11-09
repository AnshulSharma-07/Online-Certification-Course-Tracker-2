import api from '../services/api';
import useLoad from '../hooks/useLoad';
import { Alert, Empty, PageHeader, Spinner, fmtDate } from '../components/ui';

export default function Credits() {
  const { data, error, loading } = useLoad(() => api.get('/certifications/credits').then((r) => r.data), []);
  const records = data?.records || [];
  return (
    <div>
      <PageHeader title="My academic credits" subtitle="Credits from approved and eligible certificates." />
      <Alert>{error}</Alert>
      <div className="card p-6 mb-5">
        <div className="muted text-sm">Total earned credits</div>
        <div className="text-4xl font-extrabold text-blue-700 mt-2">{data?.total ?? 0}</div>
      </div>
      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{['Course', 'Platform', 'Credits', 'Awarded'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {records.map((r) => (
                <tr className="border-t" key={r._id}>
                  <td className="td font-semibold">{r.certification?.title}</td><td className="td">{r.certification?.platform}</td>
                  <td className="td">{r.credits}</td><td className="td">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !records.length && <Empty>No credits awarded yet.</Empty>}
      </div>
    </div>
  );
}
