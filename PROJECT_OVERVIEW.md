# S R Mobile POS — Project Structure & Progress

## Project Structure Overview

Your project is a **React + Node.js POS system** for S R Mobile, with a clear separation between backend and frontend:

```
mobile-shop-pos/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── categories.js
│   │   ├── customers.js
│   │   ├── dashboard.js
│   │   ├── debt.js
│   │   ├── invoice.js
│   │   ├── notifications.js
│   │   ├── products.js
│   │   ├── repairs.js
│   │   └── sales.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── whatsapp.js
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   ├── AiWidget.jsx
│       │   ├── Layout.jsx
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── ScannerContext.jsx
│       └── pages/
│           ├── Analytics.jsx
│           ├── Billing.jsx
│           ├── Categories.jsx
│           ├── CustomerDetail.jsx
│           ├── Customers.jsx
│           ├── Dashboard.jsx
│           ├── Login.jsx
│           ├── Notifications.jsx
│           ├── Products.jsx
│           ├── PublicInvoice.jsx
│           ├── RepairDetail.jsx
│           ├── Repairs.jsx
│           ├── SaleSuccess.jsx
```

---

## Main Features & Functions

### Backend
- **API Endpoints:** For products, sales, customers, repairs, analytics, notifications, authentication, and AI.
- **Prisma ORM:** Handles database models (products, sales, customers, etc.).
- **Authentication:** Middleware for protected routes.
- **Analytics:** Provides monthly, product, trend, and customer analytics.
- **WhatsApp Integration:** Utility for sending messages.
- **File Uploads:** For product/customer images.

### Frontend
- **Login & Auth:** Secure login, context-based session management.
- **Dashboard:** Overview of sales, customers, repairs.
- **Analytics:** Visual charts for revenue, profit, trends, top products, and customer insights.
- **Billing:** Cart, product scan, discount (optional/collapsible), payment, and sale completion.
- **Products & Categories:** Management, search, and filtering.
- **Customers:** List, search, add, edit, deactivate/reactivate, and delete (with debt checks).
- **Repairs:** Track and manage repair jobs.
- **Notifications:** System notifications for users.
- **AI Widget:** Chatbot for quick help or suggestions.
- **Sale Success:** Invoice and summary after sale.

---

## Current Progress

- **Backend:** All analytics endpoints are robust (try-catch, never hang), and all main business logic is implemented.
- **Frontend:** All main pages are present. Billing page has scroll and discount UI fixes. Analytics page is modern, fast, and handles empty states gracefully.
- **GitHub:** All code is committed and pushed to the `main` branch.
- **Servers:** Both backend and frontend can be started independently for development.

---

## What’s Working

- Analytics loads quickly and never hangs.
- Billing page is fully scrollable; discount is optional and collapsible.
- All CRUD operations for products, customers, and repairs.
- Customer management supports deactivate/reactivate and safe delete.
- Sale flow is robust, with discount and credit support.
- Modern UI with Tailwind CSS and responsive design.

---

If you want a **detailed explanation of any specific file, feature, or workflow**, let me know!
