import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Award, LayoutDashboard, FileCheck, Users, LogOut, PlusCircle, Coins, BarChart3, ScrollText, UserCircle, Menu, X, Settings2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';
import ThemeToggle from './ThemeToggle';
import { label } from './ui';

const NAV = {
  STUDENT: [['/', 'Overview', LayoutDashboard], ['/submit', 'Submit certificate', PlusCircle], ['/certificates', 'My certificates', Award], ['/credits', 'My credits', Coins], ['/profile', 'Profile', UserCircle]],
  FACULTY: [['/', 'Overview', LayoutDashboard], ['/review', 'Verification queue', FileCheck], ['/profile', 'Profile', UserCircle]],
  ADMIN: [['/', 'Overview', LayoutDashboard], ['/review', 'Verification queue', FileCheck], ['/users', 'User management', Users], ['/policy', 'Credit policy', Settings2], ['/reports', 'Reports', BarChart3], ['/audit', 'Audit log', ScrollText], ['/profile', 'Profile', UserCircle]],
};
NAV.SUPER_ADMIN = NAV.ADMIN;

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const items = NAV[user?.role] || [];

  const sidebar = (
    <>
      <div className="flex items-center gap-3 mb-9">
        <div className="bg-blue-600 text-white rounded-xl p-2"><Award size={22} /></div>
        <div><div className="font-extrabold text-lg">CertTrack</div><div className="text-xs muted">Learning achievements</div></div>
      </div>
      <nav className="space-y-1" aria-label="Main">
        {items.map(([to, text, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenu(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon size={18} /> {text}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t pt-4">
        <div className="font-semibold text-sm">{user?.name}</div>
        <div className="text-xs muted mb-3">{label(user?.role)}</div>
        <button className="btn btn-secondary w-full" onClick={async () => { await logout(); nav('/login'); }}><LogOut size={16} /> Sign out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="hidden md:flex fixed inset-y-0 w-64 bg-white border-r border-slate-200 p-5 flex-col">{sidebar}</aside>
      {menu && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <aside className="w-72 max-w-[85%] bg-white p-5 flex flex-col">{sidebar}</aside>
          <button className="flex-1 bg-slate-900/40" aria-label="Close menu" onClick={() => setMenu(false)} />
        </div>
      )}
      <main className="md:ml-64 min-h-screen">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2 -ml-2" onClick={() => setMenu(!menu)} aria-label="Open menu">{menu ? <X /> : <Menu />}</button>
            <div className="font-semibold truncate">Online Certification &amp; Course Tracker</div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-sm muted">
            <span className="hidden sm:inline">{user?.department || 'Academic workspace'}</span>
            <ThemeToggle />
            <Notifications />
          </div>
        </header>
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}
