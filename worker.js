// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// Live Score + Automatic Backup API + Debug + AI Image
// Fixtures + Scorecard + Ball-by-Ball + Match Points
// ============================================================

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
    "Access-Control-Allow-Methods":
      "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    ...extra
  };
}


// ============================================================
// JSON RESPONSE
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
// TEXT HELPERS
// ============================================================

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
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


// ============================================================
// OBJECT HELPERS
// ============================================================

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


function getNestedObject(object, keys = []) {
  const obj = asObject(object);

  if (!obj) {
    return null;
  }

  for (const key of keys) {
    if (obj[key] !== undefined) {
      const candidate = asObject(obj[key]);

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}


// ============================================================
// TEAM OBJECT
// ============================================================

function getTeamObject(match, first = true) {
  const m = asObject(match);

  if (!m) {
    return null;
  }

  const directKeys = first
    ? [
        "first_team",
        "team1",
        "team_1",
        "teamOne",
        "team_one",
        "home_team",
        "homeTeam"
      ]
    : [
        "second_team",
        "team2",
        "team_2",
        "teamTwo",
        "team_two",
        "away_team",
        "awayTeam"
      ];

  for (const key of directKeys) {
    if (m[key] !== undefined) {

      const obj = asObject(m[key]);

      if (obj) {
        return obj;
      }

      if (
        typeof m[key] === "string" ||
        typeof m[key] === "number"
      ) {
        return {
          name: String(m[key])
        };
      }
    }
  }

  const arrayCandidates = [
    m.teams,
    m.team,
    m.sides,
    m.competitors
  ];

  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate)) {
      const item = candidate[first ? 0 : 1];

      if (item) {
        const obj = asObject(item);

        if (obj) {
          return obj;
        }

        return {
          name: cleanText(item)
        };
      }
    }
  }

  return null;
}


// ============================================================
// RECURSIVE TEAM NAME FINDER
// ============================================================

function findTeamName(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const text = String(value).trim();

    if (
      text &&
      text.length < 100 &&
      !/^\d+([./]\d+)?$/.test(text)
    ) {
      return text;
    }

    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTeamName(item, depth + 1);

      if (found) {
        return found;
      }
    }

    return "";
  }

  if (typeof value === "object") {

    const preferredKeys = [
      "name",
      "team_name",
      "teamName",
      "display_name",
      "displayName",
      "full_name",
      "fullName",
      "short_name",
      "shortName",
      "title",
      "country",
      "code",
      "abbreviation",
      "abbr"
    ];

    for (const key of preferredKeys) {
      if (value[key] !== undefined) {

        const text = cleanText(value[key]);

        if (
          text &&
          text.length < 100
        ) {
          return text;
        }
      }
    }

    for (const [key, child] of Object.entries(value)) {

      if (
        [
          "score",
          "scores",
          "runs",
          "wickets",
          "overs",
          "over",
          "inning",
          "innings",
          "batting",
          "bowling"
        ].includes(key)
      ) {
        continue;
      }

      const found = findTeamName(
        child,
        depth + 1
      );

      if (found) {
        return found;
      }
    }
  }

  return "";
}


// ============================================================
// TEAM NAME
// ============================================================

function extractTeamName(match, first = true) {

  const team = getTeamObject(
    match,
    first
  );

  const teamName = findTeamName(team);

  if (teamName) {
    return teamName;
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
    const text = cleanText(m[key]);

    if (text) {
      return text;
    }
  }

  return first
    ? "Team 1"
    : "Team 2";
}


// ============================================================
// SCORE HELPERS
// ============================================================

function scoreObjectToString(score) {

  if (
    score === null ||
    score === undefined
  ) {
    return "";
  }

  if (
    typeof score === "string" ||
    typeof score === "number"
  ) {
    return String(score);
  }

  if (Array.isArray(score)) {

    for (const item of score) {
      const result =
        scoreObjectToString(item);

      if (result) {
        return result;
      }
    }

    return "";
  }

  if (typeof score === "object") {

    const runs = firstText(
      score.r,
      score.runs,
      score.run,
      score.score,
      score.total
    );

    const wickets = firstText(
      score.w,
      score.wickets,
      score.wicket,
      score.out
    );

    const overs = firstText(
      score.o,
      score.overs,
      score.over
    );

    if (runs) {

      if (wickets) {
        return `${runs}/${wickets}`;
      }

      return runs;
    }

    const nestedKeys = [
      "score",
      "scores",
      "inning",
      "innings",
      "batting"
    ];

    for (const key of nestedKeys) {

      if (score[key] !== undefined) {

        const result =
          scoreObjectToString(
            score[key]
          );

        if (result) {
          return result;
        }
      }
    }

    if (overs) {
      return "";
    }
  }

  return "";
}


// ============================================================
// TEAM SCORE
// ============================================================

function extractTeamScore(match, first = true) {

  const team =
    getTeamObject(match, first);

  if (team) {

    const result =
      scoreObjectToString(
        team.score ??
        team.scores ??
        team.current_score ??
        team.currentScore ??
        team.innings ??
        team.batting
      );

    if (result) {
      return result;
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

    const result =
      scoreObjectToString(candidate);

    if (result) {
      return result;
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

  if (team) {

    const value = firstText(
      team.overs,
      team.over,
      team.o,
      team.current_overs,
      team.currentOvers
    );

    if (value) {
      return value;
    }

    const nestedScore =
      team.score ??
      team.scores;

    if (
      nestedScore &&
      typeof nestedScore === "object"
    ) {
      const value2 = firstText(
        nestedScore.overs,
        nestedScore.over,
        nestedScore.o
      );

      if (value2) {
        return value2;
      }
    }
  }

  const m = asObject(match);

  if (!m) {
    return "";
  }

  const candidates = first
    ? [
        m.team1_overs,
        m.team1Overs,
        m.first_team_overs,
        m.firstTeamOvers
      ]
    : [
        m.team2_overs,
        m.team2Overs,
        m.second_team_overs,
        m.secondTeamOvers
      ];

  return firstText(...candidates);
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
    m.status,
    m.short_status,
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
// NORMALIZE MATCH
// ============================================================

function normalizeMatch(match, source = "unknown") {

  const team1 =
    extractTeamName(match, true);

  const team2 =
    extractTeamName(match, false);

  const score1 =
    extractTeamScore(match, true);

  const score2 =
    extractTeamScore(match, false);

  const overs1 =
    extractTeamOvers(match, true);

  const overs2 =
    extractTeamOvers(match, false);

  return {
    match_id:
      extractMatchId(match),

    team1,
    team2,

    score1,
    score2,

    overs1,
    overs2,

    format:
      extractFormat(match),

    status:
      extractStatus(match),

    venue:
      extractVenue(match),

    series:
      extractSeries(match),

    source,

    raw: match
  };
}


// ============================================================
// PRIMARY API
// ============================================================

async function fetchPrimaryLive(env) {

  if (!env.CRICKET_API_KEY) {
    throw new Error(
      "CRICKET_API_KEY is missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(
      env.CRICKET_API_KEY
    )}`;

  const response =
    await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

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

  if (
    data?.success === false
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      "CricAPI request failed"
    );
  }

  return data;
}


// ============================================================
// BACKUP API
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
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`
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
// EXTRACT ARRAY FROM API RESPONSE
// ============================================================

function extractMatches(data) {

  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data.data,
    data.matches,
    data.response,
    data.result
  ];

  for (const item of candidates) {

    if (Array.isArray(item)) {
      return item;
    }

    if (
      item &&
      typeof item === "object"
    ) {

      if (Array.isArray(item.data)) {
        return item.data;
      }

      if (Array.isArray(item.matches)) {
        return item.matches;
      }
    }
  }

  return [];
}


// ============================================================
// LIVE SCORE
// PRIMARY -> BACKUP
// ============================================================

async function getLiveMatches(env) {

  let primaryError = null;

  try {

    const primary =
      await fetchPrimaryLive(env);

    const primaryMatches =
      extractMatches(primary);

    if (primaryMatches.length > 0) {

      return {
        success: true,
        source: "CricAPI",
        matches:
          primaryMatches.map(
            item =>
              normalizeMatch(
                item,
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


  let backupError = null;

  try {

    const backup =
      await fetchBackupLive(env);

    const backupMatches =
      extractMatches(backup);

    if (backupMatches.length > 0) {

      return {
        success: true,
        source: "CricketLiveApi",
        matches:
          backupMatches.map(
            item =>
              normalizeMatch(
                item,
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
// IMPORTANT: DOES NOT RETURN API TOKEN
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
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`
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
// GUID VALIDATION
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
      encodeURIComponent(env.CRICKET_API_KEY)
    }&id=${encodeURIComponent(id)}`;

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
      encodeURIComponent(env.CRICKET_API_KEY)
    }&id=${encodeURIComponent(id)}`;

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
      encodeURIComponent(env.CRICKET_API_KEY)
    }&id=${encodeURIComponent(id)}`;

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
      encodeURIComponent(env.CRICKET_API_KEY)
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
// AI IMAGE GENERATION
// ============================================================

async function generateImage(env, prompt) {

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
          prompt: String(prompt)
        }
      );

    return new Response(
      result,
      {
        headers: corsHeaders({
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
    app: "Cricket Short",
    worker: "cricket-ai-app",

    workersAI:
      Boolean(env.AI),

    cricketApiKey:
      Boolean(env.CRICKET_API_KEY),

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

    if (
      request.method === "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers: corsHeaders()
        }
      );
    }


    const url =
      new URL(request.url);

    const path =
      url.pathname;


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      path === "/api/health"
    ) {

      return json(
        health(env)
      );
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

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


    // ========================================================
    // LIVE SCORE
    // ========================================================

    if (
      path === "/api/live-score" ||
      path === "/api/score"
    ) {

      try {

        const result =
          await getLiveMatches(env);

        return json(
          result,
          result.success ? 200 : 502
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


    // ========================================================
    // FIXTURES
    // ========================================================

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


    // ========================================================
    // SCORECARD
    // ========================================================

    if (
      path === "/api/scorecard"
    ) {

      const id =
        url.searchParams.get("id");

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


    // ========================================================
    // BALL BY BALL
    // ========================================================

    if (
      path === "/api/ball-by-ball"
    ) {

      const id =
        url.searchParams.get("id");

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


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (
      path === "/api/match-points"
    ) {

      const id =
        url.searchParams.get("id");

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


    // ========================================================
    // AI IMAGE
    // ========================================================

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


    // ========================================================
    // STATIC ASSETS
    // ========================================================

    if (
      env.ASSETS
    ) {

      return env.ASSETS.fetch(
        request
      );
    }


    // ========================================================
    // NOT FOUND
    // ========================================================

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
