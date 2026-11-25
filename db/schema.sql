-- Court Check: tables for pickup basketball gym reports.
-- Run in your own database (jaku910_myapp). db/load.js runs this for you.

IF OBJECT_ID('dbo.Reports', 'U') IS NOT NULL DROP TABLE dbo.Reports;
IF OBJECT_ID('dbo.Players', 'U') IS NOT NULL DROP TABLE dbo.Players;
IF OBJECT_ID('dbo.Gyms', 'U') IS NOT NULL DROP TABLE dbo.Gyms;

-- A gym or court area people play pickup in.
CREATE TABLE dbo.Gyms (
    GymID      INT IDENTITY(1,1) PRIMARY KEY,
    Name       NVARCHAR(100) NOT NULL UNIQUE,
    Building   NVARCHAR(100) NOT NULL,
    Courts     INT NOT NULL CHECK (Courts > 0),
    OpenHour   TINYINT NOT NULL CHECK (OpenHour BETWEEN 0 AND 23),
    CloseHour  TINYINT NOT NULL CHECK (CloseHour BETWEEN 1 AND 24)
);

-- A student who posts reports.
CREATE TABLE dbo.Players (
    PlayerID   INT IDENTITY(1,1) PRIMARY KEY,
    DisplayName NVARCHAR(50) NOT NULL UNIQUE,
    JoinedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- One update from someone at a gym: how many people, do they need players.
CREATE TABLE dbo.Reports (
    ReportID    INT IDENTITY(1,1) PRIMARY KEY,
    GymID       INT NOT NULL REFERENCES dbo.Gyms(GymID),
    PlayerID    INT NOT NULL REFERENCES dbo.Players(PlayerID),
    ReportedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PeopleCount INT NOT NULL CHECK (PeopleCount BETWEEN 0 AND 200),
    NeedPlayers BIT NOT NULL DEFAULT 0,
    Note        NVARCHAR(200) NULL
);

CREATE INDEX IX_Reports_Gym_Time ON dbo.Reports (GymID, ReportedAt DESC);
