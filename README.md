# Invexa · Inventory Cloud (Demo)

A fully interactive, browser-only demo of **Invexa** — an inventory & operations platform for
fresh / perishable food manufacturers (tofu, plant-based dairy alternatives, chilled ready-to-cook,
pickles & spreads). No server, no database: everything runs and is stored **encrypted** in the browser.

## Live demo
The site opens on a product landing page; **Sign in** or **Get started** leads to the login screen with the demo accounts below.
After GitHub Pages is enabled the app is served from the repository's Pages URL.

| Role | Email | Password | Access |
|---|---|---|---|
| Administrator | `admin@invexa.demo` | `Admin@2026` | All modules + settings |
| Inventory Manager | `stores@invexa.demo` | `Store@2026` | Inventory, production, purchasing, reports |
| Sales Executive | `sales@invexa.demo` | `Sales@2026` | Sales, customers, returns, stock visibility |

On first sign-in the app simulates **60 days of real operations** (production runs, purchases,
hub transfers, ~500 sales orders, returns, wastage, cold-room sensor readings) through the same
business logic the UI uses, so every module reconciles. Each module also has a
**✨ Generate sample data** button, and **Reset demo data** regenerates everything.

## Modules
- **Dashboard** – sales vs production, inventory value, receivables, expiry risk, cold-chain status, action centre
- **Items & Catalog** – finished goods, raw materials, packaging; live stock, reorder levels, margins
- **Batches & Expiry** – lot tracking, FEFO, shelf-life progress, one-click **recall trace**
  (raw lot → production batch → customer invoice)
- **Warehouses & Cold Chain** – plant cold room, dry store, distribution hubs; temperature logs & excursions
- **Stock Adjustments** – damage, expiry write-off, cycle count, QC samples (value impact)
- **Stock Transfers** – reefer transfers with FEFO auto-picking and in-transit tracking
- **Production Orders** – recipe-driven material issue (FEFO), QC release (pH, core temp, micro), yield & unit cost
- **Recipes (BOM)** – formulations with cost roll-up and margin
- **Purchase Orders & Vendors** – reorder suggestions, goods receipt with vendor lot / mfg / expiry capture
- **Sales Orders & Customers** – credit limits, channel discounts, FEFO dispatch, GST tax invoice (CGST/SGST/IGST), payments
- **Returns & Credit Notes** – batch-level restock / scrap disposition
- **Reports** – stock summary, valuation, expiry ageing, wastage, stock ledger, sales by product/customer,
  GST (HSN) summary, production yield, purchase register — all exportable to CSV
- **Audit Log**, **Settings** – organization, users & roles, security, preferences, subscription, backup

## Security model (client-side)
- Passwords are never stored: PBKDF2-HMAC-SHA256 (210k iterations, per-user 128-bit salt) → SHA-256 verifier
- All business data is gzip-compressed and encrypted with **AES-256-GCM** using a random data key (DEK)
- The DEK is wrapped per user with a key derived from that user's password (envelope encryption)
- Tab-scoped session, 4-hour idle auto-lock, brute-force throttling, role-based route guards
- Settings → Security → *View raw stored data* shows exactly what is persisted (ciphertext only)

> Demo note: a browser-only app cannot protect against someone with access to the open, unlocked tab.
> In production these controls move server-side.

## Run locally
Any static server works (Web Crypto needs `http://localhost` or HTTPS):
```bash
npx serve .        # or: python -m http.server 8080
```

## Deploy
- **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root.
- **Vercel:** "Add New Project" → import this repository → Framework preset *Other* → Deploy (no build step).

Built with vanilla JavaScript, Chart.js and the Web Crypto API.
