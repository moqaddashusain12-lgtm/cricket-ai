// ============================================================
// CRICKET SHORT V2 - FINAL WORKER.JS
// Live Score + Fixtures + Scorecard + Points + AI Image
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const API_BASE = "https://api.cricapi.com/v1";


// ============================================================
// CORS
// ============================================================

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    ...extra
  };
}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders({
        "Content-Type": "application/json; charset=utf-8"
      })
    }
  );
}


// ============================================================
// TEAM NAME
// ============================================================

function cleanTeamName(name) {
  if (!name) return "Unknown Team";

  return String(name)
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// SCORE
// ============================================================

function parseScore(score) {
  if (!score) {
    return {
      r: 0,
      w: 0,
      o: ""
    };
  }

  return {
    r: Number(score.r ?? 0),
    w: Number(score.w ?? 0),
    o: score.o ?? ""
  };
}


// ============================================================
// STATUS DETECTION
// ============================================================

function detectStatus(match) {

  const statusText = String(
    match?.status ||
    match?.matchStatus ||
    ""
  ).trim();

  const s = statusText.toLowerCase();

  if (
    s.includes("live") ||
    s.includes("ongoing") ||
    s.includes("in progress") ||
    s.includes("playing")
  ) {
    return "LIVE";
  }

  if (
    match?.matchStarted === true &&
    match?.matchEnded !== true
  ) {
    return "LIVE";
  }

  if (
    s.includes("won") ||
    s.includes("result") ||
    s.includes("draw") ||
    s.includes("tie") ||
    s.includes("abandoned") ||
    s.includes("no result") ||
    s.includes("finished") ||
    s.includes("complete") ||
    s.includes("stumps")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


// ============================================================
// FORMAT MATCH
// ============================================================

function formatMatch(match) {

  const teams = Array.isArray(match?.teams)
    ? match.teams.map(cleanTeamName)
    : [];

  const scores = Array.isArray(match?.score)
    ? match.score.map(parseScore)
    : [];

  const statusText = String(
    match?.status ||
    match?.matchStatus ||
    ""
  ).trim();

  return {
    id:
      match?.id ||
      match?.matchId ||
      match?.unique_id ||
      "",

    name:
      match?.name ||
      teams.join(" vs "),

    matchType:
      match?.matchType ||
      "",

    status:
      detectStatus(match),

    statusText:
      statusText,

    teams:
      teams,

    score:
      scores,

    venue:
      match?.venue ||
      "",

    date:
      match?.date ||
      "",

    dateTimeGMT:
      match?.dateTimeGMT ||
      "",

    series_id:
      match?.series_id ||
      "",

    seriesName:
      match?.seriesName ||
      "",

    toss:
      match?.toss ||
      "",

    matchStarted:
      Boolean(match?.matchStarted),

    matchEnded:
      Boolean(match?.matchEnded),

    rawStatus:
      statusText
  };
}


// ============================================================
// CRICKET API FETCH
// ============================================================

async function cricketFetch(
  endpoint,
  env,
  extraParams = ""
) {

  const apiKey = env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CRICKET_API_KEY_NOT_CONFIGURED"
    );
  }

  const url =
    `${API_BASE}/${endpoint}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&offset=0` +
    extraParams;

  const response = await fetch(
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

    data =
      JSON.parse(text);

  }
  catch {

    throw new Error(
      `CRICKET_API_INVALID_JSON_${response.status}`
    );
  }

  if (!response.ok) {

    const reason =
      data?.reason ||
      data?.message ||
      data?.error ||
      `HTTP_${response.status}`;

    throw new Error(
      `CRICKET_API_HTTP_${response.status}: ${reason}`
    );
  }

  if (
    data?.status === "failure"
  ) {

    const reason =
      data?.reason ||
      data?.message ||
      data?.error ||
      "CRICKET_API_FAILURE";

    throw new Error(reason);
  }

  return data;
}


// ============================================================
// CURRENT MATCHES
// ============================================================

async function getCurrentMatches(env) {

  try {

    const data =
      await cricketFetch(
        "currentMatches",
        env
      );

    return Array.isArray(data?.data)
      ? data.data
      : [];

  }
  catch {

    return [];
  }
}


// ============================================================
// ALL MATCHES / FIXTURES
// ============================================================

async function getMatches(env) {

  const data =
    await cricketFetch(
      "matches",
      env
    );

  return Array.isArray(data?.data)
    ? data.data
    : [];
}


// ============================================================
// LIVE MATCHES
// ============================================================

async function getLiveMatches(env) {

  const current =
    await getCurrentMatches(env);

  let all = [
    ...current
  ];

  try {

    const fixtures =
      await getMatches(env);

    all = [
      ...all,
      ...fixtures
    ];

  }
  catch {
    // Continue with current matches.
  }


  const unique =
    new Map();

  for (const match of all) {

    const id =
      match?.id ||
      match?.matchId ||
      match?.unique_id ||
      `${match?.name}-${match?.date}`;

    if (!unique.has(id)) {

      unique.set(
        id,
        match
      );
    }
  }


  const live = [];

  for (
    const match
    of unique.values()
  ) {

    const formatted =
      formatMatch(match);

    if (
      formatted.status === "LIVE"
    ) {

      live.push(formatted);
    }
  }

  return live;
}


// ============================================================
// ALL FIXTURES
// ============================================================

async function getAllFixtures(env) {

  const matches =
    await getMatches(env);

  return matches.map(
    formatMatch
  );
}


// ============================================================
// SORT MATCHES
// ============================================================

function sortMatches(matches) {

  return [
    ...matches
  ].sort(
    (a, b) => {

      const aTime =
        Date.parse(
          a.dateTimeGMT ||
          a.date ||
          ""
        ) || 0;

      const bTime =
        Date.parse(
          b.dateTimeGMT ||
          b.date ||
          ""
        ) || 0;

      return aTime - bTime;
    }
  );
}


// ============================================================
// SCORECARD
// ============================================================

async function getScorecard(
  env,
  id
) {

  if (!id) {

    throw new Error(
      "MATCH_ID_REQUIRED"
    );
  }

  return await cricketFetch(
    "match_scorecard",
    env,
    `&id=${encodeURIComponent(id)}`
  );
}


// ============================================================
// AI IMAGE GENERATOR
// ============================================================

async function generateImage(
  request,
  env
) {

  if (!env.AI) {

    return jsonResponse(
      {
        success: false,
        error:
          "WORKERS_AI_BINDING_NOT_CONFIGURED"
      },
      500
    );
  }


  let body = {};

  try {

    body =
      await request.json();

  }
  catch {

    body = {};
  }


  const playerName =
    body.playerName ||
    body.name ||
    "Cricket Player";

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
    "Night";

  const camera =
    body.camera ||
    "Front";

  const tournament =
    body.tournament ||
    "Cricket Match";

  const customPrompt =
    body.customPrompt ||
    "";


  const prompt = `
Photorealistic cinematic professional cricket sports photograph.

Player:
${playerName}

Team:
${team}

Player type:
${type}

Batting/Bowling hand:
${hand}

Pose:
${pose}

Jersey:
${jersey}

Jersey number:
${number}

Tournament:
${tournament}

Stadium:
${stadium}

Weather:
${weather}

Match time:
${matchTime}

Camera:
${camera}

Style:
${style}

Create a realistic professional cricket player image.
Authentic cricket equipment.
Realistic face.
Natural body proportions.
Professional sports photography.
Dramatic stadium floodlights.
Large cricket stadium.
Energetic crowd.
High detail.
Sharp subject.
Cinematic lighting.
Ultra realistic.

${customPrompt}

No text.
No watermark.
No logo.
`.trim();


  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt: prompt
      }
    );


  const contentType =
    result?.headers?.get?.(
      "content-type"
    ) ||
    "image/png";


  return new Response(
    result.body || result,
    {
      status: 200,
      headers: corsHeaders({
        "Content-Type":
          contentType
      })
    }
  );
}


// ============================================================
// HEALTH
// ============================================================

async function health(env) {

  return jsonResponse({

    success: true,

    app:
      "Cricket Short",

    worker:
      "cricket-ai-app",

    workersAI:
      Boolean(env.AI),

    cricketApiKey:
      Boolean(env.CRICKET_API_KEY),

    endpoints: [
      "/api/health",
      "/api/live-score",
      "/api/fixtures",
      "/api/scorecard?id=...",
      "/api/scorecard-test?id=...",
      "/api/match-points?id=...",
      "/api/ball-by-ball?id=...",
      "/api/generate-image",
      "/api/generate",
      "/api/score"
    ]

  });
}


// ============================================================
// MAIN FETCH
// ============================================================

export default {

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(request.url);

    const pathname =
      url.pathname;


    // ========================================================
    // OPTIONS
    // ========================================================

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


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      pathname === "/api/health"
    ) {

      return health(env);
    }


    // ========================================================
    // LIVE SCORE
    // ========================================================

    if (
      pathname === "/api/live-score" ||
      pathname === "/api/score"
    ) {

      try {

        const liveMatches =
          await getLiveMatches(
            env
          );

        return jsonResponse({

          success: true,

          count:
            liveMatches.length,

          matches:
            liveMatches

        });

      }
      catch (error) {

        return jsonResponse(
          {
            success: false,
            count: 0,
            matches: [],
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

    if (
      pathname === "/api/fixtures"
    ) {

      try {

        const matches =
          await getAllFixtures(
            env
          );

        return jsonResponse({

          success: true,

          count:
            matches.length,

          matches:
            sortMatches(matches)

        });

      }
      catch (error) {

        return jsonResponse(
          {
            success: false,
            count: 0,
            matches: [],
            error:
              error.message
          },
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

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return jsonResponse(
          {
            success: false,
            error:
              "MATCH_ID_REQUIRED"
          },
          400
        );
      }


      try {

        const data =
          await getScorecard(
            env,
            id
          );

        return jsonResponse({

          success: true,

          matchId:
            id,

          data:
            data

        });

      }
      catch (error) {

        return jsonResponse(
          {
            success: false,

            matchId:
              id,

            error:
              error.message
          },
          502
        );
      }
    }


    // ========================================================
    // SCORECARD TEST
    // ========================================================

    if (
      pathname === "/api/scorecard-test"
    ) {

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return jsonResponse(
          {
            success: false,
            error:
              "MATCH_ID_REQUIRED"
          },
          400
        );
      }


      try {

        const data =
          await cricketFetch(
            "match_scorecard",
            env,
            `&id=${encodeURIComponent(id)}`
          );

        return jsonResponse({

          success: true,

          endpoint:
            "match_scorecard",

          matchId:
            id,

          apiResponse:
            data

        });

      }
      catch (error) {

        return jsonResponse(
          {
            success: false,

            endpoint:
              "match_scorecard",

            matchId:
              id,

            error:
              error.message
          },
          502
        );
      }
    }


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (
      pathname === "/api/match-points"
    ) {

      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {

        return jsonResponse(
          {
            success: false,
            error:
              "MATCH_ID_REQUIRED"
          },
          400
        );
      }


      try {

        const data =
          await cricketFetch(
            "match_points",
            env,
            `&id=${encodeURIComponent(id)}`
          );

        return jsonResponse({

          success: true,

          matchId:
            id,

          data:
            data

        });

      }
      catch (error) {

        return jsonResponse(
          {
            success: false,

            matchId:
              id,

            error:
              error.message
          },
          502
        );
      }
    }


    // ========================================================
    // BALL BY BALL
    // ========================================================

    if (
      pathname === "/api/ball-by-ball"
    ) {

      return jsonResponse(
        {
          success: false,

          error:
            "BALL_BY_BALL_ENDPOINT_NOT_CONFIGURED",

          message:
            "Ball-by-ball endpoint will be connected after confirming the API plan."
        },
        501
      );
    }


    // ========================================================
    // AI IMAGE
    // ========================================================

    if (
      pathname === "/api/generate-image" &&
      request.method === "POST"
    ) {

      try {

        return await generateImage(
          request,
          env
        );

      }
      catch (error) {

        return jsonResponse(
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
    // OLD AI COMPATIBILITY
    // ========================================================

    if (
      pathname === "/api/generate" &&
      request.method === "POST"
    ) {

      try {

        return await generateImage(
          request,
          env
        );

      }
      catch (error) {

        return jsonResponse(
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
    // STATIC ASSETS
    // ========================================================

    if (env.ASSETS) {

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

      }
      catch {
        // Continue.
      }
    }


    // ========================================================
    // ROOT
    // ========================================================

    if (
      pathname === "/"
    ) {

      return new Response(
        `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cricket Short</title>
</head>

<body style="
margin:0;
background:#071426;
color:white;
font-family:Arial,sans-serif;
display:flex;
align-items:center;
justify-content:center;
min-height:100vh;
text-align:center;
">

<div>

<h1>🏏 Cricket Short</h1>

<p>
AI Cricket Player • Live Score • Fixtures
</p>

<p>
Open the application from the deployed site.
</p>

</div>

</body>
</html>
        `,
        {
          status: 200,

          headers:
            corsHeaders({
              "Content-Type":
                "text/html; charset=utf-8"
            })
        }
      );
    }


    // ========================================================
    // 404
    // ========================================================

    return jsonResponse(
      {
        success: false,
        error:
          "NOT_FOUND",
        path:
          pathname
      },
      404
    );
  }
};
// Production deployment trigger 2026-10-03
