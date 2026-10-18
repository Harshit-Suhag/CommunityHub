const db = require('../db');

function sendNotOwner(res) {
  return res.status(403).json({ message: 'You can only modify your own records' });
}

async function requireRoomOwner(req, res, next) {
  try {
    const [rows] = await db.query('SELECT owner_id FROM rooms WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (rows[0].owner_id !== req.user.id) {
      return sendNotOwner(res);
    }
    req.resource = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireShopOwner(req, res, next) {
  try {
    const [rows] = await db.query('SELECT shop_owner_id FROM shops WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    if (rows[0].shop_owner_id !== req.user.id) {
      return sendNotOwner(res);
    }
    req.resource = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireGoodsOwner(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT g.id, s.shop_owner_id, g.shop_id
       FROM goods g
       JOIN shops s ON s.id = g.shop_id
       WHERE g.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Good not found' });
    }
    if (rows[0].shop_owner_id !== req.user.id) {
      return sendNotOwner(res);
    }
    req.resource = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireSlotOwner(req, res, next) {
  try {
    const [rows] = await db.query('SELECT provider_id FROM service_slots WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    if (rows[0].provider_id !== req.user.id) {
      return sendNotOwner(res);
    }
    req.resource = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireShopIdOwner(req, res, next) {
  try {
    const shopId = req.body.shop_id || req.params.shopId;
    if (!shopId) {
      return res.status(400).json({ message: 'shop_id is required' });
    }
    const [rows] = await db.query('SELECT shop_owner_id FROM shops WHERE id = ?', [shopId]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    if (rows[0].shop_owner_id !== req.user.id) {
      return sendNotOwner(res);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireRoomOwner,
  requireShopOwner,
  requireGoodsOwner,
  requireSlotOwner,
  requireShopIdOwner,
};
