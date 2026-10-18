const express = require('express');
const path = require('path');
const multer = require('multer');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { requireRoomOwner } = require('../middleware/ownership');

const router = express.Router();
const ROOM_TYPES = ['1BHK', '2BHK', 'single', 'pg'];

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, `room-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
  },
});

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

function parseAvailable(value) {
  if (value === undefined || value === '') return null;
  if (value === '1' || value === 'true' || value === true) return 1;
  if (value === '0' || value === 'false' || value === false) return 0;
  return null;
}

router.get(
  '/',
  [
    query('colony').optional({ checkFalsy: true }).isLength({ max: 100 }),
    query('available').optional({ checkFalsy: true }).isIn(['0', '1', 'true', 'false']),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      let sql = `
        SELECT r.*, u.name AS owner_name, u.phone AS owner_phone, u.colony AS colony, u.email AS owner_email
        FROM rooms r
        JOIN users u ON u.id = r.owner_id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.colony) {
        sql += ' AND u.colony = ?';
        params.push(req.query.colony);
      }

      const available = parseAvailable(req.query.available);
      if (available !== null) {
        sql += ' AND r.is_available = ?';
        params.push(available);
      }

      sql += ' ORDER BY r.created_at DESC';
      const [rows] = await db.query(sql, params);
      return res.status(200).json({ rooms: rows });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS owner_name, u.phone AS owner_phone, u.colony AS colony, u.email AS owner_email
       FROM rooms r
       JOIN users u ON u.id = r.owner_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Room not found' });
    }
    return res.status(200).json({ room: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/',
  authMiddleware,
  roleMiddleware('owner'),
  upload.single('image'),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
    body('description').optional({ nullable: true }),
    body('rent').isInt({ min: 0 }).withMessage('Rent must be a non-negative integer'),
    body('room_type').isIn(ROOM_TYPES).withMessage('Invalid room type'),
    body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const { title, description, rent, room_type } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : null;
      const is_available =
        req.body.is_available === undefined ? 1 : parseAvailable(req.body.is_available) ?? 1;
      const latitude = req.body.latitude ? Number(req.body.latitude) : null;
      const longitude = req.body.longitude ? Number(req.body.longitude) : null;

      const [result] = await db.query(
        `INSERT INTO rooms (owner_id, title, description, rent, room_type, image_url, is_available, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, title, description || null, Number(rent), room_type, image_url, is_available, latitude, longitude]
      );

      const [rows] = await db.query(
        `SELECT r.*, u.name AS owner_name, u.phone AS owner_phone, u.colony, u.email AS owner_email
         FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.id = ?`,
        [result.insertId]
      );
      return res.status(201).json({ room: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('owner'),
  requireRoomOwner,
  upload.single('image'),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 150 }),
    body('rent').optional().isInt({ min: 0 }),
    body('room_type').optional().isIn(ROOM_TYPES),
    body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const [currentRows] = await db.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
      const current = currentRows[0];

      const title = req.body.title ?? current.title;
      const description =
        req.body.description !== undefined ? req.body.description : current.description;
      const rent = req.body.rent !== undefined ? Number(req.body.rent) : current.rent;
      const room_type = req.body.room_type ?? current.room_type;
      const image_url = req.file ? `/uploads/${req.file.filename}` : current.image_url;
      const is_available =
        req.body.is_available !== undefined
          ? (parseAvailable(req.body.is_available) ?? current.is_available)
          : current.is_available;
      const latitude = req.body.latitude !== undefined
        ? (req.body.latitude === '' ? null : Number(req.body.latitude))
        : current.latitude;
      const longitude = req.body.longitude !== undefined
        ? (req.body.longitude === '' ? null : Number(req.body.longitude))
        : current.longitude;

      await db.query(
        `UPDATE rooms
         SET title = ?, description = ?, rent = ?, room_type = ?, image_url = ?, is_available = ?,
             latitude = ?, longitude = ?
         WHERE id = ?`,
        [title, description, rent, room_type, image_url, is_available, latitude, longitude, req.params.id]
      );

      const [rows] = await db.query(
        `SELECT r.*, u.name AS owner_name, u.phone AS owner_phone, u.colony, u.email AS owner_email
         FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.id = ?`,
        [req.params.id]
      );
      return res.status(200).json({ room: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('owner'),
  requireRoomOwner,
  async (req, res, next) => {
    try {
      await db.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
      return res.status(200).json({ message: 'Room deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
