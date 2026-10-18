import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    colony: 'Rajiv Colony',
    business_name: '',
  });
  const [roles, setRoles] = useState(['tenant']);
  const [error, setError] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleRole = (role) => {
    setRoles((current) => current.includes(role)
      ? current.filter((value) => value !== role)
      : [...current, role]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!roles.length) {
      setError('Select at least one role');
      return;
    }
    try {
      const res = await api.post('/auth/register', { ...form, roles });
      login(res.data.token, res.data.user);
      navigate(`/dashboard/${res.data.user.role}`);
    } catch (err) {
      const response = err.response?.data;
      const details = response?.errors
        ?.map(({ path, param, msg }) => `${path || param || 'Input'}: ${msg}`)
        .join('; ');
      setError(details
        ? `${response.message}: ${details}`
        : response?.message || 'Registration failed');
    }
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <h1>Register</h1>
      {error && <p className="alert">{error}</p>}
      <label>
        Name
        <input name="name" value={form.name} onChange={onChange} required />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          pattern=".+\.(com|in|edu)"
          title="Use an email address ending in .com, .in, or .edu"
          required
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={onChange}
          minLength={8}
          pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}"
          title="Use at least 8 characters, including one uppercase letter and one special character"
          required
        />
        <span className="muted">At least 8 characters, one uppercase letter, and one special character.</span>
      </label>
      <fieldset className="role-options">
        <legend>What would you like to do?</legend>
        {[
          ['tenant', 'Find a room (Tenant)'],
          ['owner', 'List a room (Room owner)'],
          ['shop', 'Manage a shop'],
          ['service', 'Offer a service'],
        ].map(([role, label]) => (
          <label key={role} className="role-option">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => toggleRole(role)}
            />
            {label}
          </label>
        ))}
        <span className="muted">You can select more than one role.</span>
      </fieldset>
      {roles.includes('service') && (
        <label>
          Service business name
          <input
            name="business_name"
            value={form.business_name}
            onChange={onChange}
            maxLength={150}
            placeholder="For example, Sharma Home Services"
          />
        </label>
      )}
      <label>
        Mobile number
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={onChange}
          pattern="[0-9]{10}"
          maxLength={10}
          title="Enter exactly 10 digits"
          required
        />
      </label>
      <label>
        Colony
        <select name="colony" value={form.colony} onChange={onChange}>
          <option value="Rajiv Colony">Rajiv Colony</option>
          <option value="Hans Enclave">Hans Enclave</option>
        </select>
      </label>
      <button className="btn" type="submit">Create account</button>
      <p className="muted">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}
