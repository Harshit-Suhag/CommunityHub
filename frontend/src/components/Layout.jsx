import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [roleError, setRoleError] = useState('');
  const dashboardPath = user ? `/dashboard/${user.role}` : '/login';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRoleChange = async (event) => {
    const role = event.target.value;
    setRoleError('');
    try {
      const nextUser = await switchRole(role);
      navigate(`/dashboard/${nextUser.role}`);
    } catch (err) {
      setRoleError(err.response?.data?.message || 'Could not switch role');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          <span className="brand-mark">CH</span>
          CommunityHub
        </Link>
        <nav className="nav">
          <NavLink to="/rooms">Rooms</NavLink>
          <NavLink to="/shops">Shops</NavLink>
          <NavLink to="/services">Services</NavLink>
          {user && (
            <NavLink to={dashboardPath}>Dashboard</NavLink>
          )}
          {!user && <NavLink to="/login">Login</NavLink>}
          {!user && <NavLink to="/register">Register</NavLink>}
          {user && (
            <button className="link-btn" type="button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </nav>
      </header>
      {user && (
        <div className="user-bar">
          <span>Signed in as <strong>{user.name}</strong>{user.colony ? ` · ${user.colony}` : ''}</span>
          {user.roles?.length > 1 && (
            <label className="role-switch">
              Active role
              <select value={user.role} onChange={handleRoleChange} aria-label="Switch active role">
                {user.roles.map((role) => (
                  <option key={role} value={role}>{role === 'owner' ? 'Room owner' : role === 'service' ? 'Service provider' : role}</option>
                ))}
              </select>
            </label>
          )}
          {roleError && <span className="role-switch-error" role="alert">{roleError}</span>}
        </div>
      )}
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        CommunityHub for Rajiv Colony & Hans Enclave, Gurgaon, Haryana
      </footer>
    </div>
  );
}
