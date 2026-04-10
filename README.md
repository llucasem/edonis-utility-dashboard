# TDM Utilities Dashboard

Internal utility bill management dashboard for **The Dream Management LLC** — a short-term rental company managing ~67 properties across New York, Los Angeles, Palm Springs, and Oslo.

## What it does

Replaces the manual process of logging into 50+ utility accounts one by one. The system automatically reads emails from the Gmail "Utilities" folder, extracts bill data using AI, and presents everything in a clean dashboard organized by service type and month.

- **Tabs** by utility type: Electricity, Internet, Gas, Rent, Insurance, Other
- **Monthly view** — all stats, counts, and tables filtered by selected month
- **Account mapping** — map utility account numbers to properties once; all current and future bills update automatically
- **Sync** — manual sync button + automatic daily cron job
- **QuickBooks export** — CSV export compatible with QuickBooks
- **Bill detail** — direct link to original Gmail email for each bill

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19 |
| Database | Neon (PostgreSQL) |
| Email source | Gmail API (OAuth 2.0) |
| AI parser | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Deployment | Vercel |

## Project structure

```
app/
  page.js                        # Main dashboard
  admin/page.js                  # Account mapping admin screen
  api/
    bills/route.js               # GET — serve bills from database
    sync/route.js                # GET — sync new emails from Gmail
    account-mappings/route.js    # GET/POST — manage account mappings
    account-mappings/unmapped/   # GET — accounts without a property assigned
components/                      # UI components (TopBar, TabNav, BillsTable, etc.)
lib/
  gmail.js                       # Gmail OAuth2 connection
  parser.js                      # Claude AI email parser
  db.js                          # Neon PostgreSQL connection
scripts/
  get-gmail-token.js             # One-time OAuth setup script
  run-sync.mjs                   # Full historical sync (no timeout)
  reprocess-addresses.mjs        # Reprocess bills missing property address
```

## Environment variables

Create a `.env.local` file at the root with the following variables:

```
DATABASE_URL=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER=
ANTHROPIC_API_KEY=
```

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
