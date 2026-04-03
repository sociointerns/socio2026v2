# Archive Feature Debug Report

## Issues Found

### Issue #1: Field Name Mismatch (CRITICAL)
**Problem:**
- Backend database: `events.fest_id` (TEXT column)
- Frontend context: `FetchedEvent.fest` (string property)
- Mismatch: Backend returns `fest_id`, but frontend code expects `fest`

**Evidence:**
- [EventContext.tsx](client/context/EventContext.tsx#L57): `fest: string;` (NOT fest_id)
- [manage/page.tsx](client/app/manage/page.tsx#L830): Tries to match `event.fest === festId`
- [eventRoutes_secured.js GET](server/routes/eventRoutes_secured.js#L165): Returns raw events with `fest_id`

**Impact:** 
When archiving a fest, frontend tries `event.fest === festId` but `event.fest` is always undefined since backend returns `fest_id`. Cascade update doesn't work.

**Fix Required:** Backend must map `fest_id` → `fest` in GET response

---

### Issue #2: Archive Columns May Not Exist in Database
**Problem:**
- [FIX_FEST_EVENT_CONNECTION.sql](FIX_FEST_EVENT_CONNECTION.sql) creates columns but hasn't been executed in Supabase
- If columns don't exist, ALL archive operations will fail silently

**Columns Needed:**
- `events.is_archived` (BOOLEAN NOT NULL DEFAULT FALSE)
- `events.archived_at` (TIMESTAMPTZ NULL)
- `events.archived_by` (TEXT NULL)
- Same for `fests` table

**Fix Required:** Run migration in Supabase

---

### Issue #3: Backend Fest Archive Uses Wrong Field Name
**Problem:**
- [festRoutes.js line 619](server/routes/festRoutes.js#L619): `{ fest_id: festId }`
- Should query events table correctly

**Note:** This is actually correct IF the fest_id column exists in events table

---

## Action Plan

1. **Step A:** Verify/create archive columns in Supabase
2. **Step B:** Fix backend response to map `fest_id` → `fest`
3. **Step C:** Verify cascade archive works end-to-end
