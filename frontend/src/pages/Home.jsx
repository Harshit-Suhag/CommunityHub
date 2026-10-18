import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LocationLink from '../components/LocationLink.jsx';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [shops, setShops] = useState([]);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/rooms', { params: { available: true } }),
      api.get('/shops'),
      api.get('/slots', { params: { status: 'free' } }),
    ])
      .then(([r, s, sl]) => {
        setRooms((r.data.rooms || []).slice(0, 3));
        setShops((s.data.shops || []).slice(0, 3));
        setSlots((sl.data.slots || []).slice(0, 4));
      })
      .catch(() => setError('Could not load listings. Start the API and MySQL first.'));
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Gurgaon · Hyperlocal</p>
          <h1>Your colony, <span>closer than ever.</span></h1>
          <p className="lead">
            Find a room, check in with your local shops, or book a trusted service — all around Rajiv Colony and Hans Enclave.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/rooms">Explore your neighborhood <span aria-hidden="true">→</span></Link>
            <Link className="btn btn-ghost" to="/register">Join CommunityHub</Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="neighborhood-card">
            <div className="neighborhood-heading">
              <span className="neighborhood-pin">✳</span>
              <div>
                <strong>Right around you</strong>
                <span>Good things, close to home</span>
              </div>
            </div>
            <div className="neighborhood-list">
              <div><span className="neighborhood-number">01</span><span>Rooms to make your own</span><span className="neighborhood-arrow">↗</span></div>
              <div><span className="neighborhood-number">02</span><span>Shops for everyday needs</span><span className="neighborhood-arrow">↗</span></div>
              <div><span className="neighborhood-number">03</span><span>Local people who can help</span><span className="neighborhood-arrow">↗</span></div>
            </div>
            <div className="neighborhood-footer"><span className="pulse-dot" /> Rajiv Colony <span>·</span> Hans Enclave</div>
          </div>
        </div>
      </section>

      {error && <p className="alert">{error}</p>}

      <section className="section">
        <div className="section-head">
          <h2>Rooms</h2>
          <Link to="/rooms">See all</Link>
        </div>
        <div className="grid">
          {rooms.length === 0 && <p className="muted">No available rooms yet.</p>}
          {rooms.map((room) => (
            <div key={room.id} className="listing-card-wrap">
              <Link className="card" to={`/rooms/${room.id}`}>
                <div className="card-img">
                  {room.image_url ? (
                    <img src={room.image_url} alt={room.title} />
                  ) : (
                    <div className="placeholder">No photo</div>
                  )}
                </div>
                <h3>{room.title}</h3>
                <p>₹{room.rent} · {room.room_type} · {room.colony || 'Gurgaon'}</p>
              </Link>
              <LocationLink latitude={room.latitude} longitude={room.longitude} />
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Shops</h2>
          <Link to="/shops">See all</Link>
        </div>
        <div className="grid">
          {shops.length === 0 && <p className="muted">No shops listed yet.</p>}
          {shops.map((shop) => (
            <div key={shop.id} className="listing-card-wrap">
              <Link className="card" to={`/shops/${shop.id}`}>
                <h3>{shop.shop_name}</h3>
                <p className="badge">{shop.category}</p>
                <p>{shop.colony || 'Gurgaon'}</p>
              </Link>
              <LocationLink latitude={shop.latitude} longitude={shop.longitude} />
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Services</h2>
          <Link to="/services">See all</Link>
        </div>
        <div className="grid">
          {slots.length === 0 && <p className="muted">No free slots right now.</p>}
          {slots.map((slot) => (
            <div key={slot.id} className="listing-card-wrap">
              <Link className="card" to={`/services/${slot.provider_id}`}>
                <h3>{slot.provider_business_name || slot.provider_name}</h3>
                <p>{slot.service_type} · {new Date(slot.slot_time).toLocaleString()}</p>
                <span className="badge badge-green">free</span>
              </Link>
              <LocationLink latitude={slot.latitude} longitude={slot.longitude} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
