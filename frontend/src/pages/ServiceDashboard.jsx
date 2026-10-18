import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { LocationMap } from '../components/LocationMap.jsx';

function formatDateTimeInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function ServiceDashboard() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [profile, setProfile] = useState({
    business_name: '',
    latitude: '',
    longitude: '',
  });
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [form, setForm] = useState({
    service_type: 'barber',
    slot_time: '',
    status: 'free',
  });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get(`/slots/${user.id}`);
      setSlots(res.data.slots || []);
      setProfile({
        business_name: res.data.provider.business_name || '',
        latitude: res.data.provider.latitude ?? '',
        longitude: res.data.provider.longitude ?? '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load service slots');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const res = await api.put('/slots/profile', profile);
      setProfile(res.data.profile);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save provider profile');
    }
  };

  useEffect(() => {
    load();
  }, [user.id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const mysqlDateTime = new Date(form.slot_time)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      const slot = { ...form, slot_time: mysqlDateTime };
      if (editingSlotId) {
        await api.put(`/slots/${editingSlotId}`, slot);
      } else {
        await api.post('/slots', slot);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save service slot');
    }
  };

  const resetForm = () => {
    setForm({ service_type: 'barber', slot_time: '', status: 'free' });
    setEditingSlotId(null);
  };

  const edit = (slot) => {
    setEditingSlotId(slot.id);
    setForm({
      service_type: slot.service_type,
      slot_time: formatDateTimeInput(slot.slot_time),
      status: slot.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = async (slot) => {
    const next = slot.status === 'free' ? 'busy' : 'free';
    setError('');
    try {
      await api.put(`/slots/${slot.id}`, { status: next });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update slot status');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this slot?')) return;
    setError('');
    try {
      await api.delete(`/slots/${id}`);
      if (editingSlotId === id) resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete service slot');
    }
  };

  return (
    <div>
      <h1>Service dashboard</h1>
      <p className="muted">Add service slots, edit their schedule, change availability, or delete them.</p>
      {error && <p className="alert">{error}</p>}

      <form className="form wide" onSubmit={saveProfile}>
        <h2>Provider profile</h2>
        <label>
          Business or service name
          <input
            value={profile.business_name}
            onChange={(event) => setProfile({ ...profile, business_name: event.target.value })}
            maxLength={150}
            required
          />
        </label>
        <label>Service location on map</label>
        <LocationMap
          latitude={profile.latitude}
          longitude={profile.longitude}
          onChange={({ latitude, longitude }) => setProfile((current) => ({ ...current, latitude, longitude }))}
        />
        <button className="btn" type="submit">Save provider profile</button>
      </form>

      <form className="form wide" onSubmit={onSubmit}>
        <h2>{editingSlotId ? 'Edit slot' : 'Add slot'}</h2>
        <label>
          Type
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
          >
            <option value="barber">Barber</option>
            <option value="carpenter">Carpenter</option>
            <option value="mechanic">Mechanic</option>
          </select>
        </label>
        <label>
          Date and time
          <input
            type="datetime-local"
            value={form.slot_time}
            onChange={(e) => setForm({ ...form, slot_time: e.target.value })}
            required
          />
        </label>
        <div className="row">
          <button className="btn" type="submit">
            {editingSlotId ? 'Save changes' : 'Add slot'}
          </button>
          {editingSlotId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {slots.length === 0 && <li className="muted">No slots yet.</li>}
        {slots.map((slot) => (
          <li key={slot.id} className="list-row">
            <span>
              {slot.service_type} · {new Date(slot.slot_time).toLocaleString()}
            </span>
            <div className="row">
              <button className="btn btn-small btn-ghost" type="button" onClick={() => edit(slot)}>
                Edit
              </button>
              <button
                className={slot.status === 'free' ? 'toggle-free' : 'toggle-busy'}
                type="button"
                onClick={() => toggle(slot)}
              >
                {slot.status === 'free' ? 'Free' : 'Busy'}
              </button>
              <button className="btn btn-small btn-danger" type="button" onClick={() => remove(slot.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
