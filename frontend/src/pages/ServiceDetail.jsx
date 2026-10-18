import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { LocationMap } from '../components/LocationMap.jsx';

export default function ServiceDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/slots/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load provider details'));
  }, [id]);

  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { provider, slots } = data;

  return (
    <div>
      <p className="eyebrow">{provider.colony}</p>
      <h1>{provider.business_name || provider.name}</h1>
      {provider.business_name && <p>Service provider: {provider.name}</p>}
      <p>{provider.phone || 'No phone'} · {provider.email}</p>
      {provider.latitude != null && provider.longitude != null && (
        <section className="listing-location">
          <h2>Service location</h2>
          <LocationMap latitude={provider.latitude} longitude={provider.longitude} height={280} />
          <a
            href={`https://www.openstreetmap.org/?mlat=${provider.latitude}&mlon=${provider.longitude}#map=17/${provider.latitude}/${provider.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Open larger map
          </a>
        </section>
      )}
      <h2>Slots</h2>
      <ul className="list">
        {slots.length === 0 && <li className="muted">No slots posted.</li>}
        {slots.map((slot) => (
          <li key={slot.id} className="list-row">
            <span>
              {slot.service_type} · {new Date(slot.slot_time).toLocaleString()}
            </span>
            <span className={slot.status === 'free' ? 'badge badge-green' : 'badge badge-red'}>
              {slot.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
