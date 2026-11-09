import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CertificateForm from '../components/CertificateForm';

export default function Submit() {
  const nav = useNavigate();
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="text-sm text-blue-700 font-bold">STUDENT PORTAL</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">Submit a certificate</h1>
        <p className="muted mt-1">Enter the course details and attach your certificate for faculty verification.</p>
      </div>
      <CertificateForm submitLabel="Submit for verification" onSubmit={async (data) => { await api.post('/certifications', data); nav('/certificates'); }} />
    </div>
  );
}
