const express = require("express");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("hackathon.db");
const rawData = fs.readFileSync("test_data.json");
const hackers = JSON.parse(rawData);

app.use(express.json());

// Insert JSON data using a transaction
const wipeHackerInformation = db.prepare(`
  DELETE FROM Hacker_Information;
`);

const wipeScans = db.prepare(`
  DELETE FROM Scans;
`);

const insertHackerInfo = db.prepare(`
  INSERT INTO Hacker_Information (name, email, phone, badge_code, updated_at) 
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
`);

const insertScanInfo = db.prepare(`
  INSERT INTO Scans (badge_code, activity_name, activity_category, scanned_at)
  VALUES (?, ?, ?, ?);
`);

const insertMany = db.transaction((hackers) => {
  wipeHackerInformation.run();
  wipeScans.run();

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
    console.log(hacker);
  }
});

insertMany(hackers);

// All users endpoint: GET localhost:3000/users or similar
app.get("/users", async (req, res) => {
  try {
    // TODO:
    const allHackers = db
      .prepare(
        `SELECT  
          h.name, 
          h.badge_code, 
          JSON_GROUP_ARRAY(
            JSON_OBJECT('activity_name', s.activity_name, 'activity_category', s.activity_category, 'scanned_at', s,scanned_at)
          ) AS scans
        FROM Hacker_Information h
        LEFT JOIN Scans s ON h.badge_code = s.badge_code
        GROUP BY h.id;
      `
      )
      .all();
    console.log("ALL HACKERS");
    res.json(allHackers);
  } catch (err) {
    console.error(err.message);
  }
});

// Get a specific user GET localhost:3000/users/FOO

// Update users endpoint: PUT localhost:3000/users/FOO

app.listen(3000, () => {
  console.log("Server has started on port 3000");
});
