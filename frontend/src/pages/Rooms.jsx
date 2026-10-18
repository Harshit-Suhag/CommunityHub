import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LocationLink from '../components/LocationLink.jsx';

const COLONIES = ['', 'Rajiv Colony', 'Hans Enclave'];

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [colony, setColony] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = { available: true };
    if (colony) params.colony = colony;
    api
      .get('/rooms', { params })
      .then((res) => setRooms(res.data.rooms || []))
      .catch(() => setError('Failed to load rooms'));
  }, [colony]);

  return (
    <div>
      <div className="section-head">
        <h1>Available rooms</h1>
        <select value={colony} onChange={(e) => setColony(e.target.value)}>
          {COLONIES.map((c) => (
            <option key={c || 'all'} value={c}>
              {c || 'All colonies'}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="grid">
        {rooms.length === 0 && <p className="muted">No rooms match this filter.</p>}
        {rooms.map((room) => (
          <div key={room.id} className="listing-card-wrap">
            <Link className="card" to={`/rooms/${room.id}`}>
              <div className="card-img">
                {room.image_url ? <img src={room.image_url} alt={room.title} /> : <div className="placeholder">No photo</div>}
              </div>
              <h3>{room.title}</h3>
              <p>₹{room.rent} / month</p>
              <p>{room.room_type} · {room.colony}</p>
            </Link>
            <LocationLink latitude={room.latitude} longitude={room.longitude} />
          </div>
        ))}
      </div>
    </div>
  );
}
