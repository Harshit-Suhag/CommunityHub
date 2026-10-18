import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { LocationMap } from '../components/LocationMap.jsx';

function stockClass(status) {
  if (status === 'in_stock') return 'badge badge-green';
  if (status === 'low_stock') return 'badge badge-yellow';
  return 'badge badge-red';
}

export default function ShopDashboard() {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [goodsByShop, setGoodsByShop] = useState({});
  const [shopForm, setShopForm] = useState({
    shop_name: '',
    category: 'grocery',
    colony: user.colony || 'Rajiv Colony',
    latitude: '',
    longitude: '',
  });
  const [editingShopId, setEditingShopId] = useState(null);
  const [goodForm, setGoodForm] = useState({ shop_id: '', name: '', stock_status: 'in_stock' });
  const [editingGoodId, setEditingGoodId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.get('/shops');
    const mine = (res.data.shops || []).filter((s) => s.shop_owner_id === user.id);
    setShops(mine);
    const map = {};
    await Promise.all(
      mine.map(async (shop) => {
        const g = await api.get(`/shops/${shop.id}/goods`);
        map[shop.id] = g.data.goods || [];
      })
    );
    setGoodsByShop(map);
    if (mine.length && !goodForm.shop_id) {
      setGoodForm((f) => ({ ...f, shop_id: String(mine[0].id) }));
    }
  };

  useEffect(() => {
    load().catch(() => setError('Failed to load shops'));
  }, [user.id]);

  const resetShopForm = () => {
    setShopForm({
      shop_name: '',
      category: 'grocery',
      colony: user.colony || 'Rajiv Colony',
      latitude: '',
      longitude: '',
    });
    setEditingShopId(null);
  };

  const saveShop = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingShopId) {
        await api.put(`/shops/${editingShopId}`, shopForm);
      } else {
        await api.post('/shops', shopForm);
      }
      resetShopForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save shop');
    }
  };

  const editShop = (shop) => {
    setEditingShopId(shop.id);
    setShopForm({
      shop_name: shop.shop_name,
      category: shop.category,
      colony: shop.colony || user.colony || 'Rajiv Colony',
      latitude: shop.latitude ?? '',
      longitude: shop.longitude ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteShop = async (id) => {
    if (!window.confirm('Delete this shop and its goods?')) return;
    setError('');
    try {
      await api.delete(`/shops/${id}`);
      if (editingShopId === id) resetShopForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete shop');
    }
  };

  const resetGoodForm = () => {
    setGoodForm((current) => ({
      shop_id: current.shop_id || (shops[0] ? String(shops[0].id) : ''),
      name: '',
      stock_status: 'in_stock',
    }));
    setEditingGoodId(null);
  };

  const saveGood = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingGoodId) {
        await api.put(`/goods/${editingGoodId}`, {
          name: goodForm.name,
          stock_status: goodForm.stock_status,
        });
      } else {
        await api.post('/goods', {
          shop_id: Number(goodForm.shop_id),
          name: goodForm.name,
          stock_status: goodForm.stock_status,
        });
      }
      resetGoodForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save good');
    }
  };

  const editGood = (item, shopId) => {
    setEditingGoodId(item.id);
    setGoodForm({
      shop_id: String(shopId),
      name: item.name,
      stock_status: item.stock_status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cycleStock = async (item) => {
    const order = ['in_stock', 'low_stock', 'out_of_stock'];
    const next = order[(order.indexOf(item.stock_status) + 1) % order.length];
    setError('');
    try {
      await api.put(`/goods/${item.id}`, { stock_status: next });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update stock');
    }
  };

  const deleteGood = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    setError('');
    try {
      await api.delete(`/goods/${id}`);
      if (editingGoodId === id) resetGoodForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete good');
    }
  };

  return (
    <div>
      <h1>Shop dashboard</h1>
      <p className="muted">Add, edit, and delete your shop listings and inventory items.</p>
      {error && <p className="alert">{error}</p>}

      <form className="form wide" onSubmit={saveShop}>
        <h2>{editingShopId ? 'Edit shop' : 'Add shop'}</h2>
        <label>
          Shop name
          <input
            value={shopForm.shop_name}
            onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
            required
          />
        </label>
        <label>
          Category
          <select
            value={shopForm.category}
            onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })}
          >
            <option value="grocery">Grocery</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="general">General</option>
          </select>
        </label>
        <label>
          Colony
          <select
            value={shopForm.colony}
            onChange={(e) => setShopForm({ ...shopForm, colony: e.target.value })}
          >
            <option value="Rajiv Colony">Rajiv Colony</option>
            <option value="Hans Enclave">Hans Enclave</option>
          </select>
        </label>
        <label>Shop location on map</label>
        <LocationMap
          latitude={shopForm.latitude}
          longitude={shopForm.longitude}
          onChange={({ latitude, longitude }) => setShopForm((current) => ({ ...current, latitude, longitude }))}
        />
        <div className="row">
          <button className="btn" type="submit">{editingShopId ? 'Save changes' : 'Create shop'}</button>
          {editingShopId && (
            <button className="btn btn-ghost" type="button" onClick={resetShopForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {shops.length > 0 && (
        <form className="form wide" onSubmit={saveGood}>
          <h2>{editingGoodId ? 'Edit inventory item' : 'Add inventory item'}</h2>
          <label>
            Shop
            <select
              value={goodForm.shop_id}
              onChange={(e) => setGoodForm({ ...goodForm, shop_id: e.target.value })}
              required
              disabled={Boolean(editingGoodId)}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              value={goodForm.name}
              onChange={(e) => setGoodForm({ ...goodForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Stock
            <select
              value={goodForm.stock_status}
              onChange={(e) => setGoodForm({ ...goodForm, stock_status: e.target.value })}
            >
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </label>
          <div className="row">
            <button className="btn" type="submit">
              {editingGoodId ? 'Save changes' : 'Add item'}
            </button>
            {editingGoodId && (
              <button className="btn btn-ghost" type="button" onClick={resetGoodForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {shops.map((shop) => (
        <section key={shop.id} className="section">
          <div className="section-head">
            <h2>{shop.shop_name} · {shop.category}</h2>
            <div className="row">
              <button className="btn btn-small btn-ghost" type="button" onClick={() => editShop(shop)}>
                Edit shop
              </button>
              <button className="btn btn-small btn-danger" type="button" onClick={() => deleteShop(shop.id)}>
                Delete shop
              </button>
            </div>
          </div>
          <ul className="list">
            {(goodsByShop[shop.id] || []).length === 0 && <li className="muted">No goods yet.</li>}
            {(goodsByShop[shop.id] || []).map((item) => (
              <li key={item.id} className="list-row">
                <span>{item.name}</span>
                <div className="row">
                  <button className="btn btn-small btn-ghost" type="button" onClick={() => editGood(item, shop.id)}>
                    Edit
                  </button>
                  <button
                    className={stockClass(item.stock_status)}
                    type="button"
                    onClick={() => cycleStock(item)}
                  >
                    {item.stock_status.replaceAll('_', ' ')}
                  </button>
                  <button className="btn btn-small btn-danger" type="button" onClick={() => deleteGood(item.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
