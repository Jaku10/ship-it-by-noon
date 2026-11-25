// Creates the Court Check tables in your database and fills them with made-up rows.
// Run with: node db/load.js   (safe to run again: it drops and recreates the tables)
// Report times are relative to "now", so the page always has fresh-looking data after a load.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
};

const gyms = [
  // name, building, courts, open hour, close hour
  ['IMA Gym A', 'Intramural Activities Building', 2, 6, 23],
  ['IMA Gym B', 'Intramural Activities Building', 2, 6, 23],
  ['IMA Gym C', 'Intramural Activities Building', 1, 6, 23],
  ['IMA Upper Gym', 'Intramural Activities Building', 3, 6, 23],
  ['IMA Outdoor Courts', 'IMA Sports Fields', 4, 7, 21],
  ['North Campus Rec Court', 'North Campus Rec Center', 1, 8, 22]
];

const players = [
  'Jake K', 'Maya L', 'Devon R', 'Priya S', 'Marcus T', 'Ellie W', 'Kenji O', 'Sofia M',
  'Andre B', 'Hannah C', 'Luis G', 'Grace P', 'Tyler N', 'Amara D', 'Ben H', 'Chloe Y',
  'Omar F', 'Riley J', 'Noah V', 'Isabel Q'
];

const notes = [
  'Full court 5s running, 3 teams waiting', 'Half court 3s, next game open', 'Need 2 for a full run',
  'Volleyball has one court until 8', 'Pretty chill, shootaround only', 'Packed, 20+ min wait',
  'Club practice on court 1', 'Need 1 more for 4v4', 'Good runs tonight', null, null, null
];

// Small fixed "random" so every load gives the same data.
let seed = 430;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

// Each gym has a typical crowd so the page shows a mix of Open / Busy / Packed.
const typicalPeople = [32, 9, 3, 46, 14, 6];

(async () => {
  let pool;
  try {
    pool = await sql.connect(config);
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.request().batch(schema);
    console.log('Created tables Gyms, Players, Reports.');

    for (const [name, building, courts, openH, closeH] of gyms) {
      await pool.request()
        .input('name', sql.NVarChar(100), name)
        .input('building', sql.NVarChar(100), building)
        .input('courts', sql.Int, courts)
        .input('openH', sql.TinyInt, openH)
        .input('closeH', sql.TinyInt, closeH)
        .query('INSERT INTO dbo.Gyms (Name, Building, Courts, OpenHour, CloseHour) VALUES (@name, @building, @courts, @openH, @closeH)');
    }
    for (const p of players) {
      await pool.request().input('name', sql.NVarChar(50), p)
        .query('INSERT INTO dbo.Players (DisplayName) VALUES (@name)');
    }
    console.log(`Inserted ${gyms.length} gyms and ${players.length} players.`);

    let count = 0;
    for (let g = 1; g <= gyms.length; g++) {
      const n = 5 + Math.floor(rand() * 4); // 5 to 8 reports per gym
      for (let i = 0; i < n; i++) {
        const minutesAgo = 5 + Math.floor(rand() * 340); // within the last ~6 hours
        const people = Math.max(0, Math.round(typicalPeople[g - 1] * (0.6 + rand() * 0.8)));
        const need = people < gyms[g - 1][2] * 10 && rand() < 0.6;
        await pool.request()
          .input('gym', sql.Int, g)
          .input('player', sql.Int, 1 + Math.floor(rand() * players.length))
          .input('mins', sql.Int, minutesAgo)
          .input('people', sql.Int, people)
          .input('need', sql.Bit, need)
          .input('note', sql.NVarChar(200), notes[Math.floor(rand() * notes.length)])
          .query(`INSERT INTO dbo.Reports (GymID, PlayerID, ReportedAt, PeopleCount, NeedPlayers, Note)
                  VALUES (@gym, @player, DATEADD(minute, -@mins, SYSUTCDATETIME()), @people, @need, @note)`);
        count++;
      }
    }
    console.log(`Inserted ${count} reports. Done: now run npm start`);
  } catch (err) {
    console.log('FAILED: ' + err.message);
    console.log('Check: is .env filled in, are you on the UW network, and did you run npm run create-db?');
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
})();
