# htn-backend-challenge

An REST API endpoint to manage user badge code scans at a hackathon. Created for the 2025 Hack the North backend challenge.

## Setup

This API was built with **Node** and **Express.js** with **sqlite3**. First, ensure that you have Node.js and sqlite installed. You can test this by running `node --version ` and `sqlite3 --version`.

Then run `npm install` to install all required packages.

Finally, run `node index` in the terminal to start up the server! You should see `Server has started on port 3000` in your terminal.

(Optional) This project was tested with **Nodemon**, which allows automatic reloading of the server upon a file change. Alternatively, you can install Nodemon and use `nodemon index` instead.

## Architecture
* The main server is ran in `index.js`.
* `data.json` contains the sample data to be loaded into the database.
* `setupDatabase.js` contains a script to load data into `hackathon.db`. For ease of setup, this is automatically ran when you start the server (see `startServer()`)

## Database
There are two tables in the database: one for hacker information and the other for scans (Hacker_Information and Scans) respectively. Their respective schemas can be found in `setupDatabase.js`, in functions `createHackerInformationTable` and `createScansTable`. 

This was done for ease of adding scans, and manipulating user information independent of scans. To output user information, LEFT JOIN is used on the badge_code.

 
## API Documentation
`GET /users`: The all users endpoint. Retrieves the information of all users in a json format like `data.json`. Only difference is the addition of the field `updated_at`.

`GET /users/:id`: The user information endpoint. Retrieves information for a specific user by the `id` specified in the url.

`PUT /users/:id`: The update user information endpoint. Modifies a specific user's information in any subset of `name`, `email`, `phone`, and `badge_cde` by passing them the request body as a JSON object. The modified user's information is also returned in the response.

This API also supports partial updates, E.g. passing in
```
  {
    "name": name,
    "email": email
  }
```

`PUT /scan/:badge_code`: The add scans endpoint. This adds a scan to a specific badge code and returns the scanned information. It also updates the `updated_at` field for that user. 

E.g. passing this into the request body.
```
  {
    "activity_name": activity_name,
    "activity_category": activity_category
  }
```


`GET /scans`: The scans endpoint. This returns aggregated data about the scan cateogories and their frequencies. It also supports the following optional header parameters
* `activity_category`: The activity category to investigate
* `min_frequency`: Only view categories with at least this many scans
* `max_frequency`: Only view categories with at most this many scans

E.g. `/scans?activity_cateogry=workshop&min_frequency=3`

