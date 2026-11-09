import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 20000,
});

// Normalise errors to Error(message) and tell the app when a session has expired.
api.interceptors.response.use(
  (r) => r,
  async (e) => {
    let message = e.response?.data?.message;
    // Blob responses (proof downloads) carry their JSON error as a Blob.
    if (!message && e.response?.data instanceof Blob) {
      try { message = JSON.parse(await e.response.data.text()).message; } catch { /* ignore */ }
    }
    const url = e.config?.url || '';
    if (e.response?.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
    const err = new Error(message || (e.code === 'ECONNABORTED' ? 'The request timed out' : e.response ? 'Request failed' : 'Cannot reach the server'));
    err.status = e.response?.status;
    return Promise.reject(err);
  }
);

/** Opens an uploaded proof file. Access is authenticated, so it is fetched as a blob first. */
export async function openProof(certId) {
  const win = window.open('', '_blank'); // open synchronously so popup blockers allow it
  try {
    const r = await api.get(`/certifications/${certId}/proof`, { responseType: 'blob' });
    let href;
    if (r.data.type.includes('application/json')) href = JSON.parse(await r.data.text()).url; // Cloudinary signed URL
    else href = URL.createObjectURL(r.data);
    if (win) { win.opener = null; win.location.href = href; }
  } catch (err) {
    win?.close();
    throw err;
  }
}

export async function downloadFile(path, filename) {
  const r = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default api;
