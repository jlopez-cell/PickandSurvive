-- LaLiga Hypermotion: ID correcto en football-data.org es 2077 (Segunda División, código SD).
-- El 141 era el ID de API-Football y no sirve para /v4/competitions/{id}/teams.

-- Quita equipos creados con la fórmula antigua (141 * 1_000_000 + clubId), si no tienen referencias.
DELETE FROM "FootballTeam" ft
WHERE ft."apiFootballId" >= 141000000
  AND ft."apiFootballId" < 142000000
  AND ft."leagueId" IN (SELECT id FROM "FootballLeague" WHERE "apiFootballId" = 141)
  AND NOT EXISTS (SELECT 1 FROM "Pick" p WHERE p."teamId" = ft.id)
  AND NOT EXISTS (SELECT 1 FROM "TeamUsage" tu WHERE tu."teamId" = ft.id)
  AND NOT EXISTS (
    SELECT 1 FROM "Match" m
    WHERE m."homeTeamId" = ft.id OR m."awayTeamId" = ft.id OR m."winnerTeamId" = ft.id
  );

UPDATE "FootballLeague"
SET "apiFootballId" = 2077
WHERE "apiFootballId" = 141;
