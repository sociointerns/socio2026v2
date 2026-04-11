#!/usr/bin/env node

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

function parseArgs(argv) {
  const options = {
    file: "",
    sheet: "",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (current.startsWith("--file=")) {
      options.file = current.slice("--file=".length);
      continue;
    }

    if (current === "--file") {
      options.file = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (current.startsWith("--sheet=")) {
      options.sheet = current.slice("--sheet=".length);
      continue;
    }

    if (current === "--sheet") {
      options.sheet = argv[index + 1] || "";
      index += 1;
      continue;
    }
  }

  return options;
}

function getConnectionString() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || null;
}

function getDbClient() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL (or DATABASE_URL). Add it to server/.env before running the seed script."
    );
  }

  const useSsl = (process.env.DB_SSL || "true").toLowerCase() !== "false";

  return new Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase();
}

function resolveHeader(headers, candidates, fallbackToken) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const match = normalizedHeaders.find((header) => header.normalized === normalizedCandidate);
    if (match) {
      return match.original;
    }
  }

  const tokenMatch = normalizedHeaders.find((header) => header.normalized.includes(fallbackToken));
  return tokenMatch ? tokenMatch.original : "";
}

function readSheetRows(filePath, explicitSheetName) {
  const workbook = XLSX.readFile(filePath);
  const availableSheets = workbook.SheetNames || [];

  if (availableSheets.length === 0) {
    throw new Error("Workbook has no sheets.");
  }

  const selectedSheetName = explicitSheetName || availableSheets[0];
  if (!availableSheets.includes(selectedSheetName)) {
    throw new Error(
      `Sheet \"${selectedSheetName}\" not found. Available sheets: ${availableSheets.join(", ")}`
    );
  }

  const worksheet = workbook.Sheets[selectedSheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!Array.isArray(matrix) || matrix.length < 2) {
    throw new Error("Sheet does not contain header + data rows.");
  }

  const headers = (matrix[0] || []).map((header) => normalizeText(header));
  const rows = matrix.slice(1);

  return {
    sheetName: selectedSheetName,
    headers,
    rows,
  };
}

function extractPairs(headers, rows) {
  const departmentHeader = resolveHeader(
    headers,
    ["department_name", "department name", "department"],
    "department"
  );
  const schoolHeader = resolveHeader(headers, ["school_name", "school name", "school"], "school");

  if (!departmentHeader || !schoolHeader) {
    throw new Error(
      [
        "Could not find Department/School headers.",
        `Detected headers: ${headers.join(", ")}`,
        "Expected headers like: department_name, department name, department, school_name, school name, school",
      ].join("\n")
    );
  }

  const departmentIndex = headers.findIndex((header) => header === departmentHeader);
  const schoolIndex = headers.findIndex((header) => header === schoolHeader);

  const uniquePairs = new Map();
  let skippedIncomplete = 0;

  for (const row of rows) {
    const department = normalizeText(row[departmentIndex]);
    const school = normalizeText(row[schoolIndex]);

    if (!department || !school) {
      skippedIncomplete += 1;
      continue;
    }

    const key = `${department}|||${school}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { department_name: department, school });
    }
  }

  return {
    departmentHeader,
    schoolHeader,
    rows: Array.from(uniquePairs.values()),
    skippedIncomplete,
    duplicatePairsInFile: rows.length - skippedIncomplete - uniquePairs.size,
  };
}

async function ensureTargetTable(client) {
  const result = await client.query(
    "select to_regclass('public.department_school') as table_name;"
  );
  const tableName = result.rows?.[0]?.table_name;
  if (!tableName) {
    throw new Error(
      "Target table public.department_school does not exist. Run migrations first (npm run migration:up in server)."
    );
  }
}

async function insertRows(client, pairs) {
  let inserted = 0;

  await client.query("BEGIN");
  try {
    for (const pair of pairs) {
      const result = await client.query(
        `
          insert into public.department_school (department_name, school)
          values ($1, $2)
          on conflict (department_name, school) do nothing;
        `,
        [pair.department_name, pair.school]
      );

      inserted += result.rowCount || 0;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return inserted;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.file) {
    throw new Error(
      "Missing --file argument. Example: node scripts/seed-department-school.js --file=./departments.xlsx"
    );
  }

  const resolvedFilePath = path.resolve(process.cwd(), options.file);
  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(`Excel file not found: ${resolvedFilePath}`);
  }

  const { sheetName, headers, rows } = readSheetRows(resolvedFilePath, options.sheet);
  const extracted = extractPairs(headers, rows);

  console.log(`Workbook: ${resolvedFilePath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Department column: ${extracted.departmentHeader}`);
  console.log(`School column: ${extracted.schoolHeader}`);
  console.log(`Rows in sheet: ${rows.length}`);
  console.log(`Rows skipped (missing department/school): ${extracted.skippedIncomplete}`);
  console.log(`Duplicate pairs in file: ${extracted.duplicatePairsInFile}`);
  console.log(`Unique department-school pairs to process: ${extracted.rows.length}`);

  if (options.dryRun) {
    console.log("Dry run complete. No database writes performed.");
    return;
  }

  const client = getDbClient();
  await client.connect();

  try {
    await ensureTargetTable(client);
    const inserted = await insertRows(client, extracted.rows);

    console.log(`Inserted new rows: ${inserted}`);
    console.log(`Already existing rows skipped by conflict: ${extracted.rows.length - inserted}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
