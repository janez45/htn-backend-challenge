CREATE TABLE IF NOT EXISTS Hacker_Information(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    badge_code TEXT UNIQUE,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Scans(
    badge_code TEXT,
    activity_name TEXT,
    activity_category TEXT, 
    scanned_at TEXT
);