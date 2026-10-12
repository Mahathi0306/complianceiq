import { NavLink } from 'react-router-dom';
import { isStaff, useAuth } from '../auth.jsx';

const staffLinks = [
  ['/dashboard', 'Overview'],
  ['/alerts', 'Alerts'],
  ['/cases', 'Cases'],
  ['/applications', 'Applications'],
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const links = isStaff(user) ? staffLinks : [['/onboarding', 'My application']];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">ComplianceIQ</div>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{user.name}</div>
          <div className="role">{user.role.toLowerCase()}</div>
          <button className="link-button" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
