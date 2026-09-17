/**
 * ILPOA member access backend.
 * Bound to the "ILPOA Members" Google Sheet (Extensions > Apps Script).
 * Deployed as a Web App (Execute as: Me, Who has access: Anyone) and
 * called from the website via fetch(). See ../backend/SETUP.md.
 */

const SHEET_ID = '18qg93cGRIY2YKEs2G3YNo-OHZargCL_gjNesFLNUHi0';
const REQUESTS_SHEET = 'Requests';
const MEMBERS_SHEET = 'Members';
const HASH_ROUNDS = 1000; // simple stretching - Apps Script has no native slow-hash function

function getAdminEmail() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || Session.getEffectiveUser().getEmail();
}

function getSiteUrl() {
  return PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://andresdiplomacity.github.io/ilpoa/';
}

function getSheet(name) {
  // getActiveSpreadsheet() only resolves inside an editor/UI context - a Web
  // App request has none, so it returns null there even for a bound script.
  // openById works the same in every context (editor, trigger, or Web App).
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/** Run this once manually from the Apps Script editor (and again after schema changes) to (re)write headers and trigger the auth prompt. Safe to re-run - it never touches existing data rows. */
function ensureHeaders() {
  const req = getSheet(REQUESTS_SHEET);
  req.getRange(1, 1, 1, 10).setValues([['Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'Status', 'Processed At', 'Password Hash', 'Password Salt']]);
  req.setFrozenRows(1);

  const mem = getSheet(MEMBERS_SHEET);
  mem.getRange(1, 1, 1, 8).setValues([['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'Approved At', 'Password Hash', 'Password Salt']]);
  mem.setFrozenRows(1);
}

// ===== Password hashing =====
// Salted, stretched SHA-256. Not as strong as bcrypt/argon2 (Apps Script has
// no native slow-hash function), but proportionate here - plaintext is never
// stored, and this is a low-stakes community site, not a bank.

function makeSalt() {
  return Utilities.getUuid();
}

function hashPassword(password, salt) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password);
  for (let i = 0; i < HASH_ROUNDS; i++) {
    const asString = bytes.map((b) => String.fromCharCode((b + 256) % 256)).join('');
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + asString);
  }
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

// ===== Web app entry point =====

function doPost(e) {
  ensureHeaders();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'bad_request' });
  }
  try {
    switch (body.action) {
      case 'request_access': return handleRequestAccess(body);
      case 'login': return handleLogin(body);
      default: return jsonOut({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function findMemberRow(email) {
  const mem = getSheet(MEMBERS_SHEET);
  const data = mem.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === email) return i + 1; // 1-based sheet row
  }
  return -1;
}

// ===== Actions =====

function handleRequestAccess(body) {
  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  const address = (body.address || '').trim();
  const password = body.password || '';

  if (!firstName || !lastName || !email || !phone || !address || !password) {
    return jsonOut({ ok: false, error: 'missing_fields' });
  }
  if (password.length < 6) {
    return jsonOut({ ok: false, error: 'weak_password' });
  }
  if (findMemberRow(email) > 0) {
    return jsonOut({ ok: false, error: 'already_member' });
  }

  const req = getSheet(REQUESTS_SHEET);
  const data = req.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === email && data[i][6] === 'Pending') {
      return jsonOut({ ok: false, error: 'already_pending' });
    }
  }

  const salt = makeSalt();
  const hash = hashPassword(password, salt);
  req.appendRow([new Date(), firstName, lastName, email, phone, address, 'Pending', '', hash, salt]);

  MailApp.sendEmail({
    to: getAdminEmail(),
    subject: 'ILPOA — New member access request',
    body: `${firstName} ${lastName} (${email}, ${phone}) requested access.\nAddress: ${address}\n\nApprove or decline by editing the Status column (set it to "Approved" or "Declined") in the Requests sheet.`
  });
  MailApp.sendEmail({
    to: email,
    subject: 'Island Lake Association — Request received',
    body: `Hi ${firstName},\n\nWe received your request for member access to the Island Lake Association website. The site administrator will review it and email you once it's approved. This usually takes a few days.\n\n— Island Lake Association`
  });

  return jsonOut({ ok: true });
}

function handleLogin(body) {
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const genericError = jsonOut({ ok: false, error: 'invalid_credentials' });
  if (!email || !password) return genericError;

  const rowIndex = findMemberRow(email);
  if (rowIndex < 0) return genericError;

  const mem = getSheet(MEMBERS_SHEET);
  const storedHash = mem.getRange(rowIndex, 7).getValue();
  const storedSalt = mem.getRange(rowIndex, 8).getValue();
  if (!storedHash || !storedSalt) return genericError;

  if (hashPassword(password, storedSalt) !== storedHash) return genericError;

  const firstName = mem.getRange(rowIndex, 1).getValue();
  const lastName = mem.getRange(rowIndex, 2).getValue();
  return jsonOut({ ok: true, member: { firstName, lastName, email } });
}

// ===== Installable trigger =====
// Set up manually: Apps Script editor > Triggers (clock icon) > Add trigger
//   Function: onStatusEdit | Event source: From spreadsheet | Event type: On edit
function onStatusEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== REQUESTS_SHEET) return;
  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (col !== 7 || row === 1) return; // Status column only, skip header row

  const newStatus = String(e.value || '').trim();
  if (newStatus !== 'Approved' && newStatus !== 'Declined') return;

  const processedCell = sheet.getRange(row, 8);
  if (processedCell.getValue()) return; // already processed - avoid double-sending

  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const firstName = rowData[1], lastName = rowData[2], email = rowData[3], phone = rowData[4], address = rowData[5];
  const passwordHash = rowData[8], passwordSalt = rowData[9];

  if (newStatus === 'Approved') {
    if (findMemberRow(email) < 0) {
      getSheet(MEMBERS_SHEET).appendRow([firstName, lastName, email, phone, address, new Date(), passwordHash, passwordSalt]);
    }
    MailApp.sendEmail({
      to: email,
      subject: 'Your Island Lake Association account is approved',
      body: `Hi ${firstName},\n\nYour member access request has been approved. Visit the site and sign in with your email (${email}) and the password you chose when you requested access.\n\n${getSiteUrl()}\n\n— Island Lake Association`
    });
  } else {
    MailApp.sendEmail({
      to: email,
      subject: 'Island Lake Association — Access request update',
      body: `Hi ${firstName},\n\nWe're sorry, but your access request could not be approved at this time. If you believe this is a mistake, please reply to this email.\n\n— Island Lake Association`
    });
  }

  processedCell.setValue(new Date());
}
