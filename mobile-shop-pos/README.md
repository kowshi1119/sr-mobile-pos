# S R Mobile — POS System
## Complete Setup Guide

---

## 🔐 ADMIN LOGIN CREDENTIALS

```
Email:    admin@srmobile.lk
Password: Admin@SR2024
```

> ⚠️  Change the password after first login by re-running the hash script with a new password.

---

## 📁 PROJECT STRUCTURE

```
mobile-shop-pos/
├── backend/
│   ├── prisma/schema.prisma     ← Database schema
│   ├── routes/                  ← All API routes
│   ├── middleware/auth.js       ← JWT middleware
│   ├── utils/whatsapp.js        ← Meta WhatsApp API
│   ├── scripts/hashPassword.js  ← Password hash generator
│   └── server.js                ← Entry point
└── frontend/
    ├── src/
    │   ├── pages/               ← All screens
    │   ├── components/          ← Layout, AiWidget
    │   ├── context/             ← Auth context
    │   └── api/client.js        ← Axios instance
    └── vercel.json
```

---

## ⚡ PHASE 1 — LOCAL SETUP

### Prerequisites
- Node.js v18+ installed
- Git installed

### Step 1 — Clone / Extract project
```bash
cd mobile-shop-pos
```

### Step 2 — Generate Admin Password Hash
```bash
cd backend
npm install
node scripts/hashPassword.js Admin@SR2024
```
Copy the hash output. You'll need it in your `.env`.

---

## ⚡ PHASE 2 — SUPABASE (Free Database)

1. Go to **https://supabase.com** → New Project
2. Fill in: Project Name = `sr-mobile-pos`, set a DB password, choose region (closest)
3. After creation → **Settings → Database → Connection string → URI**
4. Copy the URI — it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
5. Replace `[PASSWORD]` with your actual DB password

---

## ⚡ PHASE 3 — CLOUDINARY (Free Image Storage)

1. Go to **https://cloudinary.com** → Sign up free
2. Dashboard shows: **Cloud Name**, **API Key**, **API Secret**
3. Note all three values

---

## ⚡ PHASE 4 — GROQ API (Free AI)

1. Go to **https://console.groq.com** → Sign up
2. API Keys → Create API Key
3. Copy the key (starts with `gsk_...`)

---

## ⚡ PHASE 5 — META WHATSAPP API (Free Tier)

1. Go to **https://developers.facebook.com** → Create App → Business type
2. Add **WhatsApp** product to your app
3. Under WhatsApp → API Setup:
   - Copy **Phone Number ID**
   - Copy **WhatsApp Business Account ID**
   - Generate a **Permanent Access Token** (use System User in Meta Business Suite)
4. Register your WhatsApp templates in **Meta Business Suite → Account Tools → Message Templates**:

   **Template 1:**
   - Name: `invoice_notification`
   - Category: `UTILITY`
   - Body: `Thank you for shopping with us. Invoice No: {{1}}. Total: LKR {{2}}. View your invoice: {{3}}. Please keep this for warranty reference.`

   **Template 2:**
   - Name: `repair_ready`
   - Category: `UTILITY`
   - Body: `Hi {{1}}, your device {{2}} is ready for pickup at our shop. Please bring this message as reference. Thank you.`

5. Submit both for approval (usually instant for UTILITY)

---

## ⚡ PHASE 6 — BACKEND .env FILE

Create `backend/.env` with all your values:

```env
DATABASE_URL=postgresql://postgres:YOUR_DB_PASS@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=sr_mobile_jwt_secret_chunnakam_2024_very_long_string
ADMIN_EMAIL=admin@srmobile.lk
ADMIN_PASSWORD=PASTE_YOUR_BCRYPT_HASH_FROM_STEP_2_HERE

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

META_WHATSAPP_TOKEN=your_permanent_access_token
META_PHONE_NUMBER_ID=your_phone_number_id
META_WHATSAPP_BUSINESS_ID=your_waba_id
META_WEBHOOK_VERIFY_TOKEN=sr_mobile_verify

GROQ_API_KEY=gsk_your_groq_key_here

FRONTEND_URL=http://localhost:3000
PORT=5000
```

---

## ⚡ PHASE 7 — RUN DATABASE MIGRATIONS

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all tables in Supabase.

---

## ⚡ PHASE 8 — RUN LOCALLY

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Running on http://localhost:5000
# Health: http://localhost:5000/api/health
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:5000/api
npm run dev
# Running on http://localhost:3000
```

Open **http://localhost:3000** → Login with `admin@srmobile.lk` / `Admin@SR2024`

---

## ⚡ PHASE 9 — DEPLOY BACKEND TO RENDER

1. Push your project to GitHub
2. Go to **https://render.com** → New Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Add all Environment Variables from your `.env` file in Render dashboard
6. Change `FRONTEND_URL` to your Vercel URL (you'll set this after deploying frontend)
7. Deploy — copy your Render URL: `https://sr-mobile-pos-backend.onrender.com`

---

## ⚡ PHASE 10 — DEPLOY FRONTEND TO VERCEL

1. Go to **https://vercel.com** → New Project
2. Import your GitHub repo
3. Settings:
   - **Root Directory:** `frontend`
   - **Framework:** Vite
4. Add Environment Variable:
   - `VITE_API_URL` = `https://sr-mobile-pos-backend.onrender.com/api`
5. Deploy — copy your Vercel URL: `https://sr-mobile-pos.vercel.app`
6. Go back to Render → Update `FRONTEND_URL` to your Vercel URL → Redeploy

---

## ⚡ PHASE 11 — UPTIMEROBOT (Keep Render Awake)

1. Go to **https://uptimerobot.com** → Sign up free
2. New Monitor:
   - Type: **HTTP(s)**
   - Friendly Name: `SR Mobile POS Backend`
   - URL: `https://sr-mobile-pos-backend.onrender.com/api/health`
   - Monitoring Interval: **5 minutes**
3. Save — your backend stays awake 24/7

---

## ⚡ PHASE 12 — META WEBHOOK SETUP (Optional, for delivery receipts)

1. In Meta Developer Dashboard → WhatsApp → Configuration
2. Webhook URL: `https://sr-mobile-pos-backend.onrender.com/api/notifications/webhook`
3. Verify Token: `sr_mobile_verify`
4. Subscribe to: `messages`

---

## 🎯 ALL SETUP COMMANDS SUMMARY

```bash
# 1. Install backend deps + generate password hash
cd backend && npm install
node scripts/hashPassword.js Admin@SR2024

# 2. Create .env (paste values from Supabase, Cloudinary, Groq, Meta)
cp .env.example .env
# edit .env with your values

# 3. Run DB migrations
npx prisma migrate dev --name init

# 4. Start backend
npm run dev

# 5. In a new terminal — install + start frontend
cd ../frontend && npm install
cp .env.example .env
# edit: VITE_API_URL=http://localhost:5000/api
npm run dev
```

---

## 🚀 FEATURES BUILT

| Feature | Status |
|---------|--------|
| Admin Login (JWT) | ✅ |
| Dashboard with live stats | ✅ |
| Product management + image upload | ✅ |
| Category management | ✅ |
| IMEI tracking per phone | ✅ |
| QR code generation + download | ✅ |
| Billing with barcode scanner (USB HID) | ✅ |
| Billing with camera QR scan | ✅ |
| Cart with IMEI selector | ✅ |
| Complete sale (Prisma transaction) | ✅ |
| Stock auto-deduction | ✅ |
| Warranty auto-calculation | ✅ |
| Invoice QR code | ✅ |
| Receipt printing (window.print) | ✅ |
| Public invoice page for customers | ✅ |
| WhatsApp invoice notification | ✅ |
| Customer management | ✅ |
| Repair intake + status tracking | ✅ |
| WhatsApp repair-ready notification | ✅ |
| AI Assistant (Groq llama-3.3-70b) | ✅ |
| WhatsApp message log | ✅ |
| UptimeRobot keep-alive endpoint | ✅ |
| Low stock alerts on dashboard | ✅ |

---

## 📞 SHOP DETAILS EMBEDDED IN SYSTEM

| Field | Value |
|-------|-------|
| Shop Name | S R Mobile |
| Address | Station Road, Sivan Kovil Opposite, Chunnakam |
| Phone | 0765 733 434 |
| WhatsApp | +94 765 733 434 |
| Admin Email | admin@srmobile.lk |
| Default Password | Admin@SR2024 |

---

## ⚠️ SECURITY CHECKLIST BEFORE GO-LIVE

- [ ] Change `Admin@SR2024` password → run `node scripts/hashPassword.js YOUR_NEW_PASS` and update `.env`
- [ ] Set a strong random `JWT_SECRET` (32+ chars)
- [ ] Set a strong `META_WEBHOOK_VERIFY_TOKEN`
- [ ] Never commit `.env` to GitHub (it's in `.gitignore`)
- [ ] Enable 2FA on Supabase, Cloudinary, Groq, Meta accounts

---

*Built for S R Mobile, Chunnakam — 100% free tools, zero monthly cost.*
