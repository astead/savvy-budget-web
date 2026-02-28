# Admin Page – Feasibility & Task Breakdown

## Feasibility Assessment

**Yes, fully feasible with low risk.** Everything needed already exists in the codebase:

| Requirement | Existing foundation |
|---|---|
| Secure admin-only access | Auth0 JWT middleware + `req.user_id` resolved per request; bitfield `subscriptionLevel` in `users` table |
| Admin role | `subscriptionLevel` is already a bitfield (`FREE=0`, `LINKED_BANK_ACCOUNTS=1`). Adding `ADMIN=128` is non-breaking. |
| List all users + Plaid accounts | `users` and `plaid_account` tables exist; admin queries skip per-user RLS by not setting `myapp.current_user_id` |
| Detect orphaned Plaid items | `plaid_account` has `isActive`, `isLinked`, `access_token` (nullable) columns; cross-user query is straightforward |
| Unlink a Plaid account | `remove_plaid_login(trx, userId, accountId)` already exists server-side; `PLAID_REMOVE_LOGIN` channel constant already declared |

---

## Security Design

### Admin bit in the subscription bitfield

```
SubscriptionLevels = {
  FREE:                 0,    // 0000 0000
  LINKED_BANK_ACCOUNTS: 1,   // 0000 0001
  ADMIN:              128,   // 1000 0000  ← new
}
```

- Setting this is a one-time manual SQL update on your own account:
  ```sql
  UPDATE users SET "subscriptionLevel" = "subscriptionLevel" | 128 WHERE auth0_id = '<your-auth0-sub>';
  ```
- The existing `hasSubscription(level, flag)` bitmask helper works unchanged.
- No UI to grant admin — intentional. Only a direct DB write can elevate to admin.

### `requireAdmin` server middleware

A new Express middleware added **after** `bypassJwtCheck`, applied only to `/admin/*` routes:

```js
const requireAdmin = async (req, res, next) => {
  const level = await getSubscriptionLevel(req.user_id);
  if (!hasSubscription(level, SubscriptionLevels.ADMIN)) {
    return res.status(403).send('Forbidden');
  }
  next();
};
```

Admin endpoints are mounted under a dedicated prefix (e.g. `/api/admin/`) so a single `app.use('/api/admin/', requireAdmin)` covers all of them.

### Frontend route guard

A new `AdminRoute` wrapper component (mirrors existing `PrivateRoute`) that:
1. Calls `GET_PROFILE` to fetch `subscriptionLevel`
2. Renders children only if the admin bit is set; otherwise redirects to `/`
3. Shows a loading state while the profile is fetching

---

## Task Breakdown

### Phase 1 – Server: Admin role infrastructure

**1.1 – Add `ADMIN` to `SubscriptionLevels` and `hasSubscription` (server)**
- In `server.js`, add `ADMIN: 128` to the `SubscriptionLevels` constant.
- No logic changes needed; `hasSubscription()` already handles it.

**1.2 – Write `requireAdmin` middleware**
- New function in `server.js` (or a separate `middleware/admin.js`).
- Calls `getSubscriptionLevel(req.user_id)` and checks the `ADMIN` bit.
- Returns HTTP 403 if not admin.

**1.3 – Add new channel constants**
- In `src/shared/constants.js`, add:
  ```js
  ADMIN_GET_USERS:           'admin_get_users',
  ADMIN_GET_PLAID_ACCOUNTS:  'admin_get_plaid_accounts',
  ADMIN_REMOVE_PLAID_ACCOUNT:'admin_remove_plaid_account',
  ```

**1.4 – Set admin bit on your own account**
- One-time manual SQL:
  ```sql
  UPDATE users SET "subscriptionLevel" = "subscriptionLevel" | 128
  WHERE auth0_id = '<your-auth0-sub>';
  ```

---

### Phase 2 – Server: Admin API endpoints

All endpoints are protected by `requireAdmin`. They do **not** set `myapp.current_user_id` (so they bypass row-level security and can see all users' data).

**2.1 – `POST /api/admin/admin_get_users`**

Returns a summary of every user:

```json
[
  {
    "id": 3,
    "email": "user@example.com",
    "name": "Jane Doe",
    "subscriptionLevel": 1,
    "plaidAccountCount": 4,
    "linkedPlaidCount": 3
  }
]
```

Query: `JOIN users LEFT JOIN plaid_account ON plaid_account.user_id = users.id GROUP BY users.id`. No `SET myapp.current_user_id` needed since admin bypasses RLS.

**2.2 – `POST /api/admin/admin_get_plaid_accounts`**

Returns every `plaid_account` row with the owning user's email, including a computed `isOrphaned` flag:

```json
[
  {
    "id": 12,
    "user_id": 3,
    "user_email": "user@example.com",
    "institution_name": "Chase",
    "full_account_name": "Chase-Checking-1234",
    "item_id": "abc123",
    "isActive": true,
    "isLinked": false,
    "hasAccessToken": true,
    "isOrphaned": false
  }
]
```

`isOrphaned` definition: `isLinked = false` AND `access_token IS NOT NULL` (Plaid is still billing for the item but the app considers it unlinked).

**2.3 – `POST /api/admin/admin_remove_plaid_account`**

Body: `{ userId, accountId }`

Calls the existing `remove_plaid_login(trx, userId, accountId)` — the same function used by `UPDATE_SUBSCRIPTION`. Returns 200 on success, 500 on error.

---

### Phase 3 – Frontend: Admin route guard

**3.1 – `AdminRoute` component** (`src/components/AdminRoute.tsx`)
- Fetches `subscriptionLevel` via `GET_PROFILE`.
- Renders `<Outlet />` (or children) if admin bit is set.
- Redirects to `/` if not admin or if loading fails.
- Shows a spinner while loading.

**3.2 – Wire `AdminRoute` into the router** (`src/App.tsx`)
- Add a new `<Route>` for `/Admin` wrapped in `AdminRoute`.

---

### Phase 4 – Frontend: Admin page UI

**4.1 – `Admin.tsx` page component** (`src/components/Admin.tsx`)

Sections:

1. **User Summary table**
   - Columns: Email, Name, Subscription level (human-readable flags), # Plaid accounts, # Linked
   - Source: `ADMIN_GET_USERS`

2. **Plaid Accounts table**
   - Columns: Owner email, Institution, Account name, Item ID, Active, Linked, Has token, Orphaned
   - Highlight orphaned rows (red background or badge)
   - Source: `ADMIN_GET_PLAID_ACCOUNTS`
   - Filter control: "Show orphaned only" checkbox

3. **Unlink button (per row)**
   - Calls `ADMIN_REMOVE_PLAID_ACCOUNT` with `{ userId, accountId }`.
   - Confirmation dialog before proceeding ("This will call Plaid's `/item/remove` and cannot be undone.").
   - On success: removes the row from local state.
   - On error: shows an inline error message on the row.

**4.2 – Link to Admin page in the nav/header**
- Show "Admin" link in the header only when the user's `subscriptionLevel` has the admin bit set.
- Check should use the same `hasSubscription` helper (ported to the frontend, or evaluated once on profile load and stored in context).

---

### Phase 5 – Hardening

**5.1 – Input validation on admin endpoints**
- Validate `userId` and `accountId` are integers before using them in queries.
- Verify the `plaid_account` row actually belongs to `userId` before calling `remove_plaid_login` (prevents an admin from accidentally targeting wrong data via a tampered request body).

**5.2 – Audit logging (optional but recommended)**
- Log unlink actions to the server console (or a DB `audit_log` table): timestamp, admin `user_id`, target `user_id`, `account_id`, `institution_name`.

**5.3 – Error handling on the frontend**
- Handle 403 gracefully (redirect or show "Access denied").
- Handle network errors per operation without crashing the page.

---

## Implementation Order

```
1.1 → 1.2 → 1.3 → 1.4   (server role + constants, manual DB update)
       ↓
2.1 → 2.2 → 2.3           (admin endpoints, testable via curl/Postman)
       ↓
3.1 → 3.2                 (frontend route guard)
       ↓
4.1 → 4.2                 (admin page UI)
       ↓
5.1 → 5.2 → 5.3           (hardening)
```

Total estimated files touched: `server.js`, `constants.js`, `App.tsx`, + 2 new files (`AdminRoute.tsx`, `Admin.tsx`).
