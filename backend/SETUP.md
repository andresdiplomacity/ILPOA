# ILPOA member backend — setup

One-time setup, done from the dedicated ILPOA Google account (the one that owns the Members sheet and sends the emails).

1. Go to sheets.google.com, create a new blank spreadsheet. Name it "ILPOA Members".
2. Extensions → Apps Script. Delete the placeholder `myFunction() {}` code and paste in the full contents of `Code.gs` (in this same folder).
3. Save the project (any name, e.g. "ILPOA backend").
4. In the function dropdown at the top, select `ensureHeaders`, click Run. The first run asks you to authorize — click through "Review permissions" → pick the account → "Advanced" → "Go to ILPOA backend (unsafe)" → Allow. (This warning is normal for a script you wrote yourself; it just means Google hasn't reviewed it, not that anything is actually wrong.) This creates the "Requests" and "Members" tabs with their column headers.
5. Gear icon (Project Settings) → Script Properties → Add property:
   - `ADMIN_EMAIL` = the address that should get "new request" notifications
   - `SITE_URL` = `https://andresdiplomacity.github.io/ilpoa/`
6. Deploy → New deployment → gear icon next to "Select type" → Web app.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy → Authorize again if asked.
   - Copy the **Web app URL** (ends in `/exec`). Send this to Claude — the site needs it.
7. Clock icon (Triggers, left sidebar) → Add Trigger:
   - Function: `onStatusEdit`
   - Event source: From spreadsheet
   - Event type: On edit
   - Save (authorize again if asked).
8. Double check the Sheet's own sharing setting (Share button, top right) is **Restricted** (private) — it holds password hashes and members' contact info, and should never be "Anyone with the link."

That's it. From here on:
- A visitor submitting "Request access" on the site sets their own password, and appends a row to **Requests**; emails go to `ADMIN_EMAIL` and the requester.
- To approve or decline: open the Sheet, find the row, change the **Status** cell to exactly `Approved` or `Declined`. The trigger fires automatically, moves approved people into **Members** (carrying their password hash along), and emails them.
- A member signs in with their email and that password, every time (no persistent session).
- "Reset password" emails a 30-minute one-time link to set a new one, the same never-reveal-membership pattern as signup.

## Updating the code later

If the logic ever needs to change, edit `Code.gs` here, then paste the updated version into the Apps Script editor (Extensions → Apps Script from the Sheet) and save — no redeploy needed for logic changes, since the existing Web App deployment picks up the latest saved code automatically. You only need "New deployment" again if you want a new URL; otherwise use "Manage deployments" → the pencil/edit icon → "New version" to push code changes to the *same* URL.

## Security notes

- Passwords are salted + stretched-SHA256 hashed before they ever touch the sheet; the plaintext is never stored anywhere.
- `SHEET_ID` and the deployed Web App URL are public (they're committed in this repo / shipped in the site's HTML) — that's normal for this architecture, not a leak. What actually protects the data is: the Sheet's own sharing permissions (keep it Restricted), and the backend's password hashing + generic error messages (never reveals whether an email is registered).
- Don't commit real email addresses, the Script Properties values, or anything else account-specific into this repo — keep those in Script Properties / told to Claude in chat, not in files that get pushed.
