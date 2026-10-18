# ColonyHub

Hyperlocal colony management for localities such as **Rajiv Colony** and **Hans Enclave** in Gurgaon, Haryana.

Tenants browse rooms, shops, and service slots. Owners list rooms. Shopkeepers update goods and stock. Service providers (barber, carpenter, mechanic) publish free/busy slots.

Stack: React (Vite) + Express + MySQL. JWT auth. Image uploads via multer. Pure CRUD.

## Folder structure

```
backend/          Express API, schema, uploads
frontend/         React SPA
```

## Prerequisites

- Node.js 18+
- MySQL 8+

## 1. Create the database

In MySQL:

```sql
SOURCE backend/schema.sql;
```

Or from a terminal:

```bash
mysql -u root -p < backend/schema.sql
```

If you already created the database before enabling multiple roles, run the schema script again. It creates `user_roles` and assigns each existing account its current role.

For an existing database, run `backend/migrate_listing_locations.sql` once to add location and service-provider business-name fields. New databases created using the updated schema already include these columns.

## 2. Backend

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL user, password, and a JWT secret.
To enable Google sign-in, create a **Web application** OAuth client in Google Cloud Console, add your frontend origins (for local development, `http://localhost:5173`), then set the same client ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`. Do not put a Google client secret in frontend environment variables.

```bash
npm install
npm start
```

API: `http://localhost:5000`

## 3. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

Vite proxies `/api` and `/uploads` to the Express server.
Interactive maps use OpenStreetMap tiles and need an internet connection. Listing pins are public.

On macOS/Linux use `cp` instead of `copy`.

## Accounts

Register at `/register` with a valid email ending in `.com`, `.in`, or `.edu`, a 10-digit mobile number, and a password of at least 8 characters containing an uppercase letter and a special character. Select one or more roles. One email and password can be used for all roles. To add a role later, register again with the same email and password and select the additional role. After login, use the **Active role** menu to switch dashboards.

Google sign-in is available on the login and registration pages after configuring the OAuth client ID. Google registration uses the selected roles and still requires the 10-digit mobile number. Run `backend/migrate_google_auth.sql` once for an existing database to add the Google account link column.

| Role      | Dashboard              | Can do                                      |
|-----------|------------------------|---------------------------------------------|
| tenant    | `/dashboard/tenant`    | Browse listings, save rooms locally         |
| owner     | `/dashboard/owner`     | CRUD own rooms (with photo)                 |
| shop      | `/dashboard/shop`      | CRUD own shops and goods / stock status     |
| service   | `/dashboard/service`   | Manage provider profile, business name, map location, and own slots |

Passwords are bcrypt-hashed. JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.

## API summary

- `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/me` `POST /api/auth/role`
- Rooms: `GET/POST /api/rooms` `GET/PUT/DELETE /api/rooms/:id`
- Shops: `GET/POST /api/shops` `PUT/DELETE /api/shops/:id`
- Goods: `GET /api/shops/:shopId/goods` `POST /api/goods` `PUT/DELETE /api/goods/:id`
- Slots: `GET /api/slots` `GET /api/slots/:providerId` `PUT /api/slots/profile` `POST /api/slots` `PUT/DELETE /api/slots/:id`

Write routes require the matching role and **server-side ownership checks**. Public list endpoints support query filters (`colony`, `available`, `category`, `type`, `status`).

Room and shop owners, and service providers, can set public map pins from their dashboards. Pins are optional; service-provider business names and locations are managed in the provider profile.
