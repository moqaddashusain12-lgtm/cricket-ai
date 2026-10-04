// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// Live Score + Fixtures + Scorecard + Ball-by-Ball
// Match Points + Workers AI Image Generation
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key",
    ...extra
  };
}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders({
        "Content-Type": "application/json; charset=utf-8",
        ...extra
      })
    }
  );
}


// ============================================================
// ERROR RESPONSE
// ============================================================

function errorResponse(message, status = 500, extra = {}) {
  return jsonResponse(
    {
      success: false,
      error: message
    },
    status,
    extra
  );
}


// ============================================================
// SAFE JSON
// ============================================================

async function safeJSON(response) {
  const text = await response.text();

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
// FETCH JSON
// ============================================================

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);

  const data = await safeJSON(response);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `HTTP ${response.status}`
    );
  }

  return data;
}


// ============================================================
// NORMALIZE MATCH
// ============================================================

function normalizeMatch(match = {}) {
  const teams = Array.isArray(match.teams)
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

    name:
      match.name ??
      match.matchName ??
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
// STATUS
// ============================================================

function getStatus(match = {}) {

  const raw = String(
    match.status ??
    match.matchStatus ??
    match.state ??
    ""
  ).toLowerCase();

  if (
    raw.includes("live") ||
    raw.includes("playing") ||
    raw.includes("in progress")
  ) {
    return "LIVE";
  }

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
    raw.includes("complete") ||
    raw.includes("finished") ||
    raw.includes("result") ||
    raw.includes("won") ||
    raw.includes("loss")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


// ============================================================
// CRICAPI SCORE
// ============================================================

async function getCricketScores(env) {

  if (!env.CRICKET_API_KEY) {
    throw new Error("CRICKET_API_KEY secret is missing");
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(
      env.CRICKET_API_KEY
    )}`;

  const data = await fetchJSON(url);

  const list =
    data?.data ??
    data?.matches ??
    [];

  return Array.isArray(list)
    ? list.map(normalizeMatch)
    : [];
}


// ============================================================
// CRICKET LIVE API
// ============================================================

async function getLiveScores(env) {

  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );
  }

  const response = await fetch(
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

  const data = await safeJSON(response);

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

  return list.map(normalizeMatch);
}


// ============================================================
// ALL CRICKET MATCHES
// ============================================================

async function getAllCricketMatches(env) {

  try {

    const live = await getLiveScores(env);

    if (live.length > 0) {
      return live;
    }

  } catch (error) {

    console.log(
      "CricketLiveAPI failed:",
      error?.message
    );
  }


  try {

    return await getCricketScores(env);

  } catch (error) {

    console.log(
      "CricAPI failed:",
      error?.message
    );

    return [];
  }
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

  const url =
    "https://cricketliveapi.com/api/v1/cricket/matches/upcoming";

  const response = await fetch(
    url,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization":
          `Bearer ${env.CRICKET_LIVE_API_TOKEN}`
      }
    }
  );

  const data = await safeJSON(response);

  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Fixtures HTTP ${response.status}`
    );
  }

  return data;
}


// ============================================================
// GENERIC MATCH DETAIL
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
    throw new Error("Match ID is required");
  }


  let primaryURL = "";
  let fallbackURL = "";


  // ----------------------------------------------------------
  // SCORECARD
  // ----------------------------------------------------------

  if (type === "scorecard") {

    primaryURL =
      `https://cricketliveapi.com/api/v1/cricket/scorecard/${encodeURIComponent(
        matchId
      )}`;

    fallbackURL =
      `https://cricketliveapi.com/api/v1/cricket/match/${encodeURIComponent(
        matchId
      )}/scorecard`;
  }


  // ----------------------------------------------------------
  // COMMENTARY / BALL BY BALL
  // ----------------------------------------------------------

  else if (type === "commentary") {

    primaryURL =
      `https://cricketliveapi.com/api/v1/cricket/commentary/${encodeURIComponent(
        matchId
      )}`;

    fallbackURL =
      `https://cricketliveapi.com/api/v1/cricket/match/${encodeURIComponent(
        matchId
      )}/commentary`;
  }


  else {
    throw new Error("Unknown match detail type");
  }


  const headers = {
    "Accept": "application/json",
    "Authorization":
      `Bearer ${env.CRICKET_LIVE_API_TOKEN}`
  };


  // ----------------------------------------------------------
  // PRIMARY
  // ----------------------------------------------------------

  try {

    const response = await fetch(
      primaryURL,
      {
        method: "GET",
        headers
      }
    );

    const data = await safeJSON(response);

    if (response.ok) {
      return data;
    }

    console.log(
      `${type} primary failed:`,
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

  const response = await fetch(
    fallbackURL,
    {
      method: "GET",
      headers
    }
  );

  const data = await safeJSON(response);

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
// IMPORTANT:
// CricketLiveAPI documentation supplied for this project
// does not confirm a points-table endpoint.
// Therefore we safely return "not configured" instead of
// inventing an API endpoint.
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
// BASE64
// ============================================================

function bytesToBase64(bytes) {

  let binary = "";

  const chunkSize = 0x8000;

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
// CONVERT IMAGE VALUE TO BASE64
// ============================================================

async function imageValueToBase64(value) {

  if (!value) {
    return null;
  }


  // ArrayBuffer
  if (value instanceof ArrayBuffer) {

    return bytesToBase64(
      new Uint8Array(value)
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
      new Uint8Array(buffer)
    );
  }


  // String
  if (typeof value === "string") {

    // Already data URL
    if (
      value.startsWith("data:image/")
    ) {

      const comma =
        value.indexOf(",");

      if (comma !== -1) {
        return value.substring(
          comma + 1
        );
      }
    }


    // Assume plain base64
    return value;
  }


  // Array of numbers
  if (Array.isArray(value)) {

    try {

      return bytesToBase64(
        new Uint8Array(value)
      );

    } catch {
      return null;
    }
  }


  return null;
}


// ============================================================
// WORKERS AI IMAGE GENERATION
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
    String(body?.prompt ?? "").trim();


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
  // IMPORTANT
  // Do NOT send unsupported parameters like seed.
  // Flux Schnell only receives the prompt here.
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
  // CASE 1
  // Workers AI returned ArrayBuffer
  // ----------------------------------------------------------

  if (
    result instanceof ArrayBuffer
  ) {

    return new Response(
      result,
      {
        status: 200,
        headers: corsHeaders({
          "Content-Type": "image/jpeg",
          "Cache-Control":
            "no-store"
        })
      }
    );
  }


  // ----------------------------------------------------------
  // CASE 2
  // Workers AI returned Uint8Array
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
        headers: corsHeaders({
          "Content-Type": "image/jpeg",
          "Cache-Control":
            "no-store"
        })
      }
    );
  }


  // ----------------------------------------------------------
  // CASE 3
  // Workers AI returned Response
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
        status: result.status,
        headers: corsHeaders({
          "Content-Type":
            contentType,
          "Cache-Control":
            "no-store"
        })
      }
    );
  }


  // ----------------------------------------------------------
  // CASE 4
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
        mimeType: "image/jpeg",
        prompt
      });
    }
  }


  // ----------------------------------------------------------
  // CASE 5
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
        mimeType: "image/jpeg",
        prompt
      });
    }
  }


  // ----------------------------------------------------------
  // CASE 6
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
        mimeType: "image/jpeg",
        prompt
      });
    }
  }


  // ----------------------------------------------------------
  // CASE 7
  // Array result
  // ----------------------------------------------------------

  if (Array.isArray(result)) {

    for (const item of result) {

      const base64 =
        await imageValueToBase64(
          item
        );

      if (base64) {

        return jsonResponse({
          success: true,
          image: base64,
          mimeType: "image/jpeg",
          prompt
        });
      }
    }
  }


  // ----------------------------------------------------------
  // Nothing usable returned
  // ----------------------------------------------------------

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
    app: "Cricket Short",
    worker: "cricket-ai-app",

    workersAI:
      Boolean(env.AI),

    cricketApiKey:
      Boolean(env.CRICKET_API_KEY),

    cricketLiveApiToken:
      Boolean(env.CRICKET_LIVE_API_TOKEN),

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

    if (!env.CRICKET_LIVE_API_TOKEN) {

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
              `Bearer ${env.CRICKET_LIVE_API_TOKEN}`
          }
        }
      );


    const text =
      await response.text();


    return new Response(
      text,
      {
        status: response.status,
        headers: corsHeaders({
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
      pathname === "/api/health"
    ) {

      return health(env);
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (
      pathname === "/api/debug-live"
    ) {

      return debugLive(env);
    }


    // ========================================================
    // AI IMAGE
    // ========================================================

    if (
      pathname === "/api/generate-image" ||
      pathname === "/api/generate"
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
    // ========================================================

    if (
      pathname === "/api/live-score"
    ) {

      try {

        const matches =
          await getLiveScores(
            env
          );


        return jsonResponse({
          success: true,
          count: matches.length,
          data: matches
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
      pathname === "/api/score"
    ) {

      try {

        const matches =
          await getAllCricketMatches(
            env
          );


        return jsonResponse({
          success: true,
          count: matches.length,
          data: matches
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
    // ========================================================

    if (
      pathname === "/api/fixtures"
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
      pathname === "/api/scorecard"
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

        return errorResponse(
          error?.message ||
          "Scorecard failed",
          500
        );
      }
    }


    // ========================================================
    // BALL BY BALL / COMMENTARY
    // ========================================================

    if (
      pathname === "/api/ball-by-ball"
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
      pathname === "/api/match-points"
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
