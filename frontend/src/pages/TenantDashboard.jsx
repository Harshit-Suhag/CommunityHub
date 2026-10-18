import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function TenantDashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    let ids = [];
    try {
      ids = JSON.parse(localStorage.getItem('colonyhub_saved_rooms') || '[]');
    } catch {
      ids = [];
    }
    if (!ids.length) {
      setRooms([]);
      return;
    }
    Promise.all(ids.map((id) => api.get(`/rooms/${id}`).then((r) => r.data.room).catch(() => null)))
      .then((list) => setRooms(list.filter(Boolean)));
  }, []);

  return (
    <div>
      <h1>Tenant profile</h1>
      <div className="contact-box">
        <p><strong>{user.name}</strong></p>
        <p>{user.email}</p>
        <p>{user.phone}</p>
        <p>{user.colony}</p>
      </div>
      <h2>Saved rooms</h2>
      <div className="grid">
        {rooms.length === 0 && <p className="muted">No saved rooms. Open a listing and tap Save room.</p>}
        {rooms.map((room) => (
          <Link key={room.id} className="card" to={`/rooms/${room.id}`}>
            <h3>{room.title}</h3>
            <p>₹{room.rent} · {room.colony}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
