import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', role: '' });
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { email: form.email, password: form.password };
      if (form.role) payload.role = form.role;
      const res = await api.post('/auth/login', payload);
      login(res.data.token, res.data.user);
      navigate(`/dashboard/${res.data.user.role}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <h1>Login</h1>
      {error && <p className="alert">{error}</p>}
      <label>
        Email
        <input name="email" type="email" value={form.email} onChange={onChange} required />
      </label>
      <label>
        Password
        <input name="password" type="password" value={form.password} onChange={onChange} required />
      </label>
      <label>
        Sign in as (optional)
        <select name="role" value={form.role} onChange={onChange}>
          <option value="">Default role</option>
          <option value="tenant">Tenant</option>
          <option value="owner">Room owner</option>
          <option value="shop">Shop</option>
          <option value="service">Service provider</option>
        </select>
      </label>
      <button className="btn" type="submit">Login</button>
      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </form>
  );
}
