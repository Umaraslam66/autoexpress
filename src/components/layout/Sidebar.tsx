import { NavLink } from 'react-router-dom';
import { useAppState } from '../../context/AppState';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/queue', label: 'Pricing Queue' },
  { to: '/pricing-files', label: 'Pricing Files' },
  { to: '/admin', label: 'Admin' },
];

export function Sidebar() {
  const { activeUser, logout } = useAppState();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">AX</span>
        <div>
          <strong>AutoXpress</strong>
          <span>Pricing Intelligence</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div>
          <strong>{activeUser?.name}</strong>
          <span>{activeUser?.role === 'admin' ? 'Admin' : 'Pricing Manager'}</span>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            void logout();
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
