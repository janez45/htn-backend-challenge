const express = require("express");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("hackathon.db");
const rawData = fs.readFileSync("test_data.json");
const hackers = JSON.parse(rawData);

app.use(express.json());

// Reset the database information
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

// insertMany(hackers);

// All users endpoint: GET localhost:3000/users or similar
app.get("/users", async (req, res) => {
  try {
    const allHackers = db
      .prepare(
        `
        SELECT h.name, h.email, h.phone, h.badge_code, h.updated_at,
        COALESCE(
          CASE
            WHEN COUNT(s.badge_code) = 0 THEN '[]'
            ELSE json_group_array(
              json_object('activity_name', s.activity_name, 'activity_category', s.activity_category, 'scanned_at', s.scanned_at)
            )
          END, '[]'
        ) AS scans
        
        FROM Hacker_Information h
        LEFT JOIN Scans s ON h.badge_code = s.badge_code
        GROUP BY h.id;
      `
      )
      .all();
    console.log("ALL HACKERS");
    const allHackersFormatted = allHackers.map((hacker) => ({
      ...hacker,
      scans: JSON.parse(hacker.scans),
    }));

    res.json(allHackersFormatted);
  } catch (err) {
    console.error(err.message);
  }
});

// Get a specific user GET localhost:3000/users/FOO
app.get("/users/:id", async (req, res) => {
  try {
    // note that id is a parameter that we use to specify the todo
    const { id } = req.params;
    console.log(`Id is ${id}`);
    const hacker = db
      .prepare(
        `
        SELECT h.name, h.email, h.phone, h.badge_code, h.updated_at,
        COALESCE(
          CASE
            WHEN COUNT(s.badge_code) = 0 THEN '[]'
            ELSE json_group_array(
              json_object('activity_name', s.activity_name, 'activity_category', s.activity_category, 'scanned_at', s.scanned_at)
            )
          END, '[]'
        ) AS scans
        
        FROM Hacker_Information h
        LEFT JOIN Scans s ON h.badge_code = s.badge_code
        WHERE h.id = ?
        GROUP BY h.id;
      `
      )
      .get(id);
    hacker.scans = JSON.parse(hacker.scans);
    res.json(hacker); //the 0 means get first item
  } catch (err) {
    console.error(err.message);
  }
});

// Update users endpoint: PUT localhost:3000/users/FOO
// Assuming only name, email, phone, badge_code can be modified via parameters. The others should be read-only
app.put("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, badge_code } = req.body;
    const getBadgeCode = db
      .prepare(`SELECT badge_code from Hacker_Information WHERE ID = ?;`)
      .get(id);
    const oldBadgeCode = getBadgeCode["badge_code"];
    console.log(`Old Badge Code: ${oldBadgeCode}`);
    console.log("Updating Hacker Information");
    db.prepare(
      `
      UPDATE Hacker_Information 
      SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email), 
        phone = COALESCE(?, phone), 
        badge_code = COALESCE(?, badge_code), 
        updated_at = CURRENT_TIMESTAMP 
      WHERE 
        id = ?;
    `
    ).run(name, email, phone, badge_code, id);

    console.log("Successfully updated");

    if (oldBadgeCode != null) {
      console.log(`Repacing ${oldBadgeCode} with ${badge_code}`);
      db.prepare(
        `
        UPDATE Scans 
        SET 
          badge_code = COALESCE(?, badge_code)
        WHERE 
          badge_code = ?;
        `
      ).run(badge_code, oldBadgeCode);
    }

    const hacker = db
      .prepare(
        `
        SELECT h.name, h.email, h.phone, h.badge_code, h.updated_at,
        COALESCE(
          CASE
            WHEN COUNT(s.badge_code) = 0 THEN '[]'
            ELSE json_group_array(
              json_object('activity_name', s.activity_name, 'activity_category', s.activity_category, 'scanned_at', s.scanned_at)
            )
          END, '[]'
        ) AS scans
        
        FROM Hacker_Information h
        LEFT JOIN Scans s ON h.badge_code = s.badge_code
        WHERE h.id = ?
        GROUP BY h.id;
      `
      )
      .get(id);
    hacker.scans = JSON.parse(hacker.scans);
    res.json(hacker); //the 0 means get first item
  } catch (err) {
    console.error(err.message);
  }
});

// Scan Endpoint
app.put("/scan/:badge_code", (req, res) => {
  try {
    const { badge_code } = req.params;
    const { activity_name, activity_category } = req.body;

    // update the hacker's last update
    const update_hacker = db.prepare(
      `
      UPDATE Hacker_Information 
      SET 
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        badge_code = ?;
      `
    );

    // assuming all data associateed with the scan to be all information in Scans
    const add_scan = db.prepare(
      `
      INSERT INTO Scans (badge_code, activity_name, activity_category, scanned_at) VALUES(?,?,?,CURRENT_TIMESTAMP) RETURNING *;
      `
    );

    const transaction = db.transaction(
      (badge_code, activity_name, activity_category) => {
        const scan = add_scan.get(badge_code, activity_name, activity_category);
        update_hacker.run(badge_code);
        return scan;
      }
    );

    const result = transaction(badge_code, activity_name, activity_category);
    res.json(result);
  } catch (err) {
    console.error(err.message);
  }
});

// Scan Data Endpoint
// ASSUMING that I count duplicate events
app.get("/scans", (req, res) => {
  try {
    const minFrequency = parseInt(req.query.min_frequency);
    const maxFrequency = parseInt(req.query.max_frequency);
    const activityCategory = req.query.activity_category;

    console.log(typeof minFrequency);
    console.log(
      `Min frequency: ${minFrequency} Max frequency: ${maxFrequency} Activity Category: ${activityCategory}`
    );
    const aggregation = db.prepare(`
      SELECT activity_category, COUNT(*) as frequency
      FROM Scans
      WHERE activity_category = COALESCE(?, activity_category) 
      GROUP BY activity_category
      HAVING 
            frequency >= COALESCE(?, frequency) AND 
            frequency <= COALESCE(?, frequency);
    `);

    const result = aggregation.all(
      activityCategory,
      minFrequency,
      maxFrequency
    );
    res.json(result);
  } catch (err) {
    console.error(err.message);
  }
});

app.listen(3000, () => {
  console.log("Server has started on port 3000");
});
