# ILPOA member backend — setup

One-time setup, done from the REDACTED_ADMIN_EMAIL Google account.

1. Go to sheets.google.com, create a new blank spreadsheet. Name it "ILPOA Members".
2. Extensions → Apps Script. Delete the placeholder `myFunction() {}` code and paste in the full contents of `Code.gs` (in this same folder).
3. Save the project (any name, e.g. "ILPOA backend").
4. In the function dropdown at the top, select `ensureHeaders`, click Run. The first run asks you to authorize — click through "Review permissions" → pick the REDACTED_ADMIN account → "Advanced" → "Go to ILPOA backend (unsafe)" → Allow. (This warning is normal for a script you wrote yourself; it just means Google hasn't reviewed it, not that anything is actually wrong.) This creates the "Requests" and "Members" tabs with their column headers.
5. Gear icon (Project Settings) → Script Properties → Add property:
   - `ADMIN_EMAIL` = `REDACTED_ADMIN_EMAIL`
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

That's it. From here on:
- A visitor submitting "Request access" on the site appends a row to **Requests** and emails REDACTED_ADMIN_EMAIL + the requester.
- To approve or decline: open the Sheet, find the row, change the **Status** cell to exactly `Approved` or `Declined`. The trigger fires automatically, moves approved people into **Members**, and emails them.
- A member signs in by entering their email; they get a one-time link by email (valid 30 minutes) instead of a password.

## Updating the code later

If the logic ever needs to change, edit `Code.gs` here, then paste the updated version into the Apps Script editor (Extensions → Apps Script from the Sheet) and save — no redeploy needed for logic changes, since the existing Web App deployment picks up the latest saved code automatically. You only need "New deployment" again if you want a new URL; otherwise use "Manage deployments" → the pencil/edit icon → "New version" to push code changes to the *same* URL.
