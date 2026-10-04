// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// ============================================================
// Features:
// 🔴 Live Score
// 📅 Fixtures
// 📊 Scorecard
// 🏏 Ball-by-Ball
// 🎯 Match Points
// 🤖 AI Cricket Image
// ❤️ Health
// 🐛 Debug Live
//
// Cloudflare Workers + Workers AI
// AI Model: FLUX.1 Schnell
// ============================================================


// ============================================================
// CONFIG
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
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",

    ...extra
  };
}


// ============================================================
// JSON RESPONSE
// ============================================================

function json(data, status = 200, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders({
        "Content-Type":
          "application/json; charset=utf-8",
        ...extraHeaders
      })
    }
  );
}


// ============================================================
// TEXT RESPONSE
// ============================================================

function textResponse(
  data,
  status = 200,
  contentType = "text/plain; charset=utf-8"
) {
  return new Response(data, {
    status,
    headers: corsHeaders({
      "Content-Type": contentType
    })
  });
}


// ============================================================
// SAFE FETCH JSON
// ============================================================

async function fetchJSON(
  url,
  options = {},
  timeout = 20000
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${
          typeof text === "string"
            ? text.substring(0, 500)
            : "Request failed"
        }`
      );
    }

    return data;

  } finally {
    clearTimeout(timer);
  }
}


// ============================================================
// SAFE STRING
// ============================================================

function safeString(value, fallback = "") {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
}


// ============================================================
// PARSE SCORE
// ============================================================

function parseScore(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  const str = String(value).trim();

  if (!str) {
    return null;
  }

  const match = str.match(
    /(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]*)\))?/i
  );

  if (match) {
    return {
      runs: Number(match[1]),
      wickets: Number(match[2]),
      overs: match[3] || ""
    };
  }

  const runOnly = str.match(
    /^(\d+)(?:\s*\(([^)]*)\))?$/
  );

  if (runOnly) {
    return {
      runs: Number(runOnly[1]),
      wickets: null,
      overs: runOnly[2] || ""
    };
  }

  return {
    raw: str
  };
}


// ============================================================
// STATUS
// ============================================================

function getStatus(match) {
  const text = [
    match?.status,
    match?.matchStatus,
    match?.state,
    match?.result,
    match?.venueStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    text.includes("live") ||
    text.includes("in progress") ||
    text.includes("playing")
  ) {
    return "LIVE";
  }

  if (
    text.includes("delay") ||
    text.includes("rain")
  ) {
    return "DELAYED";
  }

  if (
    text.includes("stumps") ||
    text.includes("stump")
  ) {
    return "STUMPS";
  }

  if (
    text.includes("won") ||
    text.includes("result") ||
    text.includes("completed") ||
    text.includes("finished")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


// ============================================================
// FORMAT CRICAPI MATCH
// ============================================================

function formatCricScoreMatch(match) {
  const teams =
    Array.isArray(match?.teams)
      ? match.teams
      : [];

  const teamInfo =
    Array.isArray(match?.teamInfo)
      ? match.teamInfo
      : [];

  const scores =
    Array.isArray(match?.score)
      ? match.score
      : [];

  const team1 =
    teams[0] ||
    teamInfo[0]?.name ||
    match?.team1 ||
    "Team 1";

  const team2 =
    teams[1] ||
    teamInfo[1]?.name ||
    match?.team2 ||
    "Team 2";

  const score1 =
    scores[0] || null;

  const score2 =
    scores[1] || null;

  return {
    id:
      match?.id ||
      match?.matchId ||
      null,

    name:
      match?.name ||
      `${team1} vs ${team2}`,

    matchType:
      match?.matchType ||
      match?.type ||
      "",

    status:
      getStatus(match),

    rawStatus:
      match?.status ||
      match?.matchStatus ||
      "",

    venue:
      match?.venue ||
      match?.venueName ||
      "",

    date:
      match?.date ||
      match?.dateTimeGMT ||
      match?.dateTime ||
      "",

    dateTimeGMT:
      match?.dateTimeGMT ||
      "",

    series:
      match?.series ||
      match?.seriesName ||
      "",

    teams: [
      {
        name: team1,
        shortname:
          teamInfo[0]?.shortname ||
          teamInfo[0]?.shortName ||
          "",
        img:
          teamInfo[0]?.img ||
          ""
      },
      {
        name: team2,
        shortname:
          teamInfo[1]?.shortname ||
          teamInfo[1]?.shortName ||
          "",
        img:
          teamInfo[1]?.img ||
          ""
      }
    ],

    scores: [
      score1
        ? {
            inning:
              score1?.inning ||
              "",
            runs:
              score1?.r ?? score1?.runs ?? 0,
            wickets:
              score1?.w ?? score1?.wickets ?? 0,
            overs:
              score1?.o ?? score1?.overs ?? ""
          }
        : null,

      score2
        ? {
            inning:
              score2?.inning ||
              "",
            runs:
              score2?.r ?? score2?.runs ?? 0,
            wickets:
              score2?.w ?? score2?.wickets ?? 0,
            overs:
              score2?.o ?? score2?.overs ?? ""
          }
        : null
    ],

    result:
      match?.status ||
      match?.result ||
      "",

    toss:
      match?.toss ||
      "",

    raw: match
  };
}


// ============================================================
// GET CRICKET API MATCHES
// ============================================================

async function getAllCricketMatches(env) {
  if (!env.CRICKET_API_KEY) {
    throw new Error(
      "CRICKET_API_KEY secret missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=` +
    encodeURIComponent(
      env.CRICKET_API_KEY
    );

  const data =
    await fetchJSON(url);

  if (!data) {
    return [];
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.matches)) {
    return data.matches;
  }

  if (Array.isArray(data.result)) {
    return data.result;
  }

  return [];
}


// ============================================================
// GET CRICKET SCORES
// ============================================================

async function getCricketScores(env) {
  const matches =
    await getAllCricketMatches(env);

  return matches.map(
    formatCricScoreMatch
  );
}


// ============================================================
// GET FIXTURES
// ============================================================

async function getFixtures(env) {
  const matches =
    await getAllCricketMatches(env);

  const formatted =
    matches.map(
      formatCricScoreMatch
    );

  return formatted.filter(
    match =>
      match.status !== "LIVE"
  );
}


// ============================================================
// LIVE API HEADERS
// ============================================================

function liveHeaders(env) {
  const headers = {
    "Accept": "application/json"
  };

  if (
    env.CRICKET_LIVE_API_TOKEN
  ) {
    headers.Authorization =
      `Bearer ${env.CRICKET_LIVE_API_TOKEN}`;

    headers["X-API-Key"] =
      env.CRICKET_LIVE_API_TOKEN;
  }

  return headers;
}


// ============================================================
// FIND ARRAY INSIDE OBJECT
// ============================================================

function findArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const keys = [
    "data",
    "matches",
    "results",
    "response",
    "live",
    "fixtures",
    "items"
  ];

  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  return [];
}


// ============================================================
// NORMALIZE LIVE MATCH
// ============================================================

function normalizeLiveMatch(match) {
  const teams =
    Array.isArray(match?.teams)
      ? match.teams
      : [];

  const team1 =
    match?.team1?.name ||
    match?.team1 ||
    teams[0]?.name ||
    teams[0] ||
    match?.homeTeam?.name ||
    match?.homeTeam ||
    "Team 1";

  const team2 =
    match?.team2?.name ||
    match?.team2 ||
    teams[1]?.name ||
    teams[1] ||
    match?.awayTeam?.name ||
    match?.awayTeam ||
    "Team 2";

  const scores =
    Array.isArray(match?.score)
      ? match.score
      : Array.isArray(match?.scores)
      ? match.scores
      : [];

  const score1 =
    scores[0] || {};

  const score2 =
    scores[1] || {};

  return {
    id:
      match?.id ||
      match?.matchId ||
      match?.match_id ||
      null,

    name:
      match?.name ||
      match?.matchName ||
      `${team1} vs ${team2}`,

    teams: [
      {
        name:
          typeof team1 === "object"
            ? team1.name
            : team1,

        shortname:
          typeof team1 === "object"
            ? (
                team1.shortname ||
                team1.shortName ||
                ""
              )
            : "",

        img:
          typeof team1 === "object"
            ? (
                team1.img ||
                team1.image ||
                ""
              )
            : ""
      },

      {
        name:
          typeof team2 === "object"
            ? team2.name
            : team2,

        shortname:
          typeof team2 === "object"
            ? (
                team2.shortname ||
                team2.shortName ||
                ""
              )
            : "",

        img:
          typeof team2 === "object"
            ? (
                team2.img ||
                team2.image ||
                ""
              )
            : ""
      }
    ],

    status:
      getStatus(match),

    statusText:
      match?.status ||
      match?.matchStatus ||
      "",

    venue:
      match?.venue ||
      match?.venueName ||
      "",

    date:
      match?.date ||
      match?.dateTime ||
      match?.dateTimeGMT ||
      "",

    series:
      match?.series ||
      match?.seriesName ||
      "",

    matchType:
      match?.matchType ||
      match?.type ||
      "",

    scores: [
      normalizeScoreObject(score1),
      normalizeScoreObject(score2)
    ],

    result:
      match?.result ||
      "",

    raw: match
  };
}


// ============================================================
// NORMALIZE SCORE OBJECT
// ============================================================

function normalizeScoreObject(score) {
  if (!score) {
    return null;
  }

  if (typeof score === "string") {
    return parseScore(score);
  }

  return {
    inning:
      score?.inning ||
      score?.innings ||
      "",

    runs:
      score?.runs ??
      score?.r ??
      score?.score ??
      0,

    wickets:
      score?.wickets ??
      score?.w ??
      0,

    overs:
      score?.overs ??
      score?.o ??
      "",

    raw: score
  };
}


// ============================================================
// GET LIVE SCORES
// ============================================================

async function getLiveScores(env) {
  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret missing"
    );
  }

  const data =
    await fetchJSON(
      CRICKET_LIVE_API_URL,
      {
        headers:
          liveHeaders(env)
      }
    );

  const list =
    findArray(data);

  return list.map(
    normalizeLiveMatch
  );
}


// ============================================================
// GET SCORECARD
// ============================================================

async function getScorecard(
  env,
  matchId
) {
  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret missing"
    );
  }

  if (!matchId) {
    throw new Error(
      "match id required"
    );
  }

  const url =
    `${CRICKET_LIVE_SCORECARD_URL}/` +
    encodeURIComponent(matchId);

  return await fetchJSON(
    url,
    {
      headers:
        liveHeaders(env)
    }
  );
}


// ============================================================
// GET BALL-BY-BALL
// ============================================================

async function getBallByBall(
  env,
  matchId
) {
  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret missing"
    );
  }

  if (!matchId) {
    throw new Error(
      "match id required"
    );
  }

  const base =
    `${CRICKET_LIVE_SCORECARD_URL}/` +
    encodeURIComponent(matchId);

  const url =
    `${base}?ballByBall=true`;

  try {
    return await fetchJSON(
      url,
      {
        headers:
          liveHeaders(env)
      }
    );
  } catch {
    // Fallback to base match endpoint
    return await fetchJSON(
      base,
      {
        headers:
          liveHeaders(env)
      }
    );
  }
}


// ============================================================
// MATCH POINTS
// ============================================================

async function getMatchPoints(
  env,
  matchId
) {
  if (!matchId) {
    throw new Error(
      "match id required"
    );
  }

  // Try live API first
  if (env.CRICKET_LIVE_API_TOKEN) {
    try {
      const url =
        `${CRICKET_LIVE_SCORECARD_URL}/` +
        encodeURIComponent(matchId) +
        `?points=true`;

      return await fetchJSON(
        url,
        {
          headers:
            liveHeaders(env)
        }
      );
    } catch {
      // Continue to generic API
    }
  }

  // Generic CricAPI fallback
  if (env.CRICKET_API_KEY) {
    const url =
      `https://api.cricapi.com/v1/match_info` +
      `?apikey=${encodeURIComponent(
        env.CRICKET_API_KEY
      )}` +
      `&id=${encodeURIComponent(
        matchId
      )}`;

    try {
      return await fetchJSON(url);
    } catch {
      return {
        success: true,
        matchId,
        points: []
      };
    }
  }

  return {
    success: true,
    matchId,
    points: []
  };
}


// ============================================================
// GENERIC MATCH DETAIL
// ============================================================

async function getGenericMatchDetail(
  env,
  endpoint,
  matchId
) {
  if (!env.CRICKET_API_KEY) {
    throw new Error(
      "CRICKET_API_KEY secret missing"
    );
  }

  if (!endpoint) {
    throw new Error(
      "endpoint required"
    );
  }

  if (!matchId) {
    throw new Error(
      "match id required"
    );
  }

  const url =
    `https://api.cricapi.com/v1/` +
    encodeURIComponent(endpoint) +
    `?apikey=` +
    encodeURIComponent(
      env.CRICKET_API_KEY
    ) +
    `&id=` +
    encodeURIComponent(matchId);

  return await fetchJSON(url);
}


// ============================================================
// 🤖 AI IMAGE GENERATOR
// ============================================================
// IMPORTANT FIX:
// Frontend sends { prompt: "..." }
// Worker now actually uses that prompt.
// ============================================================

async function generateImage(
  env,
  body = {}
) {
  if (!env.AI) {
    throw new Error(
      "Workers AI binding missing"
    );
  }

  let prompt = "";

  // ----------------------------------------------------------
  // USE FRONTEND PROMPT
  // ----------------------------------------------------------

  if (
    typeof body.prompt === "string"
  ) {
    prompt =
      body.prompt.trim();
  }

  // ----------------------------------------------------------
  // FALLBACK STRUCTURED PROMPT
  // ----------------------------------------------------------

  if (!prompt) {
    const player =
      body.playerName ||
      body.player ||
      "Virat Kohli";

    const team =
      body.team ||
      "India";

    const type =
      body.type ||
      "Batsman";

    const pose =
      body.pose ||
      "batting";

    const hand =
      body.hand ||
      "right hand";

    const style =
      body.style ||
      "photorealistic";

    const jersey =
      body.jersey ||
      body.color ||
      "blue";

    const number =
      body.number ||
      "18";

    const stadium =
      body.stadium ||
      "modern cricket stadium";

    const weather =
      body.weather ||
      "clear";

    const time =
      body.time ||
      "day";

    const camera =
      body.camera ||
      "front";

    const tournament =
      body.tournament ||
      "T20 World Cup";

    prompt = `
Photorealistic cinematic professional cricket sports
photography of ${player}, representing ${team},
${pose} pose, ${type}, ${hand}, wearing a realistic
${team} ${jersey} cricket jersey with number ${number},
playing at a ${stadium}, ${weather} weather,
${time} match atmosphere, ${camera} camera angle,
${style} style, ${tournament} tournament atmosphere,
packed cricket stadium, dramatic floodlights,
realistic face, realistic body proportions,
detailed cricket equipment, ultra realistic,
high detail, professional sports photography,
vertical 9:16, no text, no watermark.
`
      .replace(/\s+/g, " ")
      .trim();
  }

  // ----------------------------------------------------------
  // VALIDATE PROMPT
  // ----------------------------------------------------------

  if (!prompt) {
    throw new Error(
      "Image prompt is empty"
    );
  }

  // FLUX prompt maximum
  if (prompt.length > 2048) {
    prompt =
      prompt.substring(0, 2048);
  }

  console.log(
    "AI IMAGE PROMPT:",
    prompt
  );

  // ----------------------------------------------------------
  // CLOUDFLARE WORKERS AI
  // ----------------------------------------------------------

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt: prompt
      }
    );

  console.log(
    "AI IMAGE RESPONSE RECEIVED:",
    !!result
  );

  // ----------------------------------------------------------
  // FLUX RETURNS BASE64 IMAGE
  // ----------------------------------------------------------

  if (
    !result ||
    typeof result.image !== "string" ||
    !result.image.trim()
  ) {
    console.log(
      "Workers AI response:",
      result
    );

    throw new Error(
      "Workers AI ने image नहीं लौटाई"
    );
  }

  return {
    success: true,

    image:
      result.image,

    mimeType:
      "image/jpeg",

    prompt:
      prompt
  };
}


// ============================================================
// REQUEST HANDLER
// ============================================================

export default {
  async fetch(request, env, ctx) {

    // --------------------------------------------------------
    // OPTIONS / CORS
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

    const pathname =
      url.pathname;

    const method =
      request.method.toUpperCase();


    // ========================================================
    // ROOT
    // ========================================================

    if (
      pathname === "/" &&
      method === "GET"
    ) {
      return textResponse(
        "🏏 Cricket Short Worker is running"
      );
    }


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      pathname === "/api/health" &&
      method === "GET"
    ) {
      return json({
        success: true,

        app:
          "Cricket Short",

        worker:
          "cricket-ai-app",

        workersAI:
          !!env.AI,

        cricketApiKey:
          !!env.CRICKET_API_KEY,

        cricketLiveApiToken:
          !!env.CRICKET_LIVE_API_TOKEN,

        assets:
          true,

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
      });
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (
      pathname === "/api/debug-live" &&
      method === "GET"
    ) {
      try {

        const data =
          await fetchJSON(
            CRICKET_LIVE_API_URL,
            {
              headers:
                liveHeaders(env)
            }
          );

        return json({
          success: true,
          endpoint:
            CRICKET_LIVE_API_URL,
          hasToken:
            !!env.CRICKET_LIVE_API_TOKEN,
          data
        });

      } catch (error) {

        return json(
          {
            success: false,

            endpoint:
              CRICKET_LIVE_API_URL,

            hasToken:
              !!env.CRICKET_LIVE_API_TOKEN,

            error:
              error?.message ||
              "Debug request failed"
          },
          500
        );
      }
    }


    // ========================================================
    // 🤖 GENERATE IMAGE
    // ========================================================

    if (
      pathname === "/api/generate-image"
    ) {

      if (method !== "POST") {
        return json(
          {
            success: false,
            error: "POST required"
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

        // ----------------------------------------------------
        // IMPORTANT:
        // Return JSON + Base64 instead of binary.
        // Frontend already supports this.
        // ----------------------------------------------------

        return json(
          result
        );

      } catch (error) {

        console.error(
          "GENERATE IMAGE ERROR:",
          error
        );

        return json(
          {
            success: false,

            error:
              error?.message ||
              "Image generation failed"
          },
          500
        );
      }
    }


    // ========================================================
    // /api/generate
    // Compatibility endpoint
    // ========================================================

    if (
      pathname === "/api/generate"
    ) {

      if (method !== "POST") {
        return json(
          {
            success: false,
            error: "POST required"
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

        return json(
          result
        );

      } catch (error) {

        console.error(
          "GENERATE ERROR:",
          error
        );

        return json(
          {
            success: false,
            error:
              error?.message ||
              "Generation failed"
          },
          500
        );
      }
    }


    // ========================================================
    // 🔴 LIVE SCORE
    // ========================================================

    if (
      pathname === "/api/live-score" &&
      method === "GET"
    ) {

      try {

        let matches = [];

        // Primary live API
        if (
          env.CRICKET_LIVE_API_TOKEN
        ) {
          try {
            matches =
              await getLiveScores(
                env
              );
          } catch (error) {
            console.error(
              "LIVE API ERROR:",
              error
            );
          }
        }

        // Fallback to CricAPI
        if (
          !matches.length &&
          env.CRICKET_API_KEY
        ) {
          try {

            const fallback =
              await getCricketScores(
                env
              );

            matches =
              fallback.filter(
                match =>
                  match.status ===
                  "LIVE"
              );

          } catch (error) {

            console.error(
              "CRICAPI LIVE FALLBACK ERROR:",
              error
            );
          }
        }

        return json({
          success: true,

          count:
            matches.length,

          matches:

            matches,

          updatedAt:
            new Date().toISOString()
        });

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              "Live score failed",
            matches: []
          },
          500
        );
      }
    }


    // ========================================================
    // 🔴 SCORE
    // ========================================================

    if (
      pathname === "/api/score" &&
      method === "GET"
    ) {

      try {

        const matches =
          await getCricketScores(
            env
          );

        return json({
          success: true,

          count:
            matches.length,

          matches:

            matches,

          updatedAt:
            new Date().toISOString()
        });

      } catch (error) {

        return json(
          {
            success: false,
            error:
              error?.message ||
              "Score request failed",

            matches: []
          },
          500
        );
      }
    }


    // ========================================================
    // 📅 FIXTURES
    // ========================================================

    if (
      pathname === "/api/fixtures" &&
      method === "GET"
    ) {

      try {

        const fixtures =
          await getFixtures(
            env
          );

        return json({
          success: true,

          count:
            fixtures.length,

          fixtures:

            fixtures,

          matches:

            fixtures,

          updatedAt:
            new Date().toISOString()
        });

      } catch (error) {

        return json(
          {
            success: false,

            error:
              error?.message ||
              "Fixtures request failed",

            fixtures: [],
            matches: []
          },
          500
        );
      }
    }


    // ========================================================
    // 📊 SCORECARD
    // ========================================================

    if (
      pathname === "/api/scorecard" &&
      method === "GET"
    ) {

      try {

        const matchId =
          url.searchParams.get(
            "id"
          ) ||
          url.searchParams.get(
            "matchId"
          );

        if (!matchId) {
          return json(
            {
              success: false,
              error:
                "match id required"
            },
            400
          );
        }

        const data =
          await getScorecard(
            env,
            matchId
          );

        return json({
          success: true,

          matchId:

            matchId,

          scorecard:

            data,

          data:

            data
        });

      } catch (error) {

        return json(
          {
            success: false,

            error:
              error?.message ||
              "Scorecard request failed"
          },
          500
        );
      }
    }


    // ========================================================
    // 🏏 BALL-BY-BALL
    // ========================================================

    if (
      pathname === "/api/ball-by-ball" &&
      method === "GET"
    ) {

      try {

        const matchId =
          url.searchParams.get(
            "id"
          ) ||
          url.searchParams.get(
            "matchId"
          );

        if (!matchId) {
          return json(
            {
              success: false,
              error:
                "match id required"
            },
            400
          );
        }

        const data =
          await getBallByBall(
            env,
            matchId
          );

        return json({
          success: true,

          matchId:

            matchId,

          ballByBall:

            data,

          data:

            data
        });

      } catch (error) {

        return json(
          {
            success: false,

            error:
              error?.message ||
              "Ball-by-ball request failed"
          },
          500
        );
      }
    }


    // ========================================================
    // 🎯 MATCH POINTS
    // ========================================================

    if (
      pathname === "/api/match-points" &&
      method === "GET"
    ) {

      try {

        const matchId =
          url.searchParams.get(
            "id"
          ) ||
          url.searchParams.get(
            "matchId"
          );

        if (!matchId) {
          return json(
            {
              success: false,
              error:
                "match id required"
            },
            400
          );
        }

        const data =
          await getMatchPoints(
            env,
            matchId
          );

        return json({
          success: true,

          matchId:

            matchId,

          points:

            data,

          data:

            data
        });

      } catch (error) {

        return json(
          {
            success: false,

            error:
              error?.message ||
              "Match points request failed"
          },
          500
        );
      }
    }


    // ========================================================
    // GENERIC API DETAIL ROUTE
    // ========================================================
    // Example:
    // /api/match_info?id=xxxx
    // /api/match_info?matchId=xxxx
    // ========================================================

    if (
      pathname.startsWith(
        "/api/"
      ) &&
      method === "GET"
    ) {

      const endpoint =
        pathname
          .replace(
            "/api/",
            ""
          )
          .trim();

      const knownRoutes = [
        "health",
        "debug-live",
        "score",
        "live-score",
        "fixtures",
        "scorecard",
        "ball-by-ball",
        "match-points",
        "generate",
        "generate-image"
      ];

      if (
        !knownRoutes.includes(
          endpoint
        )
      ) {

        const matchId =
          url.searchParams.get(
            "id"
          ) ||
          url.searchParams.get(
            "matchId"
          );

        if (matchId) {

          try {

            const data =
              await getGenericMatchDetail(
                env,
                endpoint,
                matchId
              );

            return json({
              success: true,

              endpoint:

                endpoint,

              matchId:

                matchId,

              data:

                data
            });

          } catch (error) {

            return json(
              {
                success: false,

                error:
                  error?.message ||
                  "API request failed"
              },
              500
            );
          }
        }
      }
    }


    // ========================================================
    // ASSETS / STATIC FILES
    // ========================================================

    // If your wrangler.jsonc has:
    //
    // "assets": {
    //   "directory": "./public"
    // }
    //
    // Cloudflare will handle public/index.html and assets.
    //
    // This Worker returns 404 only if no route matched above.
    // ========================================================

    return json(
      {
        success: false,
        error:
          "Not found",
        path:
          pathname
      },
      404
    );
  }
};
