// Court Check server: serves web/ and answers /api/... routes with rows from SQL Server.
// Run with: npm start   then open http://localhost:3000
require('dotenv').config();
const path = require('path');
const express = require('express');
const sql = require('mssql');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// Same settings as scripts/check-connection.js. One shared pool for all requests.
const poolPromise = sql.connect({
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
});
poolPromise
  .then(() => console.log(`Connected to database ${process.env.DB_NAME}.`))
  .catch(err => console.error('NOT CONNECTED to the database: ' + err.message + ' (check .env and the UW network, then restart)'));

// Turns "3" into 3; anything else (missing, "abc", "' OR 1=1 --") into null.
function toInt(value) {
  return /^\d{1,6}$/.test(String(value ?? '')) ? Number(value) : null;
}
function hoursParam(value) {
  const h = toInt(value);
  return h && h <= 48 ? h : 2;
}
// Gym filter: empty means all gyms; anything that is not a number is rejected with a clean error.
function badGym(req, res) {
  const g = req.query.gym;
  if (g === undefined || g === '' || toInt(g) !== null) return false;
  res.status(400).json({ error: 'Gym must be a gym number.' });
  return true;
}
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Database error: ' + err.message });
}

app.get('/api/gyms', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT GymID, Name, Building, Courts FROM dbo.Gyms ORDER BY Name');
    res.json(r.recordset);
  } catch (err) { fail(res, err); }
});

app.get('/api/players', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT PlayerID, DisplayName FROM dbo.Players ORDER BY DisplayName');
    res.json(r.recordset);
  } catch (err) { fail(res, err); }
});

// The user story: latest status of each gym (query 1 in db/queries.sql).
app.get('/api/status', async (req, res) => {
  if (badGym(req, res)) return;
  try {
    const pool = await poolPromise;
    const r = await pool.request()
      .input('GymID', sql.Int, toInt(req.query.gym))
      .input('Hours', sql.Int, hoursParam(req.query.hours))
      .query(`
        WITH Recent AS (
            SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.GymID ORDER BY r.ReportedAt DESC) AS rn,
                   COUNT(*) OVER (PARTITION BY r.GymID) AS ReportsInWindow
            FROM dbo.Reports r
            WHERE r.ReportedAt >= DATEADD(hour, -@Hours, SYSUTCDATETIME())
        )
        SELECT g.GymID, g.Name, g.Building, g.Courts,
               rc.PeopleCount, rc.NeedPlayers, rc.Note, rc.ReportedAt, p.DisplayName AS ReportedBy,
               DATEDIFF(minute, rc.ReportedAt, SYSUTCDATETIME()) AS MinutesAgo,
               ISNULL(rc.ReportsInWindow, 0) AS ReportsInWindow,
               CASE WHEN rc.ReportID IS NULL THEN 'No recent reports'
                    WHEN rc.PeopleCount * 1.0 / g.Courts < 8  THEN 'Open'
                    WHEN rc.PeopleCount * 1.0 / g.Courts < 14 THEN 'Busy'
                    ELSE 'Packed' END AS CrowdLevel
        FROM dbo.Gyms g
        LEFT JOIN Recent rc ON rc.GymID = g.GymID AND rc.rn = 1
        LEFT JOIN dbo.Players p ON p.PlayerID = rc.PlayerID
        WHERE @GymID IS NULL OR g.GymID = @GymID
        ORDER BY CASE WHEN rc.NeedPlayers = 1 THEN 0 ELSE 1 END, rc.PeopleCount;`);
    res.json(r.recordset);
  } catch (err) { fail(res, err); }
});

// Recent reports, newest first (query 2 in db/queries.sql).
app.get('/api/reports', async (req, res) => {
  if (badGym(req, res)) return;
  try {
    const pool = await poolPromise;
    const r = await pool.request()
      .input('GymID', sql.Int, toInt(req.query.gym))
      .input('Hours', sql.Int, hoursParam(req.query.hours))
      .query(`
        SELECT TOP (25) r.ReportID, g.Name AS Gym, p.DisplayName AS ReportedBy, r.ReportedAt,
               DATEDIFF(minute, r.ReportedAt, SYSUTCDATETIME()) AS MinutesAgo,
               r.PeopleCount, r.NeedPlayers, r.Note
        FROM dbo.Reports r
        JOIN dbo.Gyms g ON g.GymID = r.GymID
        JOIN dbo.Players p ON p.PlayerID = r.PlayerID
        WHERE r.ReportedAt >= DATEADD(hour, -@Hours, SYSUTCDATETIME())
          AND (@GymID IS NULL OR r.GymID = @GymID)
        ORDER BY r.ReportedAt DESC;`);
    res.json(r.recordset);
  } catch (err) { fail(res, err); }
});

// Someone at a gym posts an update (query 3 in db/queries.sql).
app.post('/api/reports', async (req, res) => {
  const { gymId, playerId, peopleCount, needPlayers, note } = req.body || {};
  const gym = toInt(gymId), player = toInt(playerId), people = toInt(peopleCount);
  if (!gym || !player || people === null || people > 200) {
    return res.status(400).json({ error: 'Pick a gym and your name, and enter a number of people from 0 to 200.' });
  }
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : null;
  try {
    const pool = await poolPromise;
    const r = await pool.request()
      .input('GymID', sql.Int, gym)
      .input('PlayerID', sql.Int, player)
      .input('PeopleCount', sql.Int, people)
      .input('NeedPlayers', sql.Bit, needPlayers ? 1 : 0)
      .input('Note', sql.NVarChar(200), cleanNote)
      .query(`INSERT INTO dbo.Reports (GymID, PlayerID, PeopleCount, NeedPlayers, Note)
              OUTPUT INSERTED.ReportID
              VALUES (@GymID, @PlayerID, @PeopleCount, @NeedPlayers, @Note);`);
    res.status(201).json({ reportId: r.recordset[0].ReportID });
  } catch (err) {
    if (err.number === 547) return res.status(400).json({ error: 'That gym or player does not exist.' });
    fail(res, err);
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Court Check running at http://localhost:${port}`));
