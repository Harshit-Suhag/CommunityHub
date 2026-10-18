import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { LocationMap } from '../components/LocationMap.jsx';

const SAVED_KEY = 'colonyhub_saved_rooms';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(() => loadSaved().includes(Number(id)));

  useEffect(() => {
    api
      .get(`/rooms/${id}`)
      .then((res) => setRoom(res.data.room))
      .catch(() => setError('Room not found'));
  }, [id]);

  const toggleSave = () => {
    const ids = loadSaved();
    const num = Number(id);
    const next = ids.includes(num) ? ids.filter((x) => x !== num) : [...ids, num];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(num));
  };

  if (error) return <p className="alert">{error}</p>;
  if (!room) return <p className="muted">Loading…</p>;

  return (
    <article className="detail">
      <div className="detail-img">
        {room.image_url ? <img src={room.image_url} alt={room.title} /> : <div className="placeholder tall">No photo</div>}
      </div>
      <div>
        <p className="eyebrow">{room.colony} · {room.room_type}</p>
        <h1>{room.title}</h1>
        <p className="price">₹{room.rent} / month</p>
        <p>{room.is_available ? 'Available' : 'Not available'}</p>
        <p>{room.description}</p>
        {room.latitude != null && room.longitude != null && (
          <section className="listing-location">
            <h2>Room location</h2>
            <LocationMap latitude={room.latitude} longitude={room.longitude} height={280} />
            <a
              href={`https://www.openstreetmap.org/?mlat=${room.latitude}&mlon=${room.longitude}#map=17/${room.latitude}/${room.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open larger map
            </a>
          </section>
        )}
        <div className="contact-box">
          <h3>Owner contact</h3>
          <p>{room.owner_name}</p>
          <p>{room.owner_phone || 'No phone listed'}</p>
          <p>{room.owner_email}</p>
        </div>
        {user?.role === 'tenant' && (
          <button className="btn" type="button" onClick={toggleSave}>
            {saved ? 'Remove from saved' : 'Save room'}
          </button>
        )}
      </div>
    </article>
  );
}
