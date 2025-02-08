const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database("hackathon.db");
const rawData = fs.readFileSync("data.json");
const hackers = JSON.parse(rawData);

const wipeHackerInformation = db.prepare(`
    DROP TABLE IF EXISTS Hacker_Information;
`);

const wipeScans = db.prepare(`
    DROP TABLE IF EXISTS Scans;
`);

const createHackerInformationTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS Hacker_Information(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        badge_code TEXT UNIQUE,
        updated_at TIMESTAMP NOT NULL
    );
`);

const createScansTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS Scans(
        badge_code TEXT NOT NULL,
        activity_name TEXT NOT NULL,
        activity_category TEXT NOT NULL, 
        scanned_at TIMESTAMP NOT NULL
    );
`);

const insertHackerInfo = db.prepare(`
    INSERT INTO Hacker_Information (name, email, phone, badge_code, updated_at) 
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
`);

const insertScanInfo = db.prepare(`
    INSERT INTO Scans (badge_code, activity_name, activity_category, scanned_at)
    VALUES (?, ?, ?, ?);
`);

const setupDatabase = () => {
  const transaction = db.transaction(() => {
    wipeHackerInformation.run();
    wipeScans.run();
    createHackerInformationTable.run();
    console.log("Created Hacker Information table");
    createScansTable.run();
    console.log("Created Scans table");

    for (const hacker of hackers) {
      insertHackerInfo.run([
        hacker.name,
        hacker.email,
        hacker.phone,
        hacker.badge_code === "" ? null : hacker.badge_code,
      ]);
      for (const scan of hacker.scans) {
        insertScanInfo.run([
          hacker.badge_code,
          scan.activity_name,
          scan.activity_category,
          scan.scanned_at,
        ]);
      }
    }
  });

  console.log("Running transaction");
  transaction();
  console.log("Finished setting up the database");
};

module.exports = { setupDatabase, db };
