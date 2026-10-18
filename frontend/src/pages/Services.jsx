import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LocationLink from '../components/LocationLink.jsx';

export default function Services() {
  const [slots, setSlots] = useState([]);
  const [type, setType] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = {};
    if (type) params.type = type;
    api
      .get('/slots', { params })
      .then((res) => setSlots(res.data.slots || []))
      .catch(() => setError('Failed to load services'));
  }, [type]);

  const providers = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      if (!map.has(slot.provider_id)) {
        map.set(slot.provider_id, {
          id: slot.provider_id,
          name: slot.provider_name,
          business_name: slot.provider_business_name,
          colony: slot.colony,
          service_type: slot.service_type,
          phone: slot.provider_phone,
          latitude: slot.latitude,
          longitude: slot.longitude,
          freeCount: 0,
        });
      }
      if (slot.status === 'free') {
        map.get(slot.provider_id).freeCount += 1;
      }
    });
    return Array.from(map.values());
  }, [slots]);

  return (
    <div>
      <div className="section-head">
        <h1>Service providers</h1>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="barber">Barber</option>
          <option value="carpenter">Carpenter</option>
          <option value="mechanic">Mechanic</option>
        </select>
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="grid">
        {providers.length === 0 && <p className="muted">No providers with slots yet.</p>}
        {providers.map((p) => (
          <div key={p.id} className="listing-card-wrap">
            <Link className="card" to={`/services/${p.id}`}>
              <h3>{p.business_name || p.name}</h3>
              {p.business_name && <p>{p.name}</p>}
              <p>{p.service_type} · {p.colony}</p>
              <p>{p.freeCount} free slot(s)</p>
            </Link>
            <LocationLink latitude={p.latitude} longitude={p.longitude} />
          </div>
        ))}
      </div>
    </div>
  );
}
