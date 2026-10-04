// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// Live Score + Backup API + Fixtures + Scorecard
// Ball-by-Ball + Points + AI Image + Health + Debug
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";

const CRICKET_LIVE_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/live";

const CRICKET_LIVE_SCORECARD_URL =
  "https://cricketliveapi.com/api/v1/cricket/match";


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
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=UTF-8",
        ...extra
      }
    }
  );
}


// ============================================================
// SAFE JSON FETCH
// ============================================================

async function safeJsonFetch(url, options = {}) {
  const response = await fetch(url, options);

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = {
      raw: text
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}


// ============================================================
// TEAM OBJECT
// ============================================================

function getTeamObject(match, side) {

  if (!match) return null;

  if (side === 1) {

    return (
      match.first_team ||
      match.team1 ||
      match.teams?.[0] ||
      null
    );

  }

  return (
    match.second_team ||
    match.team2 ||
    match.teams?.[1] ||
    null
  );
}


// ============================================================
// TEAM NAME
// ============================================================

function extractTeamName(match, side) {

  const team = getTeamObject(match, side);

  if (team) {

    return (
      team.full_name ||
      team.fullName ||
      team.name ||
      team.short_name ||
      team.shortName ||
      team.code ||
      team.abbreviation ||
      "-"
    );

  }

  if (side === 1) {

    return (
      match.team1_name ||
      match.team1 ||
      match.team1Name ||
      "-"
    );

  }

  return (
    match.team2_name ||
    match.team2 ||
    match.team2Name ||
    "-"
  );
}


// ============================================================
// TEAM SCORE
// ============================================================

function extractTeamScore(match, side) {

  const team = getTeamObject(match, side);

  if (team) {

    // Direct score
    if (
      typeof team.score === "string" &&
      team.score.trim()
    ) {
      return team.score;
    }

    // Numeric score
    if (
      team.score !== undefined &&
      team.score !== null &&
      typeof team.score !== "object"
    ) {
      return String(team.score);
    }

    // Innings fallback
    if (
      Array.isArray(team.innings) &&
      team.innings.length
    ) {

      const innings =
        team.innings[team.innings.length - 1];

      if (innings) {

        if (
          innings.runs !== undefined &&
          innings.wickets !== undefined
        ) {

          let score =
            `${innings.runs}/${innings.wickets}`;

          if (
            innings.overs !== undefined &&
            innings.overs !== null &&
            innings.overs !== ""
          ) {
            score += ` (${innings.overs} ov)`;
          }

          return score;
        }

        if (
          innings.score !== undefined &&
          innings.score !== null
        ) {
          return String(innings.score);
        }
      }
    }
  }


  // Match-level fallback

  const possibleScores =
    side === 1
      ? [
          match.score1,
          match.team1_score,
          match.team1Score,
          match.first_score
        ]
      : [
          match.score2,
          match.team2_score,
          match.team2Score,
          match.second_score
        ];

  for (const value of possibleScores) {

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value);
    }
  }


  // CricAPI style score arrays

  if (Array.isArray(match.score)) {

    const item = match.score[side - 1];

    if (item) {

      if (
        typeof item === "string"
      ) {
        return item;
      }

      if (
        item.r !== undefined &&
        item.w !== undefined
      ) {

        let score =
          `${item.r}/${item.w}`;

        if (item.o !== undefined) {
          score += ` (${item.o} ov)`;
        }

        return score;
      }
    }
  }


  return "-";
}


// ============================================================
// OVERS
// ============================================================

function extractTeamOvers(match, side) {

  const team = getTeamObject(match, side);

  if (
    team &&
    Array.isArray(team.innings) &&
    team.innings.length
  ) {

    const innings =
      team.innings[team.innings.length - 1];

    if (
      innings &&
      innings.overs !== undefined &&
      innings.overs !== null
    ) {
      return String(innings.overs);
    }
  }

  return "";
}


// ============================================================
// FORMAT
// ============================================================

function extractFormat(match) {

  return (
    match.format ||
    match.match_type ||
    match.matchType ||
    "-"
  );
}


// ============================================================
// SERIES
// ============================================================

function extractSeries(match) {

  return (
    match.series_name ||
    match.series ||
    match.title ||
    "-"
  );
}


// ============================================================
// VENUE
// ============================================================

function extractVenue(match) {

  if (typeof match.venue === "string") {
    return match.venue;
  }

  if (match.venue?.name) {
    return match.venue.name;
  }

  return "-";
}


// ============================================================
// STATUS
// ============================================================

function extractStatus(match) {

  return (
    match.status_detail ||
    match.status ||
    match.short_status ||
    match.state ||
    "-"
  );
}


// ============================================================
// MATCH ID
// ============================================================

function extractMatchId(match) {

  return (
    match.match_id ||
    match.matchId ||
    match.id ||
    match.match_id_number ||
    ""
  );
}


// ============================================================
// NORMALIZE LIVE MATCH
// ============================================================

function normalizeMatch(match, source) {

  return {
    match_id: extractMatchId(match),

    team1: extractTeamName(match, 1),
    team2: extractTeamName(match, 2),

    score1: extractTeamScore(match, 1),
    score2: extractTeamScore(match, 2),

    overs1: extractTeamOvers(match, 1),
    overs2: extractTeamOvers(match, 2),

    format: extractFormat(match),

    status: extractStatus(match),

    venue: extractVenue(match),

    series: extractSeries(match),

    source
  };
}


// ============================================================
// CRICAPI PRIMARY
// ============================================================

async function getCricApiLive(env) {

  if (!env.CRICKET_API_KEY) {
    throw new Error("CRICKET_API_KEY missing");
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(
      env.CRICKET_API_KEY
    )}`;

  const result =
    await safeJsonFetch(url);

  if (!result.ok) {

    throw new Error(
      `CricAPI HTTP ${result.status}`
    );
  }

  const data = result.data;

  if (!data) {
    throw new Error("CricAPI empty response");
  }

  if (
    data.success === false ||
    data.status === false
  ) {

    const message =
      data.reason ||
      data.message ||
      data.error ||
      "CricAPI request failed";

    throw new Error(message);
  }

  let matches = [];

  if (Array.isArray(data.data)) {
    matches = data.data;
  } else if (Array.isArray(data.matches)) {
    matches = data.matches;
  } else if (Array.isArray(data.results)) {
    matches = data.results;
  }

  return matches.map(
    match =>
      normalizeMatch(match, "CricAPI")
  );
}


// ============================================================
// CRICKET LIVE API BACKUP
// ============================================================

async function getCricketLiveApi(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN missing"
    );
  }

  const result =
    await safeJsonFetch(
      CRICKET_LIVE_API_URL,
      {
        headers: {
          "Authorization":
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
          "Accept": "application/json"
        }
      }
    );

  if (!result.ok) {

    throw new Error(
      `CricketLiveApi HTTP ${result.status}`
    );
  }

  const data = result.data;

  if (!data) {
    throw new Error(
      "CricketLiveApi empty response"
    );
  }

  let matches = [];

  if (Array.isArray(data.data)) {
    matches = data.data;
  } else if (Array.isArray(data.matches)) {
    matches = data.matches;
  } else if (Array.isArray(data.results)) {
    matches = data.results;
  }

  return matches.map(
    match =>
      normalizeMatch(match, "CricketLiveApi")
  );
}


// ============================================================
// GET LIVE MATCHES
// ============================================================

async function getLiveMatches(env) {

  // Primary API
  try {

    const primary =
      await getCricApiLive(env);

    if (primary.length > 0) {

      return {
        success: true,
        source: "CricAPI",
        matches: primary
      };
    }

  } catch (error) {

    console.log(
      "CricAPI failed:",
      error.message
    );
  }


  // Backup API
  try {

    const backup =
      await getCricketLiveApi(env);

    return {
      success: true,
      source: "CricketLiveApi",
      matches: backup
    };

  } catch (error) {

    console.log(
      "CricketLiveApi failed:",
      error.message
    );

    throw new Error(
      `Both live score APIs failed. ${error.message}`
    );
  }
}


// ============================================================
// SCORECARD - CRICKETLIVEAPI
// Supports numeric IDs such as 151554
// ============================================================

async function getCricketLiveApiScorecard(
  env,
  matchId
) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN missing"
    );
  }

  if (!matchId) {

    throw new Error(
      "Match ID is required"
    );
  }

  const safeId =
    encodeURIComponent(String(matchId).trim());

  const url =
    `${CRICKET_LIVE_SCORECARD_URL}/${safeId}/scorecard`;

  const result =
    await safeJsonFetch(
      url,
      {
        headers: {
          "Authorization":
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
          "Accept": "application/json"
        }
      }
    );

  if (!result.ok) {

    throw new Error(
      `CricketLiveApi scorecard HTTP ${result.status}`
    );
  }

  return result.data;
}


// ============================================================
// SCORECARD - CRICAPI
// Only for full CricAPI UUID
// ============================================================

function isUuidMatchId(id) {

  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    .test(String(id).trim());
}


async function getCricApiScorecard(
  env,
  matchId
) {

  if (!env.CRICKET_API_KEY) {

    throw new Error(
      "CRICKET_API_KEY missing"
    );
  }

  if (!isUuidMatchId(matchId)) {

    throw new Error(
      "Not a CricAPI UUID"
    );
  }

  const url =
    `https://api.cricapi.com/v1/match_scorecard` +
    `?apikey=${encodeURIComponent(
      env.CRICKET_API_KEY
    )}` +
    `&id=${encodeURIComponent(
      matchId
    )}`;

  const result =
    await safeJsonFetch(url);

  if (!result.ok) {

    throw new Error(
      `CricAPI scorecard HTTP ${result.status}`
    );
  }

  if (!result.data) {

    throw new Error(
      "CricAPI scorecard empty response"
    );
  }

  return result.data;
}


// ============================================================
// SMART SCORECARD
// Numeric ID -> CricketLiveApi
// UUID -> CricAPI first, then backup
// ============================================================

async function getScorecard(
  env,
  matchId
) {

  const id =
    String(matchId || "").trim();

  if (!id) {

    throw new Error(
      "Match ID is required"
    );
  }


  // ----------------------------------------------------------
  // NUMERIC MATCH ID
  // Example: 151554
  // ----------------------------------------------------------

  if (/^\d+$/.test(id)) {

    return await getCricketLiveApiScorecard(
      env,
      id
    );
  }


  // ----------------------------------------------------------
  // UUID MATCH ID
  // ----------------------------------------------------------

  if (isUuidMatchId(id)) {

    try {

      return await getCricApiScorecard(
        env,
        id
      );

    } catch (error) {

      console.log(
        "CricAPI scorecard failed:",
        error.message
      );

      // Backup attempt
      return await getCricketLiveApiScorecard(
        env,
        id
      );
    }
  }


  throw new Error(
    "Invalid Match ID. Use a numeric ID like 151554 or a full CricAPI UUID."
  );
}


// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  // Try CricAPI
  try {

    if (env.CRICKET_API_KEY) {

      const url =
        `https://api.cricapi.com/v1/matches` +
        `?apikey=${encodeURIComponent(
          env.CRICKET_API_KEY
        )}`;

      const result =
        await safeJsonFetch(url);

      if (
        result.ok &&
        result.data
      ) {

        let matches = [];

        if (
          Array.isArray(
            result.data.data
          )
        ) {
          matches =
            result.data.data;
        }

        if (matches.length) {

          return matches.map(
            match =>
              normalizeMatch(
                match,
                "CricAPI"
              )
          );
        }
      }
    }

  } catch (error) {

    console.log(
      "Fixtures primary failed:",
      error.message
    );
  }


  // Backup CricketLiveApi schedule
  try {

    if (!env.CRICKET_LIVE_API_TOKEN) {
      throw new Error(
        "CRICKET_LIVE_API_TOKEN missing"
      );
    }

    const result =
      await safeJsonFetch(
        "https://cricketliveapi.com/api/v1/cricket/schedule",
        {
          headers: {
            "Authorization":
              `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
            "Accept":
              "application/json"
          }
        }
      );

    if (!result.ok) {

      throw new Error(
        `Schedule HTTP ${result.status}`
      );
    }

    const data = result.data;

    let matches = [];

    if (Array.isArray(data?.data)) {
      matches = data.data;
    } else if (
      Array.isArray(data?.matches)
    ) {
      matches = data.matches;
    }

    return matches.map(
      match =>
        normalizeMatch(
          match,
          "CricketLiveApi"
        )
    );

  } catch (error) {

    console.log(
      "Fixtures backup failed:",
      error.message
    );

    return [];
  }
}


// ============================================================
// GENERIC MATCH API
// ============================================================

async function getMatchData(
  env,
  matchId,
  endpoint
) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN missing"
    );
  }

  const safeId =
    encodeURIComponent(
      String(matchId).trim()
    );

  const url =
    `https://cricketliveapi.com/api/v1/cricket/match/${safeId}/${endpoint}`;

  const result =
    await safeJsonFetch(
      url,
      {
        headers: {
          "Authorization":
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
          "Accept":
            "application/json"
        }
      }
    );

  if (!result.ok) {

    throw new Error(
      `${endpoint} HTTP ${result.status}`
    );
  }

  return result.data;
}


// ============================================================
// AI IMAGE
// ============================================================

async function generateImage(
  env,
  body
) {

  if (!env.AI) {

    throw new Error(
      "Workers AI binding missing"
    );
  }

  const player =
    body.playerName ||
    body.player ||
    "Virat Kohli";

  const team =
    body.team ||
    "India";

  const pose =
    body.pose ||
    "Batting";

  const type =
    body.type ||
    "Batsman";

  const hand =
    body.hand ||
    "Right";

  const style =
    body.style ||
    "Realistic";

  const jersey =
    body.jersey ||
    "Blue";

  const number =
    body.number ||
    "18";

  const stadium =
    body.stadium ||
    "International Stadium";

  const weather =
    body.weather ||
    "Clear";

  const matchTime =
    body.matchTime ||
    "Day";

  const camera =
    body.camera ||
    "Front";

  const tournament =
    body.tournament ||
    "T20 World Cup";


  const prompt =
    `Photorealistic professional cricket sports photography.
    Cricket player ${player} representing ${team}.
    Player type ${type}.
    ${pose} pose.
    ${hand} handed player.
    ${style} visual style.
    Wearing ${team} cricket jersey, ${jersey} color,
    jersey number ${number}.
    Playing at ${stadium}.
    ${weather} weather.
    ${matchTime} match.
    ${camera} camera angle.
    Tournament ${tournament}.
    Dramatic stadium floodlights,
    realistic cricket field,
    packed crowd,
    ultra realistic face,
    realistic body proportions,
    professional sports photography,
    cinematic lighting,
    high detail,
    sharp focus,
    no text,
    no watermark.`;

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt
      }
    );

  return result;
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
      !!env.AI,

    cricketApiKey:
      !!env.CRICKET_API_KEY,

    cricketLiveApiToken:
      !!env.CRICKET_LIVE_API_TOKEN,

    assets:
      !!env.ASSETS,

    endpoints: [
      "/api/generate",
      "/api/generate-image",
      "/api/score",
      "/api/live-score",
      "/api/fixtures",
      "/api/scorecard",
      "/api/ball-by-ball",
      "/api/match-points",
      "/api/health",
      "/api/debug-live"
    ]
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
        "CRICKET_LIVE_API_TOKEN missing"
    };
  }

  const result =
    await safeJsonFetch(
      CRICKET_LIVE_API_URL,
      {
        headers: {
          "Authorization":
            `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
          "Accept":
            "application/json"
        }
      }
    );

  const data = result.data;

  let matches = [];

  if (Array.isArray(data?.data)) {
    matches = data.data;
  } else if (
    Array.isArray(data?.matches)
  ) {
    matches = data.matches;
  }

  const first =
    matches[0] || {};

  return {
    success: result.ok,

    httpStatus:
      result.status,

    matchCount:
      matches.length,

    topLevelKeys:
      Object.keys(first),

    first_team:
      first.first_team || null,

    second_team:
      first.second_team || null,

    team1:
      first.team1 || null,

    team2:
      first.team2 || null,

    teams:
      first.teams || null,

    score:
      first.score || null,

    scores:
      first.scores || null,

    status:
      first.status || null,

    format:
      first.format || null,

    venue:
      first.venue || null,

    series:
      first.series ||
      first.series_name ||
      null,

    last_ball:
      first.last_ball ||
      null
  };
}


// ============================================================
// MAIN FETCH
// ============================================================

export default {

  async fetch(request, env) {

    // OPTIONS
    if (request.method === "OPTIONS") {

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

    if (path === "/api/health") {

      return json(
        health(env)
      );
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (path === "/api/debug-live") {

      try {

        return json(
          await debugLive(env)
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message
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
          result
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message
          },
          500
        );
      }
    }


    // ========================================================
    // FIXTURES
    // ========================================================

    if (path === "/api/fixtures") {

      try {

        const matches =
          await getFixtures(env);

        return json(
          {
            success: true,
            matches
          }
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message,
            matches: []
          },
          500
        );
      }
    }


    // ========================================================
    // SCORECARD
    // ========================================================

    if (path === "/api/scorecard") {

      const matchId =
        url.searchParams.get("id");

      if (!matchId) {

        return json(
          {
            success: false,
            error:
              "Match ID is required"
          },
          400
        );
      }

      try {

        const data =
          await getScorecard(
            env,
            matchId
          );

        return json(
          {
            success: true,

            match_id:
              matchId,

            source:
              /^\d+$/.test(matchId)
                ? "CricketLiveApi"
                : "CricAPI / CricketLiveApi",

            data
          }
        );

      } catch (error) {

        return json(
          {
            success: false,

            match_id:
              matchId,

            error:
              error.message
          },
          500
        );
      }
    }


    // ========================================================
    // BALL BY BALL
    // ========================================================

    if (path === "/api/ball-by-ball") {

      const matchId =
        url.searchParams.get("id");

      if (!matchId) {

        return json(
          {
            success: false,
            error:
              "Match ID is required"
          },
          400
        );
      }

      try {

        const data =
          await getMatchData(
            env,
            matchId,
            "commentary"
          );

        return json(
          {
            success: true,
            match_id:
              matchId,
            data
          }
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message
          },
          500
        );
      }
    }


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (path === "/api/match-points") {

      const matchId =
        url.searchParams.get("id");

      if (!matchId) {

        return json(
          {
            success: false,
            error:
              "Match ID is required"
          },
          400
        );
      }

      try {

        const data =
          await safeJsonFetch(
            `https://cricketliveapi.com/api/v1/fantasy/match/${encodeURIComponent(matchId)}/points`,
            {
              headers: {
                "Authorization":
                  `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
                "Accept":
                  "application/json"
              }
            }
          );

        if (!data.ok) {

          throw new Error(
            `Points HTTP ${data.status}`
          );
        }

        return json(
          {
            success: true,
            match_id:
              matchId,
            data:
              data.data
          }
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message
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
              "POST required"
          },
          405
        );
      }

      try {

        const body =
          await request.json();

        const result =
          await generateImage(
            env,
            body
          );


        // ====================================================
        // WORKERS AI FLUX IMAGE
        // result.image is Base64
        // Decode Base64 before returning image
        // ====================================================

        if (
          result &&
          result.image
        ) {

          const binaryString =
            atob(result.image);

          const img =
            Uint8Array.from(
              binaryString,
              m => m.codePointAt(0)
            );

          return new Response(
            img,
            {
              headers: {
                ...corsHeaders(),
                "Content-Type":
                  "image/jpeg"
              }
            }
          );
        }


        // ====================================================
        // ARRAYBUFFER / IMAGE RESPONSE
        // ====================================================

        if (
          result instanceof ArrayBuffer
        ) {

          return new Response(
            result,
            {
              headers: {
                ...corsHeaders(),
                "Content-Type":
                  "image/png"
              }
            }
          );
        }


        // ====================================================
        // BLOB
        // ====================================================

        if (
          result instanceof Blob
        ) {

          return new Response(
            result,
            {
              headers: {
                ...corsHeaders(),
                "Content-Type":
                  "image/png"
              }
            }
          );
        }


        // ====================================================
        // JSON FALLBACK
        // ====================================================

        return json(
          {
            success: true,
            result
          }
        );

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error.message
          },
          500
        );
      }
    }


    // ========================================================
    // ASSETS
    // ========================================================

    if (
      env.ASSETS &&
      request.method === "GET"
    ) {

      try {

        const assetResponse =
          await env.ASSETS.fetch(
            request
          );

        if (
          assetResponse.status !== 404
        ) {

          return assetResponse;
        }

      } catch (error) {

        console.log(
          "Asset fetch failed:",
          error.message
        );
      }
    }


    // ========================================================
    // DEFAULT
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
