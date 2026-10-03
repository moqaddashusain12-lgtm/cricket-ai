const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";

const CRICKET_LIVE_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/live";


// ============================================================
// CORS
// ============================================================

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extra
  };
}


// ============================================================
// JSON
// ============================================================

function json(data, status = 200, extra = {}) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: corsHeaders({
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        ...extra
      })
    }
  );
}


// ============================================================
// HELPERS
// ============================================================

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value).trim();
  }

  return "";
}


function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);

    if (text) {
      return text;
    }
  }

  return "";
}


function asObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return null;
}


// ============================================================
// TEAM OBJECT
// CricketLiveApi exact fields:
// first_team
// second_team
// ============================================================

function getTeamObject(match, first = true) {

  const m = asObject(match);

  if (!m) {
    return null;
  }

  const key = first
    ? "first_team"
    : "second_team";

  if (m[key] !== undefined) {

    const obj = asObject(m[key]);

    if (obj) {
      return obj;
    }

    const text = cleanText(m[key]);

    if (text) {
      return {
        name: text
      };
    }
  }

  // Fallback fields
  const fallbackKeys = first
    ? [
        "team1",
        "team_1",
        "home_team",
        "homeTeam"
      ]
    : [
        "team2",
        "team_2",
        "away_team",
        "awayTeam"
      ];

  for (const key2 of fallbackKeys) {

    if (m[key2] !== undefined) {

      const obj = asObject(m[key2]);

      if (obj) {
        return obj;
      }

      const text = cleanText(m[key2]);

      if (text) {
        return {
          name: text
        };
      }
    }
  }

  // Array fallback
  const arrays = [
    m.teams,
    m.team,
    m.sides,
    m.competitors
  ];

  for (const arr of arrays) {

    if (Array.isArray(arr)) {

      const item =
        arr[first ? 0 : 1];

      if (!item) {
        continue;
      }

      const obj = asObject(item);

      if (obj) {
        return obj;
      }

      const text = cleanText(item);

      if (text) {
        return {
          name: text
        };
      }
    }
  }

  return null;
}


// ============================================================
// TEAM NAME
// ============================================================

function extractTeamName(match, first = true) {

  const team =
    getTeamObject(match, first);

  if (team) {

    // CricketLiveApi exact field
    const fullName =
      firstText(
        team.full_name,
        team.fullName
      );

    if (fullName) {
      return fullName;
    }

    const name =
      firstText(
        team.name,
        team.display_name,
        team.displayName,
        team.short_name,
        team.shortName,
        team.title,
        team.country,
        team.code,
        team.abbreviation,
        team.abbr
      );

    if (name) {
      return name;
    }
  }

  const m = asObject(match);

  if (!m) {
    return first
      ? "Team 1"
      : "Team 2";
  }

  const keys = first
    ? [
        "first_team_name",
        "firstTeamName",
        "team1_name",
        "team1Name",
        "home_team_name",
        "homeTeamName"
      ]
    : [
        "second_team_name",
        "secondTeamName",
        "team2_name",
        "team2Name",
        "away_team_name",
        "awayTeamName"
      ];

  for (const key of keys) {

    const value =
      cleanText(m[key]);

    if (value) {
      return value;
    }
  }

  return first
    ? "Team 1"
    : "Team 2";
}


// ============================================================
// TEAM SCORE
// ============================================================

function extractTeamScore(match, first = true) {

  const team =
    getTeamObject(match, first);

  if (team) {

    // IMPORTANT:
    // CricketLiveApi gives:
    // team.score = "299/7 (46.3 ov)"

    const directScore =
      cleanText(team.score);

    if (directScore) {
      return directScore;
    }

    // Other possible fields
    const score =
      cleanText(
        team.current_score
      ) ||
      cleanText(
        team.currentScore
      );

    if (score) {
      return score;
    }

    // Innings fallback
    if (
      Array.isArray(team.innings) &&
      team.innings.length > 0
    ) {

      const lastInnings =
        team.innings[
          team.innings.length - 1
        ];

      if (lastInnings) {

        const runs =
          cleanText(
            lastInnings.runs
          );

        const wickets =
          cleanText(
            lastInnings.wickets
          );

        const overs =
          cleanText(
            lastInnings.overs
          );

        if (runs) {

          let result =
            runs;

          if (wickets) {
            result += `/${wickets}`;
          }

          if (overs) {
            result += ` (${overs} ov)`;
          }

          return result;
        }
      }
    }
  }

  const m = asObject(match);

  if (!m) {
    return "";
  }

  const candidates = first
    ? [
        m.team1_score,
        m.team1Score,
        m.first_team_score,
        m.firstTeamScore,
        m.home_score,
        m.homeScore
      ]
    : [
        m.team2_score,
        m.team2Score,
        m.second_team_score,
        m.secondTeamScore,
        m.away_score,
        m.awayScore
      ];

  for (const candidate of candidates) {

    const text =
      cleanText(candidate);

    if (text) {
      return text;
    }
  }

  return "";
}


// ============================================================
// OVERS
// ============================================================

function extractTeamOvers(match, first = true) {

  const team =
    getTeamObject(match, first);

  if (!team) {
    return "";
  }

  const direct =
    firstText(
      team.overs,
      team.over,
      team.o,
      team.current_overs,
      team.currentOvers
    );

  if (direct) {
    return direct;
  }

  if (
    Array.isArray(team.innings) &&
    team.innings.length > 0
  ) {

    const last =
      team.innings[
        team.innings.length - 1
      ];

    if (last) {

      const overs =
        cleanText(last.overs);

      if (overs) {
        return overs;
      }
    }
  }

  return "";
}


// ============================================================
// FORMAT
// ============================================================

function extractFormat(match) {

  const m = asObject(match);

  if (!m) {
    return "";
  }

  return firstText(
    m.format,
    m.match_type,
    m.matchType,
    m.type
  );
}


// ============================================================
// SERIES
// ============================================================

function extractSeries(match) {

  const m = asObject(match);

  if (!m) {
    return "";
  }

  return firstText(
    m.series_name,
    m.seriesName,
    m.series,
    m.series_title,
    m.seriesTitle
  );
}


// ============================================================
// VENUE
// ============================================================

function extractVenue(match) {

  const m = asObject(match);

  if (!m) {
    return "";
  }

  if (
    typeof m.venue === "string"
  ) {
    return m.venue;
  }

  if (
    m.venue &&
    typeof m.venue === "object"
  ) {

    return firstText(
      m.venue.name,
      m.venue.venue_name,
      m.venue.title
    );
  }

  return firstText(
    m.ground,
    m.location
  );
}


// ============================================================
// STATUS
// ============================================================

function extractStatus(match) {

  const m = asObject(match);

  if (!m) {
    return "LIVE";
  }

  return firstText(
    m.short_status,
    m.status,
    m.status_detail,
    m.state
  ) || "LIVE";
}


// ============================================================
// MATCH ID
// ============================================================

function extractMatchId(match) {

  const m = asObject(match);

  if (!m) {
    return "";
  }

  return firstText(
    m.match_id,
    m.matchId,
    m.id
  );
}


// ============================================================
// NORMALIZE
// ============================================================

function normalizeMatch(
  match,
  source = "unknown"
) {

  return {
    match_id:
      extractMatchId(match),

    team1:
      extractTeamName(match, true),

    team2:
      extractTeamName(match, false),

    score1:
      extractTeamScore(match, true),

    score2:
      extractTeamScore(match, false),

    overs1:
      extractTeamOvers(match, true),

    overs2:
      extractTeamOvers(match, false),

    format:
      extractFormat(match),

    status:
      extractStatus(match),

    venue:
      extractVenue(match),

    series:
      extractSeries(match),

    source
  };
}


// ============================================================
// EXTRACT MATCH ARRAY
// ============================================================

function extractMatches(data) {

  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.matches)) {
    return data.matches;
  }

  if (Array.isArray(data.response)) {
    return data.response;
  }

  if (Array.isArray(data.result)) {
    return data.result;
  }

  if (
    data.data &&
    typeof data.data === "object"
  ) {

    if (Array.isArray(data.data.data)) {
      return data.data.data;
    }

    if (Array.isArray(data.data.matches)) {
      return data.data.matches;
    }
  }

  return [];
}


// ============================================================
// PRIMARY CRICAPI
// ============================================================

async function fetchPrimaryLive(env) {

  if (!env.CRICKET_API_KEY) {
    throw new Error(
      "CRICKET_API_KEY is missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }`;

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `CricAPI returned invalid JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `CricAPI HTTP ${response.status}: ${
        data?.message ||
        data?.error ||
        "Request failed"
      }`
    );
  }

  if (data?.success === false) {
    throw new Error(
      data?.message ||
      data?.error ||
      "CricAPI request failed"
    );
  }

  return data;
}


// ============================================================
// BACKUP CRICKETLIVEAPI
// ============================================================

async function fetchBackupLive(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN is missing"
    );
  }

  const response =
    await fetch(
      CRICKET_LIVE_API_URL,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization":
            `Bearer ${
              env.CRICKET_LIVE_API_TOKEN
            }`
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `CricketLiveApi returned invalid JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `CricketLiveApi HTTP ${response.status}: ${
        data?.message ||
        data?.error ||
        "Request failed"
      }`
    );
  }

  return data;
}


// ============================================================
// LIVE MATCHES
// ============================================================

async function getLiveMatches(env) {

  let primaryError = null;

  // ----------------------------------------------------------
  // PRIMARY
  // ----------------------------------------------------------

  try {

    const primary =
      await fetchPrimaryLive(env);

    const matches =
      extractMatches(primary);

    if (matches.length > 0) {

      return {
        success: true,
        source: "CricAPI",
        matches:
          matches.map(
            match =>
              normalizeMatch(
                match,
                "CricAPI"
              )
          )
      };
    }

  } catch (error) {

    primaryError =
      error?.message ||
      String(error);
  }


  // ----------------------------------------------------------
  // BACKUP
  // ----------------------------------------------------------

  let backupError = null;

  try {

    const backup =
      await fetchBackupLive(env);

    const matches =
      extractMatches(backup);

    if (matches.length > 0) {

      return {
        success: true,
        source: "CricketLiveApi",
        matches:
          matches.map(
            match =>
              normalizeMatch(
                match,
                "CricketLiveApi"
              )
          ),
        primaryError
      };
    }

  } catch (error) {

    backupError =
      error?.message ||
      String(error);
  }


  return {
    success: false,
    source: null,
    matches: [],
    error:
      "Both cricket APIs failed.",
    primaryError,
    backupError
  };
}


// ============================================================
// DEBUG LIVE
// ============================================================

async function debugLive(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    return {
      success: false,
      error:
        "CRICKET_LIVE_API_TOKEN is missing"
    };
  }

  const response =
    await fetch(
      CRICKET_LIVE_API_URL,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization":
            `Bearer ${
              env.CRICKET_LIVE_API_TOKEN
            }`
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      httpStatus: response.status,
      error:
        "Invalid JSON from CricketLiveApi"
    };
  }

  const matches =
    extractMatches(data);

  const first =
    matches[0] || null;

  return {
    success: response.ok,
    httpStatus: response.status,
    matchCount: matches.length,

    topLevelKeys:
      first &&
      typeof first === "object"
        ? Object.keys(first)
        : [],

    first_team:
      first?.first_team ?? null,

    second_team:
      first?.second_team ?? null,

    team1:
      first?.team1 ?? null,

    team2:
      first?.team2 ?? null,

    teams:
      first?.teams ?? null,

    score:
      first?.score ?? null,

    scores:
      first?.scores ?? null,

    status:
      first?.status ?? null,

    format:
      first?.format ?? null,

    venue:
      first?.venue ?? null,

    series:
      first?.series_name ??
      first?.series ??
      null,

    last_ball:
      first?.last_ball ?? null
  };
}


// ============================================================
// MATCH ID VALIDATION
// ============================================================

function isValidMatchId(id) {

  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    .test(id);
}


// ============================================================
// SCORECARD
// ============================================================

async function getScorecard(env, id) {

  if (!isValidMatchId(id)) {

    return {
      success: false,
      error:
        "Invalid Match ID. Please use the full CricAPI Match ID."
    };
  }

  if (!env.CRICKET_API_KEY) {

    return {
      success: false,
      error:
        "CRICKET_API_KEY is missing"
    };
  }

  const url =
    `https://api.cricapi.com/v1/match_info?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }&id=${
      encodeURIComponent(id)
    }`;

  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}`
    };
  }

  if (!response.ok) {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}: ${
          data?.message ||
          data?.error ||
          "Request failed"
        }`
    };
  }

  return data;
}


// ============================================================
// BALL BY BALL
// ============================================================

async function getBallByBall(env, id) {

  if (!isValidMatchId(id)) {

    return {
      success: false,
      error:
        "Invalid Match ID. Please use the full CricAPI Match ID."
    };
  }

  if (!env.CRICKET_API_KEY) {

    return {
      success: false,
      error:
        "CRICKET_API_KEY is missing"
    };
  }

  const url =
    `https://api.cricapi.com/v1/match_scorecard?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }&id=${
      encodeURIComponent(id)
    }`;

  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}`
    };
  }

  if (!response.ok) {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}: ${
          data?.message ||
          data?.error ||
          "Request failed"
        }`
    };
  }

  return data;
}


// ============================================================
// MATCH POINTS
// ============================================================

async function getMatchPoints(env, id) {

  if (!isValidMatchId(id)) {

    return {
      success: false,
      error:
        "Invalid Match ID. Please use the full CricAPI Match ID."
    };
  }

  if (!env.CRICKET_API_KEY) {

    return {
      success: false,
      error:
        "CRICKET_API_KEY is missing"
    };
  }

  const url =
    `https://api.cricapi.com/v1/match_points?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }&id=${
      encodeURIComponent(id)
    }`;

  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}`
    };
  }

  if (!response.ok) {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}: ${
          data?.message ||
          data?.error ||
          "Request failed"
        }`
    };
  }

  return data;
}


// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  if (!env.CRICKET_API_KEY) {

    return {
      success: false,
      error:
        "CRICKET_API_KEY is missing"
    };
  }

  const url =
    `https://api.cricapi.com/v1/matches?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }`;

  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}`
    };
  }

  if (!response.ok) {

    return {
      success: false,
      error:
        `CricAPI HTTP ${response.status}: ${
          data?.message ||
          data?.error ||
          "Request failed"
        }`
    };
  }

  return data;
}


// ============================================================
// AI IMAGE
// ============================================================

async function generateImage(
  env,
  prompt
) {

  if (!env.AI) {

    return json(
      {
        success: false,
        error:
          "Workers AI binding AI is missing."
      },
      500
    );
  }

  if (!prompt) {

    return json(
      {
        success: false,
        error:
          "Prompt is required."
      },
      400
    );
  }

  try {

    const result =
      await env.AI.run(
        AI_MODEL,
        {
          prompt:
            String(prompt)
        }
      );

    return new Response(
      result,
      {
        headers:
          corsHeaders({
            "Content-Type":
              "image/png",
            "Cache-Control":
              "no-store"
          })
      }
    );

  } catch (error) {

    return json(
      {
        success: false,
        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}


// ============================================================
// HEALTH
// ============================================================

function health(env) {

  return {
    success: true,

    app:
      "Cricket Short",

    worker:
      "cricket-ai-app",

    workersAI:
      Boolean(env.AI),

    cricketApiKey:
      Boolean(
        env.CRICKET_API_KEY
      ),

    cricketLiveApiToken:
      Boolean(
        env.CRICKET_LIVE_API_TOKEN
      ),

    assets:
      Boolean(env.ASSETS),

    endpoints: [
      "/api/generate",
      "/api/generate-image",
      "/api/score",
      "/api/live-score",
      "/api/fixtures",
      "/api/scorecard",
      "/api/ball-by-ball",
      "/api/match-points",
      "/api/debug-live",
      "/api/health"
    ]
  };
}


// ============================================================
// MAIN WORKER
// ============================================================

export default {

  async fetch(request, env) {

    // --------------------------------------------------------
    // OPTIONS
    // --------------------------------------------------------

    if (
      request.method === "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders()
        }
      );
    }

    const url =
      new URL(request.url);

    const path =
      url.pathname;


    // --------------------------------------------------------
    // HEALTH
    // --------------------------------------------------------

    if (
      path === "/api/health"
    ) {

      return json(
        health(env)
      );
    }


    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    if (
      path === "/api/debug-live"
    ) {

      try {

        const result =
          await debugLive(env);

        return json(result);

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // LIVE SCORE
    // --------------------------------------------------------

    if (
      path === "/api/live-score" ||
      path === "/api/score"
    ) {

      try {

        const result =
          await getLiveMatches(env);

        return json(
          result,
          result.success
            ? 200
            : 502
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // FIXTURES
    // --------------------------------------------------------

    if (
      path === "/api/fixtures"
    ) {

      try {

        const result =
          await getFixtures(env);

        return json(
          result,
          result.success === false
            ? 502
            : 200
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // SCORECARD
    // --------------------------------------------------------

    if (
      path === "/api/scorecard"
    ) {

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return json(
          {
            success: false,
            error:
              "Match ID is required."
          },
          400
        );
      }

      try {

        const result =
          await getScorecard(
            env,
            id
          );

        return json(
          result,
          result.success === false
            ? 400
            : 200
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // BALL BY BALL
    // --------------------------------------------------------

    if (
      path === "/api/ball-by-ball"
    ) {

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return json(
          {
            success: false,
            error:
              "Match ID is required."
          },
          400
        );
      }

      try {

        const result =
          await getBallByBall(
            env,
            id
          );

        return json(
          result,
          result.success === false
            ? 400
            : 200
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // MATCH POINTS
    // --------------------------------------------------------

    if (
      path === "/api/match-points"
    ) {

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return json(
          {
            success: false,
            error:
              "Match ID is required."
          },
          400
        );
      }

      try {

        const result =
          await getMatchPoints(
            env,
            id
          );

        return json(
          result,
          result.success === false
            ? 400
            : 200
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // AI IMAGE
    // --------------------------------------------------------

    if (
      path === "/api/generate-image" ||
      path === "/api/generate"
    ) {

      if (
        request.method !== "POST"
      ) {

        return json(
          {
            success: false,
            error:
              "POST method required."
          },
          405
        );
      }

      try {

        const body =
          await request.json();

        const prompt =
          body?.prompt ||
          body?.text ||
          "";

        return await generateImage(
          env,
          prompt
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              String(error)
          },
          400
        );
      }
    }


    // --------------------------------------------------------
    // ASSETS
    // --------------------------------------------------------

    if (
      env.ASSETS
    ) {

      return env.ASSETS.fetch(
        request
      );
    }


    // --------------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------------

    return json(
      {
        success: false,
        error:
          "Endpoint not found",
        path
      },
      404
    );
  }
};
