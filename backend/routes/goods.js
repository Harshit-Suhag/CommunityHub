const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { requireGoodsOwner, requireShopIdOwner } = require('../middleware/ownership');

const router = express.Router();
const STOCK = ['in_stock', 'low_stock', 'out_of_stock'];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

router.post(
  '/',
  authMiddleware,
  roleMiddleware('shop'),
  [
    body('shop_id').isInt({ min: 1 }).withMessage('shop_id is required'),
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
    body('stock_status').optional().isIn(STOCK),
  ],
  (req, res, next) => {
    if (!handleValidation(req, res)) return;
    next();
  },
  requireShopIdOwner,
  async (req, res, next) => {
    try {

      const { shop_id, name, stock_status } = req.body;
      const [result] = await db.query(
        'INSERT INTO goods (shop_id, name, stock_status) VALUES (?, ?, ?)',
        [shop_id, name, stock_status || 'in_stock']
      );
      const [rows] = await db.query('SELECT * FROM goods WHERE id = ?', [result.insertId]);
      return res.status(201).json({ good: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('shop'),
  requireGoodsOwner,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 150 }),
    body('stock_status').optional().isIn(STOCK),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const [currentRows] = await db.query('SELECT * FROM goods WHERE id = ?', [req.params.id]);
      const current = currentRows[0];
      const name = req.body.name ?? current.name;
      const stock_status = req.body.stock_status ?? current.stock_status;

      await db.query('UPDATE goods SET name = ?, stock_status = ? WHERE id = ?', [
        name,
        stock_status,
        req.params.id,
      ]);
      const [rows] = await db.query('SELECT * FROM goods WHERE id = ?', [req.params.id]);
      return res.status(200).json({ good: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('shop'),
  requireGoodsOwner,
  async (req, res, next) => {
    try {
      await db.query('DELETE FROM goods WHERE id = ?', [req.params.id]);
      return res.status(200).json({ message: 'Good deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
