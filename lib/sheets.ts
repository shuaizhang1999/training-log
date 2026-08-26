import { google, type sheets_v4 } from "googleapis";
import { getPrivateKey, requireEnv } from "./env";

/**
 * All Google Sheets access lives here and runs server-side only (Node runtime).
 * The sheet is the source of truth and is treated as append-only: this module
 * can read the Log tab and append rows to it — nothing else. It never updates
 * or deletes existing cells and never touches other tabs.
 */

const TAB = "Log";
/** Data rows start at row 4 (rows 1–3 are headers). */
const READ_RANGE = `'${TAB}'!A4:K`;
/** Append searches this range for the existing table and adds a row after it. */
const APPEND_RANGE = `'${TAB}'!A:K`;

let cachedClient: sheets_v4.Sheets | null = null;

function sheets(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.JWT({
    email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/**
 * Every data row of the Log tab. UNFORMATTED_VALUE gives real numbers regardless
 * of the sheet's display locale (34.3, not "34,3"); dates may come back as
 * Google serial numbers, which the row codec normalizes.
 */
export async function readAllRows(): Promise<unknown[][]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: requireEnv("SHEET_ID"),
    range: READ_RANGE,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  return (res.data.values ?? []) as unknown[][];
}

/** Append exactly one row after the last existing row. Never overwrites. */
export async function appendRow(cells: (string | number)[]): Promise<void> {
  await sheets().spreadsheets.values.append({
    spreadsheetId: requireEnv("SHEET_ID"),
    range: APPEND_RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [cells] },
  });
}
