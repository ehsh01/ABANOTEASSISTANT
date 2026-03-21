# Step-by-Step Implementation Guide

## Overview

The backend has been fully connected to the database with:
- ✅ User authentication (register/login with JWT)
- ✅ Company creation (auto-created on registration)
- ✅ Multi-tenant data isolation (all data scoped to companies)
- ✅ Database schemas for all entities
- ✅ API routes connected to PostgreSQL

---

## Step 1: Understand What Was Built

### Database Tables Created

1. **`companies`** - Stores company information
   - Fields: `id`, `name`, `address`, `phone`, `email`, `createdAt`, `updatedAt`

2. **`users`** - Stores user accounts
   - Fields: `id`, `email`, `passwordHash`, `companyId` (FK to companies), `createdAt`, `updatedAt`
   - Each user belongs to one company

3. **`clients`** - Stores client information
   - Fields: `id`, `companyId` (FK), `name`, `ageBand`, `hasAssessment`, `assessmentStatus`, timestamps
   - **Scoped to company** - users only see their company's clients

4. **`programs`** - Stores replacement programs
   - Fields: `id`, `companyId` (FK), `name`, `type` (primary/supplemental), `description`, timestamps
   - **Scoped to company**

5. **`client_programs`** - Junction table (many-to-many)
   - Links clients to their programs
   - Fields: `id`, `clientId`, `programId`
   - Unique constraint on `(clientId, programId)`

6. **`notes`** - Stores generated session notes
   - Fields: `id`, `companyId` (FK), `clientId` (FK), `content`, `status` (draft/final), `sessionDate`, `sessionHours`, `generatedAt`, timestamps
   - **Scoped to company**

### API Endpoints

**Public (no auth required):**
- `GET /api/healthz` - Health check
- `POST /api/auth/register` - Register new user + create company
- `POST /api/auth/login` - Login and get JWT token

**Protected (require JWT Bearer token):**
- `GET /api/clients` - List all clients (filtered by company)
- `GET /api/clients/:clientId` - Get single client
- `GET /api/clients/:clientId/programs` - Get programs for a client
- `POST /api/notes/generate` - Generate a session note
- `POST /api/notes/:noteId/save` - Save/update a note

---

## Step 2: Set Up Environment Variables

### 2.1 Get Your DigitalOcean Database URL

1. Go to your DigitalOcean dashboard
2. Navigate to your PostgreSQL database
3. Copy the connection string (it looks like):
   ```
   postgresql://username:password@host:5432/dbname?sslmode=require
   ```

### 2.2 Create Environment File

1. Navigate to `artifacts/api-server/`
2. Copy `.env.example` to `.env`:
   ```bash
   cd artifacts/api-server
   cp .env.example .env
   ```

3. Edit `.env` and fill in:
   ```env
   DATABASE_URL=postgresql://your-actual-connection-string-here
   JWT_SECRET=your-super-secret-random-string-here-minimum-32-characters
   ```

   **Generate a secure JWT_SECRET:**
   ```bash
   # Option 1: Use openssl
   openssl rand -base64 32
   
   # Option 2: Use node
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. **Important:** Never commit `.env` to git (it should be in `.gitignore`)

---

## Step 3: Run Database Migrations

This creates all the tables in your DigitalOcean database.

### 3.1 Install Dependencies (if not done)

```bash
# From project root
pnpm install
```

### 3.2 Push Schema to Database

```bash
# This will create all tables in your DigitalOcean database
pnpm --filter @workspace/db run push
```

**Expected output:**
- Should show tables being created
- If you see errors, check your `DATABASE_URL` is correct

**If you need to force (careful - this can drop data):**
```bash
pnpm --filter @workspace/db run push-force
```

---

## Step 4: Start the API Server

### 4.1 Start Development Server

```bash
# From project root
pnpm --filter @workspace/api-server run dev
```

**Expected output:**
```
Server running on port 3000 (or whatever PORT env var is set)
```

### 4.2 Test Health Endpoint

```bash
curl http://localhost:3000/api/healthz
```

**Expected response:**
```json
{"status":"ok"}
```

---

## Step 5: Test Authentication Flow

### 5.1 Register a New User

This will:
1. Create a company
2. Create a user account
3. Return a JWT token

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123",
    "companyName": "Test Therapy Company",
    "companyAddress": "123 Main St",
    "companyPhone": "555-1234",
    "companyEmail": "info@testcompany.com"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "companyId": 1
    },
    "company": {
      "id": 1,
      "name": "Test Therapy Company",
      "address": "123 Main St",
      "phone": "555-1234",
      "email": "info@testcompany.com"
    }
  },
  "error": null
}
```

**Save the `token` value** - you'll need it for protected endpoints.

### 5.2 Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

**Expected response:** Same format as register, with a new token.

### 5.3 Test Protected Endpoint (List Clients)

```bash
# Replace YOUR_TOKEN with the token from registration
curl http://localhost:3000/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": [],
  "error": null
}
```

The array is empty because you haven't created any clients yet. This is expected!

**If you get 401 Unauthorized:**
- Check the token is correct
- Make sure you're using `Bearer ` prefix (with space)
- Token might be expired (default: 7 days)

---

## Step 6: Test Creating Data

### 6.1 Create a Client (via database directly for now)

Since we don't have a `POST /api/clients` endpoint yet, you can insert directly:

```sql
-- Connect to your DigitalOcean database and run:
INSERT INTO clients (company_id, name, age_band, has_assessment, assessment_status)
VALUES (1, 'Test Client', '6-10 yrs', true, 'ready');
```

### 6.2 List Clients Again

```bash
curl http://localhost:3000/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "companyId": 1,
      "name": "Test Client",
      "ageBand": "6-10 yrs",
      "hasAssessment": true,
      "assessmentStatus": "ready"
    }
  ],
  "error": null
}
```

---

## Step 7: Understanding Multi-Tenancy

### 7.1 Register a Second User (Different Company)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "password123",
    "companyName": "Another Company"
  }'
```

This creates:
- Company #2
- User #2 (belongs to Company #2)

### 7.2 Test Data Isolation

1. **Login as User 1**, list clients → Should see "Test Client"
2. **Login as User 2**, list clients → Should see empty array (different company)

This proves that each company's data is isolated!

---

## Step 8: Frontend Integration (Next Steps)

The frontend currently uses mock data. To connect it:

### 8.1 Add Authentication State Management

You'll need to:
1. Store the JWT token (localStorage or state)
2. Send `Authorization: Bearer <token>` header on all API calls
3. Handle login/register UI
4. Redirect to login if token is missing/invalid

### 8.2 Update API Client

The generated React hooks in `lib/api-client-react` need to include the auth token. You can:

1. **Option A:** Modify `custom-fetch.ts` to automatically add the token:
   ```typescript
   // Read token from localStorage/context
   const token = getAuthToken();
   if (token) {
     headers.set('Authorization', `Bearer ${token}`);
   }
   ```

2. **Option B:** Pass token in each hook call (more explicit but verbose)

### 8.3 Create Client/Program Management UI

Currently, you can only create clients/programs via SQL. You'll need to add:
- `POST /api/clients` - Create client
- `POST /api/programs` - Create program
- `POST /api/clients/:id/programs` - Link program to client

---

## Step 9: Common Issues & Solutions

### Issue: "JWT_SECRET environment variable is required"

**Solution:** Make sure `.env` file exists in `artifacts/api-server/` with `JWT_SECRET` set.

### Issue: "DATABASE_URL must be set"

**Solution:** Add `DATABASE_URL` to your `.env` file.

### Issue: Database connection fails

**Solutions:**
- Check `DATABASE_URL` format is correct
- Verify database is accessible from your network
- Check firewall rules on DigitalOcean
- Ensure SSL mode matches your database config

### Issue: 401 Unauthorized on protected routes

**Solutions:**
- Verify token is in `Authorization: Bearer <token>` format
- Check token hasn't expired (7 days default)
- Ensure `JWT_SECRET` matches between token creation and verification

### Issue: Empty clients/programs list

**This is normal!** The database starts empty. You need to:
- Create clients via SQL (or add `POST /api/clients` endpoint)
- Create programs via SQL (or add `POST /api/programs` endpoint)
- Link them via `client_programs` table

---

## Step 10: Next Development Tasks

1. **Add Client Management Endpoints:**
   - `POST /api/clients` - Create client
   - `PUT /api/clients/:id` - Update client
   - `DELETE /api/clients/:id` - Delete client

2. **Add Program Management Endpoints:**
   - `POST /api/programs` - Create program
   - `PUT /api/programs/:id` - Update program
   - `DELETE /api/programs/:id` - Delete program
   - `POST /api/clients/:id/programs` - Link program to client

3. **Add Note Listing:**
   - `GET /api/notes` - List all notes for company
   - `GET /api/notes/:id` - Get single note

4. **Frontend Auth:**
   - Login/Register pages
   - Token storage
   - Protected routes
   - Auto-refresh token

---

## Summary Checklist

- [ ] Set `DATABASE_URL` in `.env`
- [ ] Set `JWT_SECRET` in `.env`
- [ ] Run `pnpm --filter @workspace/db run push` to create tables
- [ ] Start API server: `pnpm --filter @workspace/api-server run dev`
- [ ] Test health endpoint: `curl http://localhost:3000/api/healthz`
- [ ] Register a user: `POST /api/auth/register`
- [ ] Login: `POST /api/auth/login`
- [ ] Test protected endpoint with token: `GET /api/clients` with `Authorization: Bearer <token>`
- [ ] Verify multi-tenancy (register second user, check data isolation)

---

## Need Help?

If you encounter issues:
1. Check the error message in the API server console
2. Verify environment variables are set correctly
3. Check database connection string format
4. Ensure all dependencies are installed (`pnpm install`)
