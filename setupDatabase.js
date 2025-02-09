/*
  A script that runs when we start up the server, 
  creates the database and inputs all the sample data
*/

const fs = require("fs");
const Database = require("better-sqlite3");

// Set up the database and get the data
const db = new Database("hackathon.db");
const rawData = fs.readFileSync("data.json");
const hackers = JSON.parse(rawData);

// Script to delete the Hacker_Information table (used if data is corrupted)
const wipeHackerInformation = db.prepare(`
    DROP TABLE IF EXISTS Hacker_Information;
`);

// Script to delete the Scans table (used if data is corrupted)
const wipeScans = db.prepare(`
    DROP TABLE IF EXISTS Scans;
`);

// Script to create the Hacker_Information table
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

// Script to create the Scans table
const createScansTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS Scans(
        badge_code TEXT NOT NULL,
        activity_name TEXT NOT NULL,
        activity_category TEXT NOT NULL, 
        scanned_at TIMESTAMP NOT NULL
    );
`);

// Script to load in hacker information
const insertHackerInfo = db.prepare(`
    INSERT INTO Hacker_Information (name, email, phone, badge_code, updated_at) 
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
`);

// Script to insert a scan
const insertScanInfo = db.prepare(`
    INSERT INTO Scans (badge_code, activity_name, activity_category, scanned_at)
    VALUES (?, ?, ?, ?);
`);

// Function to set up the database for the api
const setupDatabase = () => {
  const transaction = db.transaction(() => {
    wipeHackerInformation.run();
    console.log("Dropped the Hacker_Information table");
    wipeScans.run();
    console.log("Dropped the Scans table");
    createHackerInformationTable.run();
    console.log("Created Hacker_Information table");
    createScansTable.run();
    console.log("Created Scans table");

    console.log("Inserting hackers...");
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
    console.log("Successfully inserted hackers");
  });

  console.log("Running transaction");
  transaction();
  console.log("Finished setting up the database");
};

module.exports = { setupDatabase, db };
