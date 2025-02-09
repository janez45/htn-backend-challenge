const express = require("express");
const { setupDatabase, db } = require("./setupDatabase");

const app = express();

app.use(express.json());

// All users endpoint: Retrieves the information of all hackers in a json format similar to data.json
app.get("/users", async (req, res) => {
  try {
    const allHackers = db
      .prepare(
        `
        SELECT h.name, h.email, h.phone, 
          COALESCE(h.badge_code, '') as badge_code,
          h.updated_at,
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

    // Since json_group_array() and json_object() return strings, we must parse the scans arrays before returning
    const allHackersFormatted = allHackers.map((hacker) => ({
      ...hacker,
      scans: JSON.parse(hacker.scans),
    }));

    res.json(allHackersFormatted);
  } catch (err) {
    console.error(err.message);
  }
});

// User information endpoint: Get a specific hacker by their specific ID in the database
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Retrieving user with ID: ${id}`);
    const getHacker = db.prepare(
      `
        SELECT h.name, h.email, h.phone, 
          COALESCE(h.badge_code, '') as badge_code, 
          h.updated_at,
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
    );

    const hacker = getHacker.get(id);

    // If there does not exist a user with this ID
    if (!hacker) {
      const error = new Error("ERROR Get user: Invalid user ID");
      error.status = 404;
      res.status(404).json({ error: "Get user: Invalid user ID" });
      throw error;
    }

    // Since json_group_array() and json_object() return strings, we must parse the scans array before returning
    hacker.scans = JSON.parse(hacker.scans);
    res.json(hacker);
  } catch (err) {
    console.error(err.message);
  }
});

// Update users endpoint: Update a specific hacker's information by their database ID
// Assuming only name, email, phone, badge_code can be modified via parameters. ID and updated_at should not be modifiable
app.put("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, badge_code } = req.body;

    // Get the old badge code associated with the hacker. We need this to update the scans
    const getBadgeCode = db.prepare(
      `SELECT badge_code from Hacker_Information WHERE ID = ?;`
    );
    const badgeCodeData = getBadgeCode.get(id);

    // If there does not exist a user with the ID
    if (!badgeCodeData) {
      const error = new Error("ERROR Update users: Invalid user ID");
      error.status = 404;
      res.status(404).json({ error: "Update users: Invalid user ID" });
      throw error;
    }

    const oldBadgeCode = badgeCodeData["badge_code"];

    // Update the hacker's information.
    // If any of the new fields are null (not passed in), the old fields are retained
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

    console.log("Hacker information successfully updated");

    // Update the scans if the old badge code is not null (there might exist scans associated with the old badge code)
    // and the new badge code is also not null (replacement is required)
    if (oldBadgeCode != null && badge_code != null) {
      console.log(`Replacing ${oldBadgeCode} with ${badge_code}`);
      db.prepare(
        `
        UPDATE Scans 
        SET 
          badge_code = COALESCE(?, badge_code)
        WHERE 
          badge_code = ?;
        `
      ).run(badge_code, oldBadgeCode);
      console.log("Badge code successfully replaced");
    }

    // Same as the GET request above, returning the updated information
    const hacker = db
      .prepare(
        `
        SELECT h.name, h.email, h.phone, 
          COALESCE(h.badge_code, '') as badge_code, 
          h.updated_at,
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
    res.json(hacker);
  } catch (err) {
    console.error(err.message);
  }
});

// Scan Endpoint: Adds a scan for a specific badge code
app.put("/scan/:badge_code", (req, res) => {
  try {
    const { badge_code } = req.params;
    const { activity_name, activity_category } = req.body;

    // This should not run if activity_name or activity_category are null
    if (!activity_name) {
      const error = new Error("ERROR Scan: No activity name provided");
      error.status = 400;
      res.status(400).json({ error: "Scan: No activity name provided" });
      throw error;
    }

    if (!activity_category) {
      const error = new Error("ERROR Scan: No activity category provided");
      error.status = 400;
      res.status(400).json({ error: "Scan: No activity category provided" });
      throw error;
    }

    // First verify if the badge code is valid
    const validateBadgeCode = db.prepare(`
      SELECT badge_code FROM Hacker_Information WHERE badge_code = ?
    `);

    const validBadgeCode = validateBadgeCode.get(badge_code);

    if (!validBadgeCode) {
      const error = new Error("ERROR Scan: Invalid badge code");
      error.status = 404;
      res.status(404).json({ error: "Scan: Invalid badge code" });
      throw error;
    }

    // update the hacker's last update time
    const update_hacker = db.prepare(
      `
      UPDATE Hacker_Information 
      SET 
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        badge_code = ?;
      `
    );

    // Insert the scan into the Scans table. Assuming "all data associated with the scan" to fill out the Scans table
    const add_scan = db.prepare(
      `
      INSERT INTO Scans (badge_code, activity_name, activity_category, scanned_at) VALUES(?,?,?,CURRENT_TIMESTAMP) RETURNING *;
      `
    );

    // Run both sql commands and return the scan
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

// Scans Data Endpoint: Get information about scan categories
// Assuming that I count duplicate events if someone scans an activity more than once
app.get("/scans", (req, res) => {
  try {
    const minFrequency = parseInt(req.query.min_frequency);
    const maxFrequency = parseInt(req.query.max_frequency);
    const activityCategory = req.query.activity_category;

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

// Starting the server by first setting up the database
const startServer = () => {
  try {
    setupDatabase();
    app.listen(3000, () => {
      console.log("Server has started on port 3000");
    });
  } catch (err) {
    console.error(err.message);
  }
};

startServer();
