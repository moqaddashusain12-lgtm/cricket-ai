// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// ============================================================
// FEATURES
// 🔴 Live Score
// 📅 Fixtures
// 📊 Scorecard
// 🏏 Ball-by-Ball
// 🎯 Match Points
// 🤖 AI Player / Poster / Player Card
// ❤️ Health
// 🐛 Debug Live
//
// LIVE API:
// https://cricketliveapi.com/api/v1/cricket/live
//
// CRICAPI:
// https://api.cricapi.com/v1/cricScore
//
// WORKERS AI:
// @cf/black-forest-labs/flux-1-schnell
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const AI_MODEL =
  "@cf/black-forest-labs/flux-1-schnell";

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

function json(
  data,
  status = 200,
  extraHeaders = {}
) {
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
  contentType =
    "text/plain; charset=utf-8"
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

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(url, {
        ...options,
        signal:
          controller.signal
      });

    const text =
      await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
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

function safeString(
  value,
  fallback = ""
) {
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

  const str =
    String(value).trim();

  if (!str) {
    return null;
  }

  const match =
    str.match(
      /(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]*)\))?/i
    );

  if (match) {
    return {
      runs:
        Number(match[1]),

      wickets:
        Number(match[2]),

      overs:
        match[3] || "",

      raw:
        str
    };
  }

  const runOnly =
    str.match(
      /^(\d+)(?:\s*\(([^)]*)\))?$/
    );

  if (runOnly) {
    return {
      runs:
        Number(runOnly[1]),

      wickets:
        null,

      overs:
        runOnly[2] || "",

      raw:
        str
    };
  }

  return {
    raw: str
  };
}


// ============================================================
// STATUS FROM CRICKET LIVE API
// ============================================================

function getLiveApiStatus(
  match
) {
  const state =
    safeString(
      match?.state
    ).toLowerCase();

  const status =
    safeString(
      match?.status
    ).toLowerCase();

  const shortStatus =
    safeString(
      match?.short_status
    ).toLowerCase();

  const statusDetail =
    safeString(
      match?.status_detail
    ).toLowerCase();

  // ----------------------------------------------------------
  // IN PROGRESS
  // ----------------------------------------------------------

  if (
    state.includes(
      "in progress"
    ) ||
    state.includes(
      "live"
    ) ||
    status.includes(
      "in progress"
    ) ||
    status.includes(
      "live"
    )
  ) {
    return "LIVE";
  }

  // ----------------------------------------------------------
  // UPCOMING / NOT STARTED
  // ----------------------------------------------------------

  if (
    state.includes(
      "not started"
    ) ||
    state.includes(
      "upcoming"
    ) ||
    state.includes(
      "scheduled"
    )
  ) {
    return "UPCOMING";
  }

  // ----------------------------------------------------------
  // COMPLETE
  // ----------------------------------------------------------

  if (
    state.includes(
      "complete"
    ) ||
    state.includes(
      "completed"
    ) ||
    state.includes(
      "finished"
    ) ||
    statusDetail.includes(
      "won"
    ) ||
    shortStatus.includes(
      "won"
    ) ||
    shortStatus.includes(
      "draw"
    )
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


// ============================================================
// NORMALIZE SCORE
// ============================================================

function normalizeLiveTeamScore(
  team
) {
  if (!team) {
    return null;
  }

  const scoreText =
    safeString(
      team.score
    ).trim();

  const parsed =
    parseScore(
      scoreText
    );

  const innings =
    Array.isArray(
      team.innings
    )
      ? team.innings
      : [];

  return {
    runs:
      parsed?.runs ??
      null,

    wickets:
      parsed?.wickets ??
      null,

    overs:
      parsed?.overs ??
      "",

    score:
      scoreText,

    innings:

      innings.map(
        inning => ({
          innings_id:
            inning?.innings_id ??
            null,

          runs:
            inning?.runs ??
            null,

          wickets:
            inning?.wickets ??
            null,

          overs:
            inning?.overs ??
            "",

          run_rate:
            inning?.run_rate ??
            "",

          balls_left:
            inning?.balls_left ??
            null,

          target:
            inning?.target ??
            null,

          required_run_rate:
            inning?.required_run_rate ??
            "",

          is_declared:
            !!inning?.is_declared,

          is_following_on:
            !!inning?.is_following_on
        })
      )
  };
}


// ============================================================
// NORMALIZE LIVE TEAM
// ============================================================

function normalizeLiveTeam(
  team
) {
  if (!team) {
    return {
      id: null,
      name: "",
      full_name: "",
      shortname: "",
      image_id: null,
      image: "",
      score: "",
      runs: null,
      wickets: null,
      overs: "",
      innings: []
    };
  }

  const normalizedScore =
    normalizeLiveTeamScore(
      team
    );

  return {
    id:
      team?.id ??
      null,

    // Short name: IND / WI / ENGCH etc.
    name:
      safeString(
        team?.name
      ),

    shortname:
      safeString(
        team?.name
      ),

    // Full display name
    full_name:
      safeString(
        team?.full_name,
        team?.name || ""
      ),

    image_id:
      team?.image_id ??
      null,

    image:
      team?.image ||
      team?.logo ||
      "",

    score:
      normalizedScore?.score ||
      "",

    runs:
      normalizedScore?.runs ??
      null,

    wickets:
      normalizedScore?.wickets ??
      null,

    overs:
      normalizedScore?.overs ||
      "",

    innings:
      normalizedScore?.innings ||
      []
  };
}


// ============================================================
// ⭐ EXACT CRICKETLIVEAPI MATCH MAPPING
// ============================================================

function normalizeLiveMatch(
  match
) {
  const firstTeam =
    normalizeLiveTeam(
      match?.first_team
    );

  const secondTeam =
    normalizeLiveTeam(
      match?.second_team
    );

  const status =
    getLiveApiStatus(
      match
    );

  return {

    // --------------------------------------------------------
    // MATCH ID
    // --------------------------------------------------------

    id:
      match?.match_id ??
      null,

    match_id:
      match?.match_id ??
      null,

    series_id:
      match?.series_id ??
      null,

    // --------------------------------------------------------
    // MATCH NAME
    // --------------------------------------------------------

    name:
      match?.title ||
      `${firstTeam.full_name} vs ${secondTeam.full_name}`,

    title:
      match?.title ||
      "",

    match_desc:
      match?.match_desc ||
      "",

    format:
      match?.format ||
      "",

    match_type:
      match?.match_type ||
      "",

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    status:
      status,

    state:
      match?.state ||
      "",

    status_detail:
      match?.status_detail ||
      "",

    short_status:
      match?.short_status ||
      "",

    result:
      match?.status_detail ||
      match?.short_status ||
      "",

    // --------------------------------------------------------
    // SERIES
    // --------------------------------------------------------

    series:
      match?.series_name ||
      "",

    series_name:
      match?.series_name ||
      "",

    // --------------------------------------------------------
    // DATE
    // --------------------------------------------------------

    date:
      match?.date ||
      "",

    end_date:
      match?.end_date ||
      "",

    // --------------------------------------------------------
    // VENUE
    // --------------------------------------------------------

    venue:
      match?.venue ||
      "",

    venue_timezone:
      match?.venue_timezone ||
      "",

    venue_id:
      match?.venue_id ??
      null,

    // --------------------------------------------------------
    // TEAMS
    // --------------------------------------------------------

    teams: [
      firstTeam,
      secondTeam
    ],

    team1:
      firstTeam,

    team2:
      secondTeam,

    first_team:
      firstTeam,

    second_team:
      secondTeam,

    // --------------------------------------------------------
    // SCORES
    // --------------------------------------------------------

    scores: [
      normalizeLiveTeamScore(
        match?.first_team
      ),

      normalizeLiveTeamScore(
        match?.second_team
      )
    ],

    // --------------------------------------------------------
    // EXTRA
    // --------------------------------------------------------

    slug:
      match?.slug ||
      "",

    is_time_announced:
      !!match?.is_time_announced,

    raw:
      match
  };
}


// ============================================================
// CRICAPI MATCH FORMAT
// ============================================================

function formatCricScoreMatch(
  match
) {
  const teams =
    Array.isArray(
      match?.teams
    )
      ? match.teams
      : [];

  const teamInfo =
    Array.isArray(
      match?.teamInfo
    )
      ? match.teamInfo
      : [];

  const scores =
    Array.isArray(
      match?.score
    )
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
    scores[0] ||
    null;

  const score2 =
    scores[1] ||
    null;

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
        name:
          team1,

        shortname:
          teamInfo[0]?.shortname ||
          teamInfo[0]?.shortName ||
          "",

        img:
          teamInfo[0]?.img ||
          ""
      },

      {
        name:
          team2,

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
              score1?.r ??
              score1?.runs ??
              0,

            wickets:
              score1?.w ??
              score1?.wickets ??
              0,

            overs:
              score1?.o ??
              score1?.overs ??
              ""
          }
        : null,

      score2
        ? {
            inning:
              score2?.inning ||
              "",

            runs:
              score2?.r ??
              score2?.runs ??
              0,

            wickets:
              score2?.w ??
              score2?.wickets ??
              0,

            overs:
              score2?.o ??
              score2?.overs ??
              ""
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

    raw:
      match
  };
}


// ============================================================
// GENERIC STATUS FOR CRICAPI
// ============================================================

function getStatus(
  match
) {
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
// GET ALL CRICAPI MATCHES
// ============================================================

async function getAllCricketMatches(
  env
) {
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
    await fetchJSON(
      url
    );

  if (!data) {
    return [];
  }

  if (
    Array.isArray(
      data.data
    )
  ) {
    return data.data;
  }

  if (
    Array.isArray(
      data.matches
    )
  ) {
    return data.matches;
  }

  if (
    Array.isArray(
      data.result
    )
  ) {
    return data.result;
  }

  return [];
}


// ============================================================
// GET CRICKET SCORES
// ============================================================

async function getCricketScores(
  env
) {
  const matches =
    await getAllCricketMatches(
      env
    );

  return matches.map(
    formatCricScoreMatch
  );
}


// ============================================================
// GET FIXTURES
// ============================================================

async function getFixtures(
  env
) {
  const matches =
    await getAllCricketMatches(
      env
    );

  const formatted =
    matches.map(
      formatCricScoreMatch
    );

  return formatted.filter(
    match =>
      match.status !==
      "LIVE"
  );
}


// ============================================================
// LIVE API HEADERS
// ============================================================

function liveHeaders(
  env
) {
  const headers = {
    "Accept":
      "application/json"
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
// GET LIVE SCORES - EXACT API
// ============================================================

async function getLiveScores(
  env
) {
  if (
    !env.CRICKET_LIVE_API_TOKEN
  ) {
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

  // Exact API format:
  //
  // {
  //   success: true,
  //   count: 6,
  //   data: [...]
  // }

  const list =
    Array.isArray(
      data?.data
    )
      ? data.data
      : [];

  return list.map(
    normalizeLiveMatch
  );
}


// ============================================================
// GET ONLY ACTUAL LIVE MATCHES
// ============================================================

async function getOnlyLiveScores(
  env
) {
  const matches =
    await getLiveScores(
      env
    );

  return matches.filter(
    match =>
      match.status ===
      "LIVE"
  );
}


// ============================================================
// GET SCORECARD
// ============================================================

async function getScorecard(
  env,
  matchId
) {
  if (
    !env.CRICKET_LIVE_API_TOKEN
  ) {
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
    encodeURIComponent(
      matchId
    );

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
  if (
    !env.CRICKET_LIVE_API_TOKEN
  ) {
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
    encodeURIComponent(
      matchId
    );

  // First try ballByBall
  try {

    const url =
      `${base}?ballByBall=true`;

    return await fetchJSON(
      url,
      {
        headers:
          liveHeaders(env)
      }
    );

  } catch {

    // Fallback to normal match endpoint
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

  // Try Cricket Live API
  if (
    env.CRICKET_LIVE_API_TOKEN
  ) {

    try {

      const url =
        `${CRICKET_LIVE_SCORECARD_URL}/` +
        encodeURIComponent(
          matchId
        ) +
        `?points=true`;

      return await fetchJSON(
        url,
        {
          headers:
            liveHeaders(env)
        }
      );

    } catch {
      // Continue fallback
    }
  }

  // CricAPI fallback
  if (
    env.CRICKET_API_KEY
  ) {

    const url =
      `https://api.cricapi.com/v1/match_info` +
      `?apikey=` +
      encodeURIComponent(
        env.CRICKET_API_KEY
      ) +
      `&id=` +
      encodeURIComponent(
        matchId
      );

    try {

      return await fetchJSON(
        url
      );

    } catch {

      return {
        success: true,
        matchId:
          matchId,
        points: []
      };
    }
  }

  return {
    success: true,

    matchId:
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
    encodeURIComponent(
      endpoint
    ) +
    `?apikey=` +
    encodeURIComponent(
      env.CRICKET_API_KEY
    ) +
    `&id=` +
    encodeURIComponent(
      matchId
    );

  return await fetchJSON(
    url
  );
}


// ============================================================
// 🤖 AI IMAGE GENERATOR
// ============================================================
// IMPORTANT FIX:
// Uses frontend body.prompt.
// Returns Base64 JSON.
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
  // FRONTEND PROMPT
  // ----------------------------------------------------------

  if (
    typeof body.prompt ===
    "string"
  ) {
    prompt =
      body.prompt.trim();
  }

  // ----------------------------------------------------------
  // FALLBACK PROMPT
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
  // PROMPT VALIDATION
  // ----------------------------------------------------------

  if (!prompt) {
    throw new Error(
      "Image prompt is empty"
    );
  }

  // FLUX maximum prompt length
  if (
    prompt.length > 2048
  ) {
    prompt =
      prompt.substring(
        0,
        2048
      );
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
        prompt:
          prompt
      }
    );

  // ----------------------------------------------------------
  // IMAGE VALIDATION
  // ----------------------------------------------------------

  if (
    !result ||
    typeof result.image !==
      "string" ||
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

  // ----------------------------------------------------------
  // RETURN BASE64 JSON
  // ----------------------------------------------------------

  return {

    success:
      true,

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

  async fetch(
    request,
    env,
    ctx
  ) {

    // ========================================================
    // CORS OPTIONS
    // ========================================================

    if (
      request.method ===
      "OPTIONS"
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
      new URL(
        request.url
      );

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
    // ❤️ HEALTH
    // ========================================================

    if (
      pathname ===
        "/api/health" &&
      method === "GET"
    ) {

      return json({

        success:
          true,

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
    // 🐛 DEBUG LIVE
    // ========================================================

    if (
      pathname ===
        "/api/debug-live" &&
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

          success:
            true,

          endpoint:
            CRICKET_LIVE_API_URL,

          hasToken:
            !!env.CRICKET_LIVE_API_TOKEN,

          data:
            data
        });

      } catch (error) {

        return json(
          {

            success:
              false,

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
      pathname ===
        "/api/generate-image"
    ) {

      if (
        method !== "POST"
      ) {

        return json(
          {
            success:
              false,

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

            success:
              false,

            error:
              error?.message ||
              "Image generation failed"

          },
          500
        );
      }
    }


    // ========================================================
    // 🤖 /api/generate
    // ========================================================

    if (
      pathname ===
        "/api/generate"
    ) {

      if (
        method !== "POST"
      ) {

        return json(
          {
            success:
              false,

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

            success:
              false,

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
      pathname ===
        "/api/live-score" &&
      method === "GET"
    ) {

      try {

        // ----------------------------------------------------
        // Primary: CricketLiveAPI
        // ----------------------------------------------------

        let matches = [];

        if (
          env.CRICKET_LIVE_API_TOKEN
        ) {

          try {

            matches =
              await getOnlyLiveScores(
                env
              );

          } catch (error) {

            console.error(
              "LIVE API ERROR:",
              error
            );
          }
        }

        // ----------------------------------------------------
        // Fallback: CricAPI
        // ----------------------------------------------------

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

          success:
            true,

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

            success:
              false,

            error:
              error?.message ||
              "Live score failed",

            matches:
              []

          },
          500
        );
      }
    }


    // ========================================================
    // 📊 SCORE
    // ========================================================

    if (
      pathname ===
        "/api/score" &&
      method === "GET"
    ) {

      try {

        const matches =
          await getCricketScores(
            env
          );

        return json({

          success:
            true,

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

            success:
              false,

            error:
              error?.message ||
              "Score request failed",

            matches:
              []

          },
          500
        );
      }
    }


    // ========================================================
    // 📅 FIXTURES
    // ========================================================

    if (
      pathname ===
        "/api/fixtures" &&
      method === "GET"
    ) {

      try {

        const fixtures =
          await getFixtures(
            env
          );

        return json({

          success:
            true,

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

            success:
              false,

            error:
              error?.message ||
              "Fixtures request failed",

            fixtures:
              [],

            matches:
              []

          },
          500
        );
      }
    }


    // ========================================================
    // 📊 SCORECARD
    // ========================================================

    if (
      pathname ===
        "/api/scorecard" &&
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

              success:
                false,

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

          success:
            true,

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

            success:
              false,

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
      pathname ===
        "/api/ball-by-ball" &&
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

              success:
                false,

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

          success:
            true,

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

            success:
              false,

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
      pathname ===
        "/api/match-points" &&
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

              success:
                false,

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

          success:
            true,

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

            success:
              false,

            error:
              error?.message ||
              "Match points request failed"

          },
          500
        );
      }
    }


    // ========================================================
    // GENERIC API DETAIL
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

              success:
                true,

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

                success:
                  false,

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
    // NOT FOUND
    // ========================================================

    return json(
      {

        success:
          false,

        error:
          "Not found",

        path:
          pathname

      },
      404
    );
  }
};
