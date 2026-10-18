const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const ROLES = ['tenant', 'owner', 'shop', 'service'];
const googleClient = new OAuth2Client();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

function publicUser(row, roles = [row.role], activeRole = row.role) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: activeRole,
    roles,
    phone: row.phone,
    colony: row.colony,
    business_name: row.business_name,
    latitude: row.latitude,
    longitude: row.longitude,
    created_at: row.created_at,
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function getUserRoles(userId) {
  const [rows] = await db.query('SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at, role', [userId]);
  return rows.map((row) => row.role);
}

router.post(
  '/google',
  [
    body('credential').notEmpty().withMessage('Google credential is required'),
    body('intent').isIn(['login', 'register']).withMessage('Invalid Google sign-in intent'),
    body('role').optional().isIn(ROLES).withMessage('Invalid role'),
    body('roles')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Select at least one role')
      .custom((roles) => Array.isArray(roles) && roles.every((role) => ROLES.includes(role)))
      .withMessage('One or more selected roles are invalid'),
    body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^\d{10}$/),
    body('colony').optional({ nullable: true, checkFalsy: true }).isLength({ max: 100 }),
    body('business_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ message: 'Google sign-in is not configured on the server' });
      }

      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: req.body.credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        return res.status(401).json({ message: 'Google sign-in could not be verified' });
      }

      if (!payload?.email || payload.email_verified !== true || !payload.sub) {
        return res.status(401).json({ message: 'Google must provide a verified email address' });
      }

      const email = payload.email.trim().toLowerCase();
      if (!/\.(com|in|edu)$/i.test(email)) {
        return res.status(400).json({ message: 'Email must end in .com, .in, or .edu' });
      }

      const isRegistration = req.body.intent === 'register';
      const selectedRoles = [...new Set(req.body.roles || [])];
      if (isRegistration && selectedRoles.length === 0) {
        return res.status(400).json({ message: 'Select at least one role' });
      }
      if (isRegistration && !/^\d{10}$/.test(req.body.phone || '')) {
        return res.status(400).json({ message: 'Mobile number must contain exactly 10 digits' });
      }

      const [linkedAccounts] = await db.query('SELECT * FROM users WHERE google_sub = ?', [payload.sub]);
      const [emailAccounts] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      if (linkedAccounts.length && linkedAccounts[0].email.toLowerCase() !== email) {
        return res.status(409).json({ message: 'This Google account is linked to a different email' });
      }

      let account = linkedAccounts[0] || emailAccounts[0];
      let created = false;
      if (!account && !isRegistration) {
        return res.status(404).json({ message: 'No account found for this Google email. Register first.' });
      }
      if (account?.google_sub && account.google_sub !== payload.sub) {
        return res.status(409).json({ message: 'This email is linked to a different Google account' });
      }

      if (!account) {
        const roles = selectedRoles;
        const activeRole = roles[0];
        const randomPassword = crypto.randomBytes(48).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);
        const connection = await db.getConnection();
        let userId;
        try {
          await connection.beginTransaction();
          const [result] = await connection.query(
            `INSERT INTO users (name, email, password, google_sub, role, phone, colony, business_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.name || email.split('@')[0],
              email,
              passwordHash,
              payload.sub,
              activeRole,
              req.body.phone,
              req.body.colony || null,
              roles.includes('service') ? (req.body.business_name || null) : null,
            ]
          );
          userId = result.insertId;
          for (const role of roles) {
            await connection.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]);
          }
          await connection.commit();
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        account = rows[0];
        created = true;
      } else {
        const rolesToAdd = isRegistration ? selectedRoles : [];
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query('UPDATE users SET google_sub = ? WHERE id = ?', [payload.sub, account.id]);
          for (const role of rolesToAdd) {
            await connection.query(
              'INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)',
              [account.id, role]
            );
          }
          if (isRegistration && !account.phone) {
            await connection.query('UPDATE users SET phone = ? WHERE id = ?', [req.body.phone, account.id]);
          }
          if (isRegistration && rolesToAdd.includes('service') && req.body.business_name) {
            await connection.query(
              'UPDATE users SET business_name = ? WHERE id = ?',
              [req.body.business_name, account.id]
            );
          }
          await connection.commit();
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [account.id]);
        account = rows[0];
      }

      const roles = await getUserRoles(account.id);
      if (!roles.length) {
        return res.status(500).json({ message: 'Account roles could not be loaded. Run the database migrations and try again.' });
      }

      const preferredRole = isRegistration ? selectedRoles[0] : (req.body.role || account.role);
      const activeRole = roles.includes(preferredRole) ? preferredRole : roles[0];
      if (!isRegistration && req.body.role && !roles.includes(req.body.role)) {
        return res.status(403).json({ message: `This account does not have the ${req.body.role} role` });
      }

      const user = publicUser(account, roles, activeRole);
      const token = signToken(user);
      return res.status(created ? 201 : 200).json({ token, user });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email')
      .trim()
      .isEmail().withMessage('Enter a valid email address')
      .bail()
      .matches(/\.(com|in|edu)$/i).withMessage('Email must end in .com, .in, or .edu')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').optional().isIn(ROLES).withMessage('Role must be tenant, owner, shop, or service'),
    body('roles')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Select at least one role')
      .custom((roles) => Array.isArray(roles) && roles.every((role) => ROLES.includes(role)))
      .withMessage('One or more selected roles are invalid'),
    body('phone')
      .notEmpty().withMessage('Mobile number is required')
      .bail()
      .matches(/^\d{10}$/).withMessage('Mobile number must contain exactly 10 digits'),
    body('colony').optional({ nullable: true, checkFalsy: true }).isLength({ max: 100 }),
    body('business_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const { name, email, password, phone, colony } = req.body;
      const businessName = req.body.business_name || null;
      const selectedRoles = req.body.roles || (req.body.role ? [req.body.role] : []);
      if (!selectedRoles.length) {
        return res.status(400).json({ message: 'Select at least one role' });
      }
      const roles = [...new Set(selectedRoles)];
      const activeRole = roles[0];
      const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

      if (existing.length) {
        const account = existing[0];
        const match = await bcrypt.compare(password, account.password);
        if (!match) {
          return res.status(409).json({
            message: 'This email is already registered. Enter its existing password to add another role.',
          });
        }

        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          for (const role of roles) {
            await connection.query(
              'INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)',
              [account.id, role]
            );
          }
          if (businessName && roles.includes('service')) {
            await connection.query(
              'UPDATE users SET business_name = ? WHERE id = ?',
              [businessName, account.id]
            );
          }
          await connection.commit();
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }

        const userRoles = await getUserRoles(account.id);
        const user = publicUser(account, userRoles, activeRole);
        const token = signToken(user);
        return res.status(200).json({ token, user });
      }

      const passwordErrors = [];
      if (password.length < 8) {
        passwordErrors.push('Password must be at least 8 characters');
      }
      if (!/[A-Z]/.test(password)) {
        passwordErrors.push('Password must contain at least one uppercase letter');
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        passwordErrors.push('Password must contain at least one special character');
      }
      if (passwordErrors.length) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: passwordErrors.map((msg) => ({ path: 'password', msg })),
        });
      }

      const hash = await bcrypt.hash(password, 10);
      const connection = await db.getConnection();
      let userId;
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO users (name, email, password, role, phone, colony, business_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, email, hash, activeRole, phone || null, colony || null, businessName]
        );
        userId = result.insertId;
        for (const role of roles) {
          await connection.query(
            'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
            [userId, role]
          );
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      const [rows] = await db.query(
        'SELECT id, name, email, role, phone, colony, business_name, latitude, longitude, created_at FROM users WHERE id = ?',
        [userId]
      );
      const user = publicUser(rows[0], roles, activeRole);
      const token = signToken(user);
      return res.status(201).json({ token, user });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').optional().isIn(ROLES).withMessage('Invalid role'),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;

      const { email, password, role } = req.body;
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      if (!rows.length) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const match = await bcrypt.compare(password, rows[0].password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const roles = await getUserRoles(rows[0].id);
      if (!roles.length) {
        return res.status(403).json({ message: 'This account has no enabled roles. Update the database schema and try again.' });
      }
      const activeRole = role || rows[0].role;
      if (!roles.includes(activeRole)) {
        return res.status(403).json({
          message: `This account does not have the ${activeRole} role. Register with this email and existing password to add it.`,
        });
      }
      const user = publicUser(rows[0], roles, activeRole);
      const token = signToken(user);
      return res.status(200).json({ token, user });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, phone, colony, business_name, latitude, longitude, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    const roles = await getUserRoles(rows[0].id);
    const activeRole = req.user.role;
    if (!roles.includes(activeRole)) {
      return res.status(403).json({ message: 'The active role is not enabled for this account' });
    }
    return res.status(200).json({ user: publicUser(rows[0], roles, activeRole) });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/role',
  authMiddleware,
  [body('role').isIn(ROLES).withMessage('Invalid role')],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;
      const roles = await getUserRoles(req.user.id);
      if (!roles.includes(req.body.role)) {
        return res.status(403).json({ message: 'This role is not enabled for your account' });
      }
      const [rows] = await db.query(
        'SELECT id, name, email, role, phone, colony, business_name, latitude, longitude, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!rows.length) {
        return res.status(404).json({ message: 'User not found' });
      }
      const user = publicUser(rows[0], roles, req.body.role);
      const token = signToken(user);
      return res.status(200).json({ token, user });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
