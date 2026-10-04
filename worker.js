// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// ============================================================
// Live Score      -> ONLY REAL LIVE MATCHES
// Fixtures        -> ONLY UPCOMING MATCHES
// Scorecard       -> Match Scorecard
// Ball-by-Ball    -> Match Commentary
// Match Points    -> Safe fallback
// AI Image        -> Cloudflare Workers AI / Flux Schnell
// ============================================================


const AI_MODEL =
  "@cf/black-forest-labs/flux-1-schnell";


const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";


const CRICKET_LIVE_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/live";


const CRICKET_FIXTURES_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/matches/upcoming";


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
    ...extra
  };

}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(
  data,
  status = 200,
  extra = {}
) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders({
        "Content-Type":
          "application/json; charset=utf-8",
        ...extra
      })
    }
  );

}


// ============================================================
// ERROR RESPONSE
// ============================================================

function errorResponse(
  message,
  status = 500
) {

  return jsonResponse(
    {
      success: false,
      error: message
    },
    status
  );

}


// ============================================================
// SAFE JSON
// ============================================================

async function safeJSON(response) {

  const text =
    await response.text();

  try {

    return JSON.parse(text);

  } catch {

    return {
      success: false,
      raw: text
    };

  }

}


// ============================================================
// NORMALIZE MATCH
// ============================================================

function normalizeMatch(match = {}) {

  const teams =
    Array.isArray(match.teams)
      ? match.teams
      : [];

  return {
    ...match,

    id:
      match.id ??
      match.matchId ??
      match.match_id ??
      match.event_id ??
      null,

    matchId:
      match.matchId ??
      match.id ??
      match.match_id ??
      match.event_id ??
      null,

    name:
      match.name ??
      match.matchName ??
      match.title ??
      "",

    matchName:
      match.matchName ??
      match.name ??
      match.title ??
      "",

    status:
      match.status ??
      match.matchStatus ??
      match.state ??
      "",

    venue:
      match.venue ??
      match.stadium ??
      match.ground ??
      "",

    series:
      match.series ??
      match.seriesName ??
      "",

    teams
  };

}


// ============================================================
// GET RAW STATUS
// ============================================================

function getRawStatus(match = {}) {

  return String(
    match.status ??
    match.matchStatus ??
    match.state ??
    match.match_status ??
    ""
  )
    .trim()
    .toLowerCase();

}


// ============================================================
// CHECK REAL LIVE MATCH
// ============================================================

function isActuallyLive(match = {}) {

  const status =
    getRawStatus(match);


  // ----------------------------------------------------------
  // Clear LIVE words
  // ----------------------------------------------------------

  if (
    status === "live" ||
    status === "live match" ||
    status === "playing" ||
    status === "in progress" ||
    status === "in-progress" ||
    status === "ongoing" ||
    status === "started" ||
    status === "1st innings" ||
    status === "2nd innings"
  ) {

    return true;

  }


  // ----------------------------------------------------------
  // Explicit non-live states
  // ----------------------------------------------------------

  if (
    status.includes("result") ||
    status.includes("won") ||
    status.includes("loss") ||
    status.includes("draw") ||
    status.includes("complete") ||
    status.includes("completed") ||
    status.includes("finished") ||
    status.includes("abandoned") ||
    status.includes("cancelled") ||
    status.includes("canceled") ||
    status.includes("upcoming") ||
    status.includes("scheduled") ||
    status.includes("preview") ||
    status.includes("not started") ||
    status.includes("yet to start") ||
    status.includes("stumps")
  ) {

    return false;

  }


  // ----------------------------------------------------------
  // More live indicators
  // ----------------------------------------------------------

  if (
    status.includes("live") ||
    status.includes("playing") ||
    status.includes("in progress") ||
    status.includes("ongoing")
  ) {

    return true;

  }


  // ----------------------------------------------------------
  // Default: NOT LIVE
  // ----------------------------------------------------------

  return false;

}


// ============================================================
// CHECK UPCOMING
// ============================================================

function isUpcoming(match = {}) {

  const status =
    getRawStatus(match);


  if (
    status.includes("upcoming") ||
    status.includes("scheduled") ||
    status.includes("preview") ||
    status.includes("not started") ||
    status.includes("yet to start")
  ) {

    return true;

  }


  if (
    status.includes("result") ||
    status.includes("won") ||
    status.includes("loss") ||
    status.includes("draw") ||
    status.includes("complete") ||
    status.includes("completed") ||
    status.includes("finished") ||
    status.includes("abandoned") ||
    status.includes("cancelled") ||
    status.includes("canceled") ||
    status.includes("stumps")
  ) {

    return false;

  }


  // If API gives a future date/time, treat as upcoming.
  const dateValue =
    match.date ??
    match.startDate ??
    match.startTime ??
    match.dateTime ??
    match.datetime ??
    match.timestamp ??
    null;


  if (dateValue) {

    const parsed =
      Date.parse(dateValue);

    if (
      Number.isFinite(parsed) &&
      parsed > Date.now()
    ) {

      return true;

    }

  }


  return false;

}


// ============================================================
// DISPLAY STATUS
// ============================================================

function getStatus(match = {}) {

  if (
    isActuallyLive(match)
  ) {

    return "LIVE";

  }


  const raw =
    getRawStatus(match);


  if (
    raw.includes("delay") ||
    raw.includes("rain")
  ) {

    return "DELAYED";

  }


  if (
    raw.includes("stump")
  ) {

    return "STUMPS";

  }


  if (
    raw.includes("result") ||
    raw.includes("won") ||
    raw.includes("loss") ||
    raw.includes("draw") ||
    raw.includes("complete") ||
    raw.includes("completed") ||
    raw.includes("finished")
  ) {

    return "RESULT";

  }


  if (
    isUpcoming(match)
  ) {

    return "UPCOMING";

  }


  return "UPCOMING";

}


// ============================================================
// CRICAPI
// ============================================================

async function getCricketScores(env) {

  if (!env.CRICKET_API_KEY) {

    throw new Error(
      "CRICKET_API_KEY secret is missing"
    );

  }


  const url =
    `${CRICKET_API_URL}?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }`;


  const response =
    await fetch(url);


  const data =
    await safeJSON(response);


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `CricAPI HTTP ${response.status}`
    );

  }


  const list =
    data?.data ??
    data?.matches ??
    [];


  if (!Array.isArray(list)) {

    return [];

  }


  return list.map(
    normalizeMatch
  );

}


// ============================================================
// CRICKET LIVE API
// ============================================================

async function fetchCricketLiveAPI(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );

  }


  const response =
    await fetch(
      CRICKET_LIVE_API_URL,
      {
        method: "GET",
        headers: {
          "Accept":
            "application/json",
          "Authorization":
            `Bearer ${
              env.CRICKET_LIVE_API_TOKEN
            }`
        }
      }
    );


  const data =
    await safeJSON(response);


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `CricketLiveAPI HTTP ${response.status}`
    );

  }


  const list =
    data?.data ??
    data?.matches ??
    data?.results ??
    [];


  if (!Array.isArray(list)) {

    return [];

  }


  return list.map(
    normalizeMatch
  );

}


// ============================================================
// ONLY LIVE MATCHES
// ============================================================

async function getLiveScores(env) {

  const matches =
    await fetchCricketLiveAPI(
      env
    );


  // ----------------------------------------------------------
  // IMPORTANT:
  // CricketLiveAPI /cricket/live is returning some RESULT
  // matches in the current response.
  //
  // Therefore we filter them here.
  // ----------------------------------------------------------

  const liveMatches =
    matches.filter(
      isActuallyLive
    );


  return liveMatches.map(
    match => ({
      ...match,
      status: "LIVE"
    })
  );

}


// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );

  }


  const response =
    await fetch(
      CRICKET_FIXTURES_API_URL,
      {
        method: "GET",
        headers: {
          "Accept":
            "application/json",
          "Authorization":
            `Bearer ${
              env.CRICKET_LIVE_API_TOKEN
            }`
        }
      }
    );


  const data =
    await safeJSON(response);


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Fixtures HTTP ${response.status}`
    );

  }


  const list =
    data?.data ??
    data?.matches ??
    data?.results ??
    [];


  // ----------------------------------------------------------
  // Keep only upcoming matches.
  // ----------------------------------------------------------

  if (Array.isArray(list)) {

    const fixtures =
      list
        .map(normalizeMatch)
        .filter(isUpcoming)
        .map(match => ({
          ...match,
          status: "UPCOMING"
        }));


    return {
      ...data,
      success:
        data?.success !== false,
      count:
        fixtures.length,
      data:
        fixtures
    };

  }


  return data;

}


// ============================================================
// SCORE
// ============================================================

async function getScore(env) {

  // Try CricketLiveAPI first.
  try {

    const live =
      await fetchCricketLiveAPI(
        env
      );


    if (live.length > 0) {

      return live;

    }

  } catch (error) {

    console.log(
      "CricketLiveAPI score error:",
      error?.message
    );

  }


  // Fallback to CricAPI.
  try {

    return await getCricketScores(
      env
    );

  } catch (error) {

    console.log(
      "CricAPI score error:",
      error?.message
    );

    return [];

  }

}


// ============================================================
// MATCH DETAIL
// ============================================================

async function getMatchDetail(
  matchId,
  type,
  env
) {

  if (!env.CRICKET_LIVE_API_TOKEN) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );

  }


  if (!matchId) {

    throw new Error(
      "Match ID is required"
    );

  }


  let primaryURL = "";
  let fallbackURL = "";


  // ----------------------------------------------------------
  // SCORECARD
  // ----------------------------------------------------------

  if (type === "scorecard") {

    primaryURL =
      `https://cricketliveapi.com/api/v1/cricket/scorecard/${
        encodeURIComponent(
          matchId
        )
      }`;


    fallbackURL =
      `https://cricketliveapi.com/api/v1/cricket/match/${
        encodeURIComponent(
          matchId
        )
      }/scorecard`;

  }


  // ----------------------------------------------------------
  // COMMENTARY
  // ----------------------------------------------------------

  else if (
    type === "commentary"
  ) {

    primaryURL =
      `https://cricketliveapi.com/api/v1/cricket/commentary/${
        encodeURIComponent(
          matchId
        )
      }`;


    fallbackURL =
      `https://cricketliveapi.com/api/v1/cricket/match/${
        encodeURIComponent(
          matchId
        )
      }/commentary`;

  }


  else {

    throw new Error(
      "Unknown match detail type"
    );

  }


  const headers = {
    "Accept":
      "application/json",
    "Authorization":
      `Bearer ${
        env.CRICKET_LIVE_API_TOKEN
      }`
  };


  // ----------------------------------------------------------
  // PRIMARY
  // ----------------------------------------------------------

  try {

    const response =
      await fetch(
        primaryURL,
        {
          method: "GET",
          headers
        }
      );


    const data =
      await safeJSON(response);


    if (response.ok) {

      return data;

    }


    console.log(
      `${type} primary HTTP:`,
      response.status
    );

  } catch (error) {

    console.log(
      `${type} primary error:`,
      error?.message
    );

  }


  // ----------------------------------------------------------
  // FALLBACK
  // ----------------------------------------------------------

  const response =
    await fetch(
      fallbackURL,
      {
        method: "GET",
        headers
      }
    );


  const data =
    await safeJSON(response);


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `${type} HTTP ${response.status}`
    );

  }


  return data;

}


// ============================================================
// MATCH POINTS
// ============================================================

async function getMatchPoints() {

  return {

    success: true,

    configured: false,

    message:
      "Match Points API endpoint is not configured.",

    data: []

  };

}


// ============================================================
// BYTES -> BASE64
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


    binary += String.fromCharCode(
      ...chunk
    );

  }


  return btoa(binary);

}


// ============================================================
// IMAGE VALUE -> BASE64
// ============================================================

async function imageValueToBase64(
  value
) {

  if (!value) {

    return null;

  }


  // ArrayBuffer
  if (
    value instanceof ArrayBuffer
  ) {

    return bytesToBase64(
      new Uint8Array(
        value
      )
    );

  }


  // Uint8Array / TypedArray
  if (
    value instanceof Uint8Array ||
    ArrayBuffer.isView(value)
  ) {

    return bytesToBase64(
      new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      )
    );

  }


  // Blob
  if (
    typeof Blob !== "undefined" &&
    value instanceof Blob
  ) {

    const buffer =
      await value.arrayBuffer();


    return bytesToBase64(
      new Uint8Array(
        buffer
      )
    );

  }


  // String
  if (
    typeof value === "string"
  ) {

    if (
      value.startsWith(
        "data:image/"
      )
    ) {

      const comma =
        value.indexOf(",");


      if (comma !== -1) {

        return value.substring(
          comma + 1
        );

      }

    }


    return value;

  }


  // Array of bytes
  if (
    Array.isArray(value)
  ) {

    try {

      return bytesToBase64(
        new Uint8Array(
          value
        )
      );

    } catch {

      return null;

    }

  }


  return null;

}


// ============================================================
// AI IMAGE GENERATION
// ============================================================

async function generateImage(
  request,
  env
) {

  let body;


  try {

    body =
      await request.json();

  } catch {

    throw new Error(
      "Invalid JSON request"
    );

  }


  const prompt =
    String(
      body?.prompt ?? ""
    ).trim();


  if (!prompt) {

    throw new Error(
      "Prompt is required"
    );

  }


  if (!env.AI) {

    throw new Error(
      "Workers AI binding 'AI' is missing"
    );

  }


  console.log(
    "AI image request:",
    prompt
  );


  // ----------------------------------------------------------
  // IMPORTANT:
  // Do NOT add seed or other unsupported Flux parameters.
  // ----------------------------------------------------------

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt
      }
    );


  console.log(
    "Workers AI result type:",
    typeof result
  );


  // ----------------------------------------------------------
  // DIRECT ARRAYBUFFER
  // ----------------------------------------------------------

  if (
    result instanceof ArrayBuffer
  ) {

    return new Response(
      result,
      {
        status: 200,
        headers:
          corsHeaders({
            "Content-Type":
              "image/jpeg",
            "Cache-Control":
              "no-store"
          })
      }
    );

  }


  // ----------------------------------------------------------
  // DIRECT UINT8ARRAY
  // ----------------------------------------------------------

  if (
    result instanceof Uint8Array ||
    ArrayBuffer.isView(result)
  ) {

    const bytes =
      result instanceof Uint8Array
        ? result
        : new Uint8Array(
            result.buffer,
            result.byteOffset,
            result.byteLength
          );


    return new Response(
      bytes,
      {
        status: 200,
        headers:
          corsHeaders({
            "Content-Type":
              "image/jpeg",
            "Cache-Control":
              "no-store"
          })
      }
    );

  }


  // ----------------------------------------------------------
  // RESPONSE
  // ----------------------------------------------------------

  if (
    typeof Response !== "undefined" &&
    result instanceof Response
  ) {

    const contentType =
      result.headers.get(
        "Content-Type"
      ) ||
      "image/jpeg";


    return new Response(
      result.body,
      {
        status:
          result.status,
        headers:
          corsHeaders({
            "Content-Type":
              contentType,
            "Cache-Control":
              "no-store"
          })
      }
    );

  }


  // ----------------------------------------------------------
  // result.image
  // ----------------------------------------------------------

  if (result?.image) {

    const base64 =
      await imageValueToBase64(
        result.image
      );


    if (base64) {

      return jsonResponse({
        success: true,
        image: base64,
        mimeType:
          "image/jpeg",
        prompt
      });

    }

  }


  // ----------------------------------------------------------
  // result.data
  // ----------------------------------------------------------

  if (result?.data) {

    const base64 =
      await imageValueToBase64(
        result.data
      );


    if (base64) {

      return jsonResponse({
        success: true,
        image: base64,
        mimeType:
          "image/jpeg",
        prompt
      });

    }

  }


  // ----------------------------------------------------------
  // result.output
  // ----------------------------------------------------------

  if (result?.output) {

    const base64 =
      await imageValueToBase64(
        result.output
      );


    if (base64) {

      return jsonResponse({
        success: true,
        image: base64,
        mimeType:
          "image/jpeg",
        prompt
      });

    }

  }


  // ----------------------------------------------------------
  // ARRAY RESULT
  // ----------------------------------------------------------

  if (
    Array.isArray(result)
  ) {

    for (
      const item of result
    ) {

      const base64 =
        await imageValueToBase64(
          item
        );


      if (base64) {

        return jsonResponse({
          success: true,
          image: base64,
          mimeType:
            "image/jpeg",
          prompt
        });

      }

    }

  }


  console.log(
    "Workers AI raw result:",
    result
  );


  throw new Error(
    "Workers AI did not return usable image data"
  );

}


// ============================================================
// HEALTH
// ============================================================

function health(env) {

  return jsonResponse({

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

    assets: true,

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
// DEBUG LIVE
// ============================================================

async function debugLive(env) {

  try {

    if (
      !env.CRICKET_LIVE_API_TOKEN
    ) {

      return jsonResponse({
        success: false,
        error:
          "CRICKET_LIVE_API_TOKEN secret is missing"
      });

    }


    const response =
      await fetch(
        CRICKET_LIVE_API_URL,
        {
          method: "GET",
          headers: {
            "Accept":
              "application/json",
            "Authorization":
              `Bearer ${
                env.CRICKET_LIVE_API_TOKEN
              }`
          }
        }
      );


    const text =
      await response.text();


    return new Response(
      text,
      {
        status:
          response.status,
        headers:
          corsHeaders({
            "Content-Type":
              response.headers.get(
                "Content-Type"
              ) ||
              "application/json"
          })
      }
    );

  } catch (error) {

    return jsonResponse({

      success: false,

      error:
        error?.message ||
        String(error)

    });

  }

}


// ============================================================
// MAIN FETCH
// ============================================================

export default {

  async fetch(
    request,
    env
  ) {

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
      new URL(
        request.url
      );


    const pathname =
      url.pathname;


    console.log(
      request.method,
      pathname
    );


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      pathname ===
      "/api/health"
    ) {

      return health(env);

    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (
      pathname ===
      "/api/debug-live"
    ) {

      return debugLive(env);

    }


    // ========================================================
    // AI IMAGE
    // ========================================================

    if (
      pathname ===
        "/api/generate-image" ||
      pathname ===
        "/api/generate"
    ) {

      if (
        request.method !== "POST"
      ) {

        return errorResponse(
          "POST required",
          405
        );

      }


      try {

        return await generateImage(
          request,
          env
        );

      } catch (error) {

        console.log(
          "AI generation error:",
          error?.message
        );


        return errorResponse(
          error?.message ||
            "Image generation failed",
          500
        );

      }

    }


    // ========================================================
    // LIVE SCORE
    // ONLY REAL LIVE MATCHES
    // ========================================================

    if (
      pathname ===
      "/api/live-score"
    ) {

      try {

        const matches =
          await getLiveScores(
            env
          );


        return jsonResponse({

          success: true,

          count:
            matches.length,

          data:
            matches

        });

      } catch (error) {

        console.log(
          "Live score error:",
          error?.message
        );


        return errorResponse(
          error?.message ||
            "Live score failed",
          500
        );

      }

    }


    // ========================================================
    // SCORE
    // ========================================================

    if (
      pathname ===
      "/api/score"
    ) {

      try {

        const matches =
          await getScore(
            env
          );


        return jsonResponse({

          success: true,

          count:
            matches.length,

          data:
            matches

        });

      } catch (error) {

        return errorResponse(
          error?.message ||
            "Score failed",
          500
        );

      }

    }


    // ========================================================
    // FIXTURES
    // ONLY UPCOMING MATCHES
    // ========================================================

    if (
      pathname ===
      "/api/fixtures"
    ) {

      try {

        const data =
          await getFixtures(
            env
          );


        return jsonResponse(
          data
        );

      } catch (error) {

        console.log(
          "Fixtures error:",
          error?.message
        );


        return errorResponse(
          error?.message ||
            "Fixtures failed",
          500
        );

      }

    }


    // ========================================================
    // SCORECARD
    // ========================================================

    if (
      pathname ===
      "/api/scorecard"
    ) {

      const matchId =
        url.searchParams.get(
          "id"
        );


      if (!matchId) {

        return errorResponse(
          "Match ID is required",
          400
        );

      }


      try {

        const data =
          await getMatchDetail(
            matchId,
            "scorecard",
            env
          );


        return jsonResponse(
          data
        );

      } catch (error) {

        console.log(
          "Scorecard error:",
          error?.message
        );


        return errorResponse(
          error?.message ||
            "Scorecard failed",
          500
        );

      }

    }


    // ========================================================
    // BALL-BY-BALL
    // ========================================================

    if (
      pathname ===
      "/api/ball-by-ball"
    ) {

      const matchId =
        url.searchParams.get(
          "id"
        );


      if (!matchId) {

        return errorResponse(
          "Match ID is required",
          400
        );

      }


      try {

        const data =
          await getMatchDetail(
            matchId,
            "commentary",
            env
          );


        return jsonResponse(
          data
        );

      } catch (error) {

        console.log(
          "Commentary error:",
          error?.message
        );


        return errorResponse(
          error?.message ||
            "Ball-by-ball failed",
          500
        );

      }

    }


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (
      pathname ===
      "/api/match-points"
    ) {

      try {

        const data =
          await getMatchPoints();


        return jsonResponse(
          data
        );

      } catch (error) {

        return errorResponse(
          error?.message ||
            "Match points failed",
          500
        );

      }

    }


    // ========================================================
    // ROOT
    // ========================================================

    if (
      pathname === "/" ||
      pathname === ""
    ) {

      return new Response(
        "🏏 Cricket Short Worker is running.",
        {
          status: 200,
          headers:
            corsHeaders({
              "Content-Type":
                "text/plain; charset=utf-8"
            })
        }
      );

    }


    // ========================================================
    // 404
    // ========================================================

    return errorResponse(
      "Not Found",
      404
    );

  }

};
