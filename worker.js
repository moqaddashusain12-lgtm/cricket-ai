// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// ============================================================
// FEATURES
// 🔴 Live Score
// 📅 Fixtures
// 📊 Scorecard
// 🏏 Ball-by-Ball Commentary
// 🤖 AI Player / Poster / Player Card
// ❤️ Health
// 🐛 Debug Live
//
// AI MODEL:
// @cf/black-forest-labs/flux-1-schnell
//
// CRICKET API:
// https://api.cricapi.com/v1/cricScore
//
// CRICKET LIVE API:
// https://cricketliveapi.com/api/v1/cricket/live
//
// SCORECARD:
// https://cricketliveapi.com/api/v1/cricket/scorecard/{matchId}
//
// COMMENTARY:
// https://cricketliveapi.com/api/v1/cricket/commentary/{matchId}
// ============================================================


const AI_MODEL =
  "@cf/black-forest-labs/flux-1-schnell";


// ============================================================
// CRICAPI
// ============================================================

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";


// ============================================================
// CRICKET LIVE API
// ============================================================

// THIS IS THE CURRENT WORKING LIVE ENDPOINT
const CRICKET_LIVE_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/live";


// Official documented endpoints from your dashboard
const CRICKET_LIVE_SCORECARD_URL =
  "https://cricketliveapi.com/api/v1/cricket/scorecard";

const CRICKET_LIVE_COMMENTARY_URL =
  "https://cricketliveapi.com/api/v1/cricket/commentary";


// Alternate documented format.
// Used only as fallback if the primary endpoint returns 404.
const CRICKET_LIVE_SCORECARD_ALT_URL =
  "https://cricketliveapi.com/api/v1/cricket/match";

const CRICKET_LIVE_COMMENTARY_ALT_URL =
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
      "Content-Type, Authorization, X-API-Key",

    "Access-Control-Max-Age":
      "86400",

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

      headers:
        corsHeaders({
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
  return new Response(
    data,
    {
      status,

      headers:
        corsHeaders({
          "Content-Type":
            contentType
        })
    }
  );
}


// ============================================================
// FETCH JSON
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
      () =>
        controller.abort(),
      timeout
    );

  try {

    const response =
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    const text =
      await response.text();

    let data = null;

    try {

      data =
        text
          ? JSON.parse(text)
          : null;

    } catch {

      data = {
        raw: text
      };

    }


    if (!response.ok) {

      const error =
        new Error(
          `HTTP ${response.status}: ${
            typeof text === "string"
              ? text.substring(0, 1000)
              : "Request failed"
          }`
        );

      error.status =
        response.status;

      error.url =
        url;

      throw error;
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
// LIVE API STATUS
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


  if (
    state.includes("in progress") ||
    state.includes("live") ||
    status.includes("in progress") ||
    status.includes("live") ||
    shortStatus === "live"
  ) {

    return "LIVE";
  }


  if (
    state.includes("not started") ||
    state.includes("upcoming") ||
    state.includes("scheduled")
  ) {

    return "UPCOMING";
  }


  if (
    state.includes("complete") ||
    state.includes("completed") ||
    state.includes("finished") ||
    statusDetail.includes("won") ||
    shortStatus.includes("won") ||
    shortStatus.includes("draw")
  ) {

    return "RESULT";
  }


  return "UPCOMING";
}


// ============================================================
// NORMALIZE LIVE TEAM SCORE
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

    name:
      safeString(
        team?.name
      ),

    shortname:
      safeString(
        team?.shortname ||
        team?.short_name ||
        team?.name
      ),

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
// NORMALIZE LIVE MATCH
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

    id:
      match?.match_id ??
      match?.id ??
      null,

    match_id:
      match?.match_id ??
      match?.id ??
      null,

    series_id:
      match?.series_id ??
      null,

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

    series:
      match?.series_name ||
      "",

    series_name:
      match?.series_name ||
      "",

    date:
      match?.date ||
      "",

    end_date:
      match?.end_date ||
      "",

    venue:
      match?.venue ||
      "",

    venue_timezone:
      match?.venue_timezone ||
      "",

    venue_id:
      match?.venue_id ??
      null,

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

    scores: [

      normalizeLiveTeamScore(
        match?.first_team
      ),

      normalizeLiveTeamScore(
        match?.second_team
      )

    ],

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
// CRICAPI STATUS
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
// FORMAT CRICAPI MATCH
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
// CRICAPI - ALL MATCHES
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
// CRICAPI SCORES
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
// FIXTURES
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
// CRICKET LIVE API HEADERS
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

    // Bearer authentication
    headers.Authorization =
      `Bearer ${env.CRICKET_LIVE_API_TOKEN}`;

    // X-API-Key authentication
    headers["X-API-Key"] =
      env.CRICKET_LIVE_API_TOKEN;
  }


  return headers;
}


// ============================================================
// GET ALL LIVE API MATCHES
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
// ONLY LIVE MATCHES
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
// 📊 SCORECARD
// ============================================================
//
// PRIMARY:
// /cricket/scorecard/{matchId}
//
// FALLBACK:
// /cricket/match/{matchId}/scorecard
//
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


  // PRIMARY ENDPOINT
  const primaryUrl =
    `${CRICKET_LIVE_SCORECARD_URL}/` +
    encodeURIComponent(
      matchId
    );


  try {

    return await fetchJSON(
      primaryUrl,
      {
        headers:
          liveHeaders(env)
      }
    );

  } catch (error) {

    // Only try alternate endpoint
    // when primary endpoint is 404.

    if (
      error?.status !== 404
    ) {

      throw error;
    }
  }


  // FALLBACK ENDPOINT
  const fallbackUrl =
    `${CRICKET_LIVE_SCORECARD_ALT_URL}/` +
    encodeURIComponent(
      matchId
    ) +
    "/scorecard";


  return await fetchJSON(
    fallbackUrl,
    {
      headers:
        liveHeaders(env)
    }
  );
}


// ============================================================
// 🏏 BALL-BY-BALL COMMENTARY
// ============================================================
//
// PRIMARY:
// /cricket/commentary/{matchId}
//
// FALLBACK:
// /cricket/match/{matchId}/commentary
//
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


  // PRIMARY ENDPOINT
  const primaryUrl =
    `${CRICKET_LIVE_COMMENTARY_URL}/` +
    encodeURIComponent(
      matchId
    );


  try {

    return await fetchJSON(
      primaryUrl,
      {
        headers:
          liveHeaders(env)
      }
    );

  } catch (error) {

    if (
      error?.status !== 404
    ) {

      throw error;
    }
  }


  // FALLBACK ENDPOINT
  const fallbackUrl =
    `${CRICKET_LIVE_COMMENTARY_ALT_URL}/` +
    encodeURIComponent(
      matchId
    ) +
    "/commentary";


  return await fetchJSON(
    fallbackUrl,
    {
      headers:
        liveHeaders(env)
    }
  );
}


// ============================================================
// 🎯 MATCH POINTS
// ============================================================
//
// IMPORTANT:
// We DO NOT guess a points endpoint here.
//
// Your dashboard's listed API documentation did not give
// a confirmed points-table endpoint for this exact API version.
//
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


  return {

    success:
      false,

    matchId:
      matchId,

    available:
      false,

    error:
      "Points endpoint is not configured because the exact endpoint is not confirmed in the current API documentation."
  };
}


// ============================================================
// GENERIC CRICAPI MATCH DETAIL
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
// CONVERT UINT8ARRAY TO BASE64
// ============================================================

function bytesToBase64(
  bytes
) {

  let binary = "";

  const chunkSize =
    0x8000;


  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {

    const chunk =
      bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length
        )
      );


    binary +=
      String.fromCharCode(
        ...chunk
      );
  }


  return btoa(
    binary
  );
}


// ============================================================
// 🤖 WORKERS AI IMAGE GENERATION
// ============================================================

async function generateImage(
  request,
  env
) {

  if (!env.AI) {

    throw new Error(
      "Workers AI binding missing"
    );
  }


  let body = {};


  try {

    body =
      await request.json();

  } catch {

    body = {};
  }


  const prompt =
    safeString(
      body?.prompt
    ).trim();


  if (!prompt) {

    throw new Error(
      "prompt required"
    );
  }


  // IMPORTANT:
  // Use the prompt sent by the frontend.
  // This keeps AI Player, Poster and Player Card
  // working exactly from their frontend prompts.

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt:
          prompt
      }
    );


  if (!result) {

    throw new Error(
      "Workers AI returned empty result"
    );
  }


  // FLUX normally returns image bytes.
  if (result.image) {

    let bytes;


    if (
      result.image instanceof Uint8Array
    ) {

      bytes =
        result.image;

    } else if (
      result.image instanceof ArrayBuffer
    ) {

      bytes =
        new Uint8Array(
          result.image
        );

    } else {

      // Some runtime responses may
      // provide an array-like value.

      bytes =
        new Uint8Array(
          result.image
        );
    }


    const base64 =
      bytesToBase64(
        bytes
      );


    return json({

      success:
        true,

      image:
        base64,

      mimeType:
        "image/jpeg",

      prompt:
        prompt

    });
  }


  // Some versions may return image data
  // under a different field.

  if (
    result.data
  ) {

    return json({

      success:
        true,

      image:
        result.data,

      mimeType:
        "image/jpeg",

      prompt:
        prompt
    });
  }


  throw new Error(
    "Workers AI did not return image data"
  );
}


// ============================================================
// 🏥 HEALTH
// ============================================================

function healthResponse(
  env
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


// ============================================================
// 🐛 DEBUG LIVE
// ============================================================

async function debugLive(
  env
) {

  if (
    !env.CRICKET_LIVE_API_TOKEN
  ) {

    return json({

      success:
        false,

      error:
        "CRICKET_LIVE_API_TOKEN secret missing"
    }, 500);
  }


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

      count:
        Array.isArray(
          data?.data
        )
          ? data.data.length
          : 0,

      data:
        data

    });

  } catch (error) {

    return json({

      success:
        false,

      endpoint:
        CRICKET_LIVE_API_URL,

      error:
        error?.message ||
        String(error)

    }, 500);
  }
}


// ============================================================
// MAIN WORKER
// ============================================================

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    // --------------------------------------------------------
    // OPTIONS / CORS
    // --------------------------------------------------------

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status:
            204,

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

      return json({

        success:
          true,

        app:
          "Cricket Short",

        worker:
          "cricket-ai-app",

        message:
          "Cricket Short Worker is running",

        ai:
          !!env.AI,

        liveApi:
          !!env.CRICKET_LIVE_API_TOKEN

      });
    }


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      pathname === "/api/health" &&
      method === "GET"
    ) {

      return healthResponse(
        env
      );
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (
      pathname === "/api/debug-live" &&
      method === "GET"
    ) {

      return await debugLive(
        env
      );
    }


    // ========================================================
    // AI IMAGE
    // ========================================================

    if (
      (
        pathname === "/api/generate-image" ||
        pathname === "/api/generate"
      ) &&
      method === "POST"
    ) {

      try {

        return await generateImage(
          request,
          env
        );

      } catch (error) {

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error)

        }, 500);
      }
    }


    // ========================================================
    // LIVE SCORE
    // ========================================================

    if (
      (
        pathname === "/api/live-score" ||
        pathname === "/api/live"
      ) &&
      method === "GET"
    ) {

      try {

        const matches =
          await getOnlyLiveScores(
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

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error),

          matches:
            []

        }, 500);
      }
    }


    // ========================================================
    // ALL LIVE DATA
    // ========================================================

    if (
      pathname === "/api/live-score-all" &&
      method === "GET"
    ) {

      try {

        const matches =
          await getLiveScores(
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

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error),

          matches:
            []

        }, 500);
      }
    }


    // ========================================================
    // CRICAPI SCORE
    // ========================================================

    if (
      pathname === "/api/score" &&
      method === "GET"
    ) {

      try {

        const scores =
          await getCricketScores(
            env
          );


        return json({

          success:
            true,

          count:
            scores.length,

          matches:
            scores

        });

      } catch (error) {

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error),

          matches:
            []

        }, 500);
      }
    }


    // ========================================================
    // FIXTURES
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

          success:
            true,

          count:
            fixtures.length,

          fixtures:
            fixtures

        });

      } catch (error) {

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error),

          fixtures:
            []

        }, 500);
      }
    }


    // ========================================================
    // SCORECARD
    // ========================================================

    if (
      pathname === "/api/scorecard" &&
      method === "GET"
    ) {

      const matchId =
        url.searchParams.get(
          "id"
        ) ||
        url.searchParams.get(
          "matchId"
        );


      if (!matchId) {

        return json({

          success:
            false,

          error:
            "match id required. Example: /api/scorecard?id=174340"

        }, 400);
      }


      try {

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

          data:
            data

        });

      } catch (error) {

        return json({

          success:
            false,

          matchId:
            matchId,

          error:
            error?.message ||
            String(error)

        }, error?.status || 500);
      }
    }


    // ========================================================
    // BALL-BY-BALL
    // ========================================================

    if (
      pathname === "/api/ball-by-ball" &&
      method === "GET"
    ) {

      const matchId =
        url.searchParams.get(
          "id"
        ) ||
        url.searchParams.get(
          "matchId"
        );


      if (!matchId) {

        return json({

          success:
            false,

          error:
            "match id required. Example: /api/ball-by-ball?id=174340"

        }, 400);
      }


      try {

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

          data:
            data

        });

      } catch (error) {

        return json({

          success:
            false,

          matchId:
            matchId,

          error:
            error?.message ||
            String(error)

        }, error?.status || 500);
      }
    }


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (
      pathname === "/api/match-points" &&
      method === "GET"
    ) {

      const matchId =
        url.searchParams.get(
          "id"
        ) ||
        url.searchParams.get(
          "matchId"
        );


      if (!matchId) {

        return json({

          success:
            false,

          error:
            "match id required"

        }, 400);
      }


      try {

        return json(
          await getMatchPoints(
            env,
            matchId
          )
        );

      } catch (error) {

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error)

        }, 500);
      }
    }


    // ========================================================
    // GENERIC CRICAPI DETAIL
    // ========================================================
    //
    // Example:
    // /api/detail?endpoint=match_info&id=174340
    //
    // ========================================================

    if (
      pathname === "/api/detail" &&
      method === "GET"
    ) {

      const endpoint =
        url.searchParams.get(
          "endpoint"
        );

      const matchId =
        url.searchParams.get(
          "id"
        );


      if (
        !endpoint ||
        !matchId
      ) {

        return json({

          success:
            false,

          error:
            "endpoint and id are required"

        }, 400);
      }


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

        return json({

          success:
            false,

          error:
            error?.message ||
            String(error)

        }, error?.status || 500);
      }
    }


    // ========================================================
    // 404
    // ========================================================

    return json({

      success:
        false,

      error:
        "Route not found",

      path:
        pathname,

      available: [

        "/",

        "/api/health",

        "/api/debug-live",

        "/api/generate",

        "/api/generate-image",

        "/api/score",

        "/api/live-score",

        "/api/live-score-all",

        "/api/fixtures",

        "/api/scorecard?id=174340",

        "/api/ball-by-ball?id=174340",

        "/api/match-points?id=174340"

      ]

    }, 404);
  }
};
