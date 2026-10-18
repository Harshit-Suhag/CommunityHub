import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { LocationMap } from '../components/LocationMap.jsx';

function stockClass(status) {
  if (status === 'in_stock') return 'badge badge-green';
  if (status === 'low_stock') return 'badge badge-yellow';
  return 'badge badge-red';
}

export default function ShopDetail() {
  const { id } = useParams();
  const [shop, setShop] = useState(null);
  const [goods, setGoods] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/shops/${id}`), api.get(`/shops/${id}/goods`)])
      .then(([s, g]) => {
        setShop(s.data.shop);
        setGoods(g.data.goods || []);
      })
      .catch(() => setError('Shop not found'));
  }, [id]);

  if (error) return <p className="alert">{error}</p>;
  if (!shop) return <p className="muted">Loading…</p>;

  return (
    <div>
      <p className="eyebrow">{shop.colony} · {shop.category}</p>
      <h1>{shop.shop_name}</h1>
      <p>Owner: {shop.owner_name} · {shop.owner_phone || 'No phone'}</p>
      {shop.latitude != null && shop.longitude != null && (
        <section className="listing-location">
          <h2>Shop location</h2>
          <LocationMap latitude={shop.latitude} longitude={shop.longitude} height={280} />
          <a
            href={`https://www.openstreetmap.org/?mlat=${shop.latitude}&mlon=${shop.longitude}#map=17/${shop.latitude}/${shop.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Open larger map
          </a>
        </section>
      )}
      <h2>Goods</h2>
      <ul className="list">
        {goods.length === 0 && <li className="muted">No goods listed.</li>}
        {goods.map((item) => (
          <li key={item.id} className="list-row">
            <span>{item.name}</span>
            <span className={stockClass(item.stock_status)}>{item.stock_status.replaceAll('_', ' ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
