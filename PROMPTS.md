# What I asked the AI

Keep a short log. One entry per prompt is enough. (AI used: Claude Code.)

| What I asked (paste or summarize) | What happened | What I had to fix or check |
| --- | --- | --- |
| Pasted the assignment and the starter repo link; asked it to set things up. | It read the README, AGENTS.md and prompts, made my repo from the template, cloned it to my Desktop, ran `npm install`, and made `.env` with `DB_NAME=jaku910_myapp`. | Gave it my NetID. It would not type the password, so I put the password in `.env` myself. My first try didn't save, and `npm run check` said "Login failed". |
| My idea: an app that shows if the intramural basketball gyms are packed, where people at the gym post how many are there and whether they need players. | It wrote IDEA.md, three tables (Gyms, Players, Reports) in `db/schema.sql`, `db/load.js` with made-up rows, `db/queries.sql`, `server/server.js` with `/api` routes, and `web/index.html`. | Ran `npm run create-db`, `npm run check` (OK), `node db/load.js`, and `npm start`, then checked the page at localhost:3000. |
| Test that it's safe from SQL injection. | `' OR 1=1 --` as the gym filter returned every gym instead of an error. A note like `'); DROP TABLE Reports; --` was saved as plain text (it's a parameter), and the table was fine. | Had it return a clean error ("Gym must be a gym number.") for a gym value that isn't a number. |
| Make the made-up data show every crowd level. | No gym was "Packed" at first. It raised the typical crowd for two gyms and reloaded. | Checked the page shows Open, Busy, and Packed, and that posting an update moves a gym's card. |
