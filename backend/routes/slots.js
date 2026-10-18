const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { requireSlotOwner } = require('../middleware/ownership');

const router = express.Router();
const TYPES = ['barber', 'carpenter', 'mechanic'];
const STATUSES = ['free', 'busy'];

function toMysqlDateTime(value) {
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const mysqlDateTime = value.replace('T', ' ');
    return mysqlDateTime.length === 16 ? `${mysqlDateTime}:00` : mysqlDateTime;
  }
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

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
    query('type').optional({ checkFalsy: true }).isIn(TYPES),
    query('status').optional({ checkFalsy: true }).isIn(STATUSES),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      let sql = `
        SELECT sl.*, u.name AS provider_name, u.business_name AS provider_business_name,
               u.phone AS provider_phone, u.colony AS colony, u.email AS provider_email,
               u.latitude, u.longitude
        FROM service_slots sl
        JOIN users u ON u.id = sl.provider_id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.type) {
        sql += ' AND sl.service_type = ?';
        params.push(req.query.type);
      }
      if (req.query.status) {
        sql += ' AND sl.status = ?';
        params.push(req.query.status);
      }

      sql += ' ORDER BY sl.slot_time ASC';
      const [rows] = await db.query(sql, params);
      return res.status(200).json({ slots: rows });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/profile',
  authMiddleware,
  roleMiddleware('service'),
  [
    body('business_name').trim().notEmpty().isLength({ max: 150 }),
    body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;
      const [currentRows] = await db.query(
        'SELECT business_name, latitude, longitude FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!currentRows.length) {
        return res.status(404).json({ message: 'Provider account not found' });
      }

      const current = currentRows[0];
      const businessName = req.body.business_name.trim();
      const latitude = req.body.latitude !== undefined
        ? (req.body.latitude === '' ? null : Number(req.body.latitude))
        : current.latitude;
      const longitude = req.body.longitude !== undefined
        ? (req.body.longitude === '' ? null : Number(req.body.longitude))
        : current.longitude;

      await db.query(
        'UPDATE users SET business_name = ?, latitude = ?, longitude = ? WHERE id = ?',
        [businessName, latitude, longitude, req.user.id]
      );
      return res.status(200).json({
        profile: { business_name: businessName, latitude, longitude },
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/:providerId',
  [param('providerId').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const [providers] = await db.query(
        `SELECT id, name, business_name, email, phone, colony, latitude, longitude
         FROM users
         WHERE id = ? AND (
           role = 'service'
           OR EXISTS (
             SELECT 1 FROM service_slots WHERE service_slots.provider_id = users.id
           )
         )`,
        [req.params.providerId]
      );
      if (!providers.length) {
        return res.status(404).json({ message: 'Service provider not found' });
      }

      const [slots] = await db.query(
        `SELECT sl.*, u.name AS provider_name, u.business_name AS provider_business_name,
                u.phone AS provider_phone, u.colony AS colony, u.latitude, u.longitude
         FROM service_slots sl
         JOIN users u ON u.id = sl.provider_id
         WHERE sl.provider_id = ?
         ORDER BY sl.slot_time ASC`,
        [req.params.providerId]
      );

      return res.status(200).json({ provider: providers[0], slots });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('service'),
  [
    body('service_type').isIn(TYPES).withMessage('service_type must be barber, carpenter, or mechanic'),
    body('slot_time').notEmpty().withMessage('slot_time is required').isISO8601().withMessage('slot_time must be a valid datetime'),
    body('status').optional().isIn(STATUSES),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const { service_type, slot_time, status } = req.body;
      const [result] = await db.query(
        'INSERT INTO service_slots (provider_id, service_type, slot_time, status) VALUES (?, ?, ?, ?)',
        [req.user.id, service_type, toMysqlDateTime(slot_time), status || 'free']
      );
      const [rows] = await db.query('SELECT * FROM service_slots WHERE id = ?', [result.insertId]);
      return res.status(201).json({ slot: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('service'),
  requireSlotOwner,
  [
    body('service_type').optional().isIn(TYPES),
    body('slot_time').optional().isISO8601(),
    body('status').optional().isIn(STATUSES),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const [currentRows] = await db.query('SELECT * FROM service_slots WHERE id = ?', [req.params.id]);
      const current = currentRows[0];
      const service_type = req.body.service_type ?? current.service_type;
      const slot_time = req.body.slot_time
        ? toMysqlDateTime(req.body.slot_time)
        : current.slot_time;
      const status = req.body.status ?? current.status;

      await db.query(
        'UPDATE service_slots SET service_type = ?, slot_time = ?, status = ? WHERE id = ?',
        [service_type, slot_time, status, req.params.id]
      );
      const [rows] = await db.query('SELECT * FROM service_slots WHERE id = ?', [req.params.id]);
      return res.status(200).json({ slot: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('service'),
  requireSlotOwner,
  async (req, res, next) => {
    try {
      await db.query('DELETE FROM service_slots WHERE id = ?', [req.params.id]);
      return res.status(200).json({ message: 'Slot deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
