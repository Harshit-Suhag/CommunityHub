import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LocationLink from '../components/LocationLink.jsx';

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [colony, setColony] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = {};
    if (colony) params.colony = colony;
    if (category) params.category = category;
    api
      .get('/shops', { params })
      .then((res) => setShops(res.data.shops || []))
      .catch(() => setError('Failed to load shops'));
  }, [colony, category]);

  return (
    <div>
      <div className="section-head">
        <h1>Colony shops</h1>
        <div className="filters">
          <select value={colony} onChange={(e) => setColony(e.target.value)}>
            <option value="">All colonies</option>
            <option value="Rajiv Colony">Rajiv Colony</option>
            <option value="Hans Enclave">Hans Enclave</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="grocery">Grocery</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="grid">
        {shops.length === 0 && <p className="muted">No shops found.</p>}
        {shops.map((shop) => (
          <div key={shop.id} className="listing-card-wrap">
            <Link className="card" to={`/shops/${shop.id}`}>
              <h3>{shop.shop_name}</h3>
              <p className="badge">{shop.category}</p>
              <p>{shop.colony} · {shop.owner_name}</p>
            </Link>
            <LocationLink latitude={shop.latitude} longitude={shop.longitude} />
          </div>
        ))}
      </div>
    </div>
  );
}
