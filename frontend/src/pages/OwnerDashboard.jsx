import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { LocationMap } from '../components/LocationMap.jsx';

const emptyForm = {
  title: '',
  description: '',
  rent: '',
  room_type: '1BHK',
  is_available: 'true',
  image: null,
  latitude: '',
  longitude: '',
};

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/rooms');
      setRooms((res.data.rooms || []).filter((r) => r.owner_id === user.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rooms');
    }
  };

  useEffect(() => {
    load();
  }, [user.id]);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setForm({ ...form, image: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const data = new FormData();
    data.append('title', form.title);
    data.append('description', form.description);
    data.append('rent', form.rent);
    data.append('room_type', form.room_type);
    data.append('is_available', form.is_available);
    data.append('latitude', form.latitude);
    data.append('longitude', form.longitude);
    if (form.image) data.append('image', form.image);

    try {
      if (editingId) {
        await api.put(`/rooms/${editingId}`, data);
      } else {
        await api.post('/rooms', data);
      }
      reset();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  };

  const startEdit = (room) => {
    setEditingId(room.id);
    setError('');
    setForm({
      title: room.title,
      description: room.description || '',
      rent: String(room.rent),
      room_type: room.room_type,
      is_available: room.is_available ? 'true' : 'false',
      image: null,
      latitude: room.latitude ?? '',
      longitude: room.longitude ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAvailable = async (room) => {
    const data = new FormData();
    data.append('is_available', room.is_available ? 'false' : 'true');
    setError('');
    try {
      await api.put(`/rooms/${room.id}`, data);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update room availability');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this room?')) return;
    setError('');
    try {
      await api.delete(`/rooms/${id}`);
      if (editingId === id) reset();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete room');
    }
  };

  return (
    <div>
      <h1>Owner dashboard</h1>
      <p className="muted">Manage rooms you listed in {user.colony || 'your colony'}.</p>
      {error && <p className="alert">{error}</p>}

      <form className="form wide" onSubmit={onSubmit}>
        <h2>{editingId ? 'Edit room' : 'Add room'}</h2>
        <label>
          Title
          <input name="title" value={form.title} onChange={onChange} required />
        </label>
        <label>
          Description
          <textarea name="description" value={form.description} onChange={onChange} />
        </label>
        <label>
          Rent (₹)
          <input name="rent" type="number" min="0" value={form.rent} onChange={onChange} required />
        </label>
        <label>
          Type
          <select name="room_type" value={form.room_type} onChange={onChange}>
            <option value="1BHK">1BHK</option>
            <option value="2BHK">2BHK</option>
            <option value="single">Single</option>
            <option value="pg">PG</option>
          </select>
        </label>
        <label>
          Available
          <select name="is_available" value={form.is_available} onChange={onChange}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          Image
          <input name="image" type="file" accept="image/*" onChange={onChange} />
        </label>
        <label>Room location on map</label>
        <LocationMap
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude }))}
        />
        <div className="row">
          <button className="btn" type="submit">{editingId ? 'Update' : 'Create'}</button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {rooms.length === 0 && <li className="muted">You have not listed any rooms.</li>}
        {rooms.map((room) => (
          <li key={room.id} className="list-row">
            <div>
              <strong>{room.title}</strong>
              <p>₹{room.rent} · {room.room_type} · {room.is_available ? 'available' : 'unavailable'}</p>
            </div>
            <div className="row">
              <button className="btn btn-small" type="button" onClick={() => toggleAvailable(room)}>
                Toggle available
              </button>
              <button className="btn btn-small btn-ghost" type="button" onClick={() => startEdit(room)}>
                Edit
              </button>
              <button className="btn btn-small btn-danger" type="button" onClick={() => remove(room.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
