import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Laxmi Narasimha<br />Traders
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/new-bill">New Bill</NavLink>
          <NavLink to="/pending-bills">Pending Bills</NavLink>
          <NavLink to="/approved-bills">Approved Bills</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          {isAdmin && <NavLink to="/products">Products</NavLink>}
          {isAdmin && <NavLink to="/settings">Settings</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="username">{user?.name}</div>
          <div className="role-badge">{user?.role}</div>
          <button className="btn btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
