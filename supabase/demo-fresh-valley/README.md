# Fresh Valley Produce — demo workspace

A complete, coherent demo dataset for **demo@vyso.co.za**: a Cape Town fruit & veg
wholesale distributor doing ~R7M/month (fluctuating R6.4M–R8.1M) with **40 staff**.

Seeding the demo org is also how the demo is **gated**: each module reads
per-org data, so the seeded demo org shows the rich data while every other
account (e.g. test@example.com) stays empty until its own data is entered.

## Prerequisite — create the login (you must do this; Claude can't)

Supabase dashboard → **Authentication → Users → Add user**
- Email: `demo@vyso.co.za`
- Password: `1234`
- Tick **Auto Confirm User**

## Apply order (paste each into the Supabase SQL editor, run once)

1. `0-bootstrap.sql` — creates the **Fresh Valley Produce** org, links the demo
   user's profile to it, enables every module. (Run AFTER creating the login above.)
2. Schemas (create tables + RLS; idempotent, safe to re-run):
   - `1-shiftboard-schema.sql`
   - `2-wastewatch-schema.sql`
   - `3-planwise-schema.sql`
   - `4-supplysync-schema.sql`
   - `5-insightgen-schema.sql`
3. Seeds (insert the demo data; re-runnable — each deletes the org's rows first):
   - `1-shiftboard-seed.sql`
   - `2-wastewatch-seed.sql`
   - `3-planwise-seed.sql`
   - `4-supplysync-seed.sql`
   - `5-insightgen-seed.sql`

> Tip: you can paste all five schema files in one go, then all five seed files.

## What's seeded

| Module | Tables | Highlights |
|---|---|---|
| ShiftBoard | `sb_departments`, `sb_employees`, `sb_roster_shifts`, `sb_attendance`, `sb_leave_requests` | 40 employees across 7 departments, weekly roster, today's attendance, leave requests |
| WasteWatch | `ww_waste_categories`, `ww_devices`, `ww_waste_events` | Produce waste (~R23k/wk), 7 scales/stations, operator + recipe links |
| PlanWise | `pw_budget_lines`, `pw_goals`, `pw_forecast`, `pw_scenarios` | R7M revenue, ~78% COGS, 12-month forecast, what-if scenarios |
| SupplySync | `ss_suppliers`, `ss_supplier_documents` | 12 fresh-produce suppliers with ratings, risk, compliance docs |
| InsightGen | `ig_insights`, `ig_reports` | Cross-module AI insights + saved report definitions |

## Note

The module UIs still need to be **wired** to read these tables (Phase 2) — until
then they render the in-code mock data. Once wired, `demo@vyso.co.za` shows this
dataset and unseeded accounts show empty states.
