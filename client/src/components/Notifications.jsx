import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { fmtDateTime } from './ui';

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const nav = useNavigate();

  const load = useCallback(() => api.get('/notifications').then((r) => { setItems(r.data.notifications); setUnread(r.data.unread); }).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const click = async (n) => {
    if (!n.readAt) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); load(); }
    setOpen(false);
    if (n.link) nav(n.link);
  };
  const markAll = async () => { await api.patch('/notifications/read-all').catch(() => {}); load(); };

  return (
    <div className="relative" ref={ref}>
      <button className="relative p-2 rounded-lg hover:bg-slate-100" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card shadow-xl z-30">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-bold text-sm">Notifications</span>
            {unread > 0 && <button className="text-xs text-blue-700 font-semibold" onClick={markAll}>Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y">
            {items.map((n) => (
              <li key={n._id}>
                <button className={`w-full text-left p-3 hover:bg-slate-50 ${n.readAt ? '' : 'bg-blue-50/60'}`} onClick={() => click(n)}>
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-sm text-slate-600 line-clamp-2">{n.message}</div>
                  <div className="text-xs muted mt-1">{fmtDateTime(n.createdAt)}</div>
                </button>
              </li>
            ))}
            {!items.length && <li className="p-6 text-center text-sm muted">You're all caught up.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
