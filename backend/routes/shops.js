const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { requireShopOwner } = require('../middleware/ownership');

const router = express.Router();
const CATEGORIES = ['grocery', 'pharmacy', 'general'];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

router.get(
  '/',
  [
    query('colony').optional({ checkFalsy: true }).isLength({ max: 100 }),
    query('category').optional({ checkFalsy: true }).isIn(CATEGORIES),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      let sql = `
        SELECT s.*, u.name AS owner_name, u.phone AS owner_phone
        FROM shops s
        JOIN users u ON u.id = s.shop_owner_id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.colony) {
        sql += ' AND s.colony = ?';
        params.push(req.query.colony);
      }
      if (req.query.category) {
        sql += ' AND s.category = ?';
        params.push(req.query.category);
      }

      sql += ' ORDER BY s.created_at DESC';
      const [rows] = await db.query(sql, params);
      return res.status(200).json({ shops: rows });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/:shopId/goods', async (req, res, next) => {
  try {
    const [shops] = await db.query('SELECT id FROM shops WHERE id = ?', [req.params.shopId]);
    if (!shops.length) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const [goods] = await db.query(
      'SELECT * FROM goods WHERE shop_id = ? ORDER BY name ASC',
      [req.params.shopId]
    );
    return res.status(200).json({ goods });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
       FROM shops s
       JOIN users u ON u.id = s.shop_owner_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    return res.status(200).json({ shop: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/',
  authMiddleware,
  roleMiddleware('shop'),
  [
    body('shop_name').trim().notEmpty().withMessage('Shop name is required').isLength({ max: 150 }),
    body('category').isIn(CATEGORIES).withMessage('Category must be grocery, pharmacy, or general'),
    body('colony').optional({ nullable: true, checkFalsy: true }).isLength({ max: 100 }),
    body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const { shop_name, category, colony } = req.body;
      const latitude = req.body.latitude ? Number(req.body.latitude) : null;
      const longitude = req.body.longitude ? Number(req.body.longitude) : null;
      const [result] = await db.query(
        `INSERT INTO shops (shop_owner_id, shop_name, category, colony, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, shop_name, category, colony || null, latitude, longitude]
      );
      const [rows] = await db.query('SELECT * FROM shops WHERE id = ?', [result.insertId]);
      return res.status(201).json({ shop: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('shop'),
  requireShopOwner,
  [
    body('shop_name').optional().trim().notEmpty().isLength({ max: 150 }),
    body('category').optional().isIn(CATEGORIES),
    body('colony').optional({ nullable: true, checkFalsy: true }).isLength({ max: 100 }),
    body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const [currentRows] = await db.query('SELECT * FROM shops WHERE id = ?', [req.params.id]);
      const current = currentRows[0];
      const shop_name = req.body.shop_name ?? current.shop_name;
      const category = req.body.category ?? current.category;
      const colony = req.body.colony !== undefined ? req.body.colony : current.colony;
      const latitude = req.body.latitude !== undefined
        ? (req.body.latitude === '' ? null : Number(req.body.latitude))
        : current.latitude;
      const longitude = req.body.longitude !== undefined
        ? (req.body.longitude === '' ? null : Number(req.body.longitude))
        : current.longitude;

      await db.query(
        'UPDATE shops SET shop_name = ?, category = ?, colony = ?, latitude = ?, longitude = ? WHERE id = ?',
        [
        shop_name,
        category,
        colony,
        latitude,
        longitude,
        req.params.id,
        ]
      );
      const [rows] = await db.query('SELECT * FROM shops WHERE id = ?', [req.params.id]);
      return res.status(200).json({ shop: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('shop'),
  requireShopOwner,
  async (req, res, next) => {
    try {
      await db.query('DELETE FROM shops WHERE id = ?', [req.params.id]);
      return res.status(200).json({ message: 'Shop deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
