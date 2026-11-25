-- Court Check queries. These are the same queries server/server.js runs.
-- To try one in VS Code, change the DECLARE values and run the block.

-- 1. The user story: latest status of each gym (or one gym) in the last @Hours hours.
--    Crowd level = people per court: under 8 Open, under 14 Busy, otherwise Packed.
DECLARE @GymID INT = NULL;   -- NULL means all gyms; try 1 for IMA Gym A
DECLARE @Hours INT = 2;

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
ORDER BY CASE WHEN rc.NeedPlayers = 1 THEN 0 ELSE 1 END, rc.PeopleCount;

-- 2. Recent reports (newest first) for one gym or all gyms.
SELECT TOP (25) r.ReportID, g.Name AS Gym, p.DisplayName AS ReportedBy, r.ReportedAt,
       DATEDIFF(minute, r.ReportedAt, SYSUTCDATETIME()) AS MinutesAgo,
       r.PeopleCount, r.NeedPlayers, r.Note
FROM dbo.Reports r
JOIN dbo.Gyms g ON g.GymID = r.GymID
JOIN dbo.Players p ON p.PlayerID = r.PlayerID
WHERE r.ReportedAt >= DATEADD(hour, -@Hours, SYSUTCDATETIME())
  AND (@GymID IS NULL OR r.GymID = @GymID)
ORDER BY r.ReportedAt DESC;

-- 3. Post a report (the page's form). The server sends these as parameters.
-- INSERT INTO dbo.Reports (GymID, PlayerID, PeopleCount, NeedPlayers, Note)
-- VALUES (@GymID, @PlayerID, @PeopleCount, @NeedPlayers, @Note);
