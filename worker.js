here// ============================================================
// CRICKET SHORT V2 - FINAL WORKER.JS
// Live Score Pro + Fixtures + Scorecard + Points
// Ball-by-Ball safe placeholder + Cloudflare AI Image
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";


/* ============================================================
   CORS
============================================================ */

function corsHeaders(extra = {}) {

  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    ...extra
  };
}


/* ============================================================
   JSON RESPONSE
============================================================ */

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


/* ============================================================
   SCORE PARSER
============================================================ */

function parseScore(value) {

  if (value == null) {
    return {
      runs: "",
      overs: ""
    };
  }

  if (typeof value === "object") {

    return {
      runs:
        value.r ??
        value.runs ??
        value.score ??
        "",

      overs:
        value.o ??
        value.overs ??
        ""
    };
  }

  const text = String(value).trim();

  let runs = "";
  let overs = "";

  const runMatch =
    text.match(/^(\d+\s*\/\s*\d+)/);

  if (runMatch) {
    runs = runMatch[1];
  } else {

    const simpleRuns =
      text.match(/^(\d+)/);

    if (simpleRuns) {
      runs = simpleRuns[1];
    }
  }

  const overMatch =
    text.match(/\(([^)]*ov[^)]*)\)/i);

  if (overMatch) {
    overs = overMatch[1];
  }

  return {
    runs,
    overs
  };
}


/* ============================================================
   FIND OVERS
============================================================ */

function findOvers(score) {

  const parsed = parseScore(score);

  return parsed.overs || "";
}


/* ============================================================
   STATUS
============================================================ */

function getStatus(match) {

  const values = [

    match?.status,
    match?.matchStatus,
    match?.state,
    match?.result

  ]
    .filter(Boolean)
    .map(v => String(v).toLowerCase());

  const text = values.join(" ");

  if (
    text.includes("live") ||
    text.includes("playing") ||
    text.includes("in progress") ||
    text === "started"
  ) {
    return "LIVE";
  }

  if (
    text.includes("result") ||
    text.includes("won") ||
    text.includes("draw") ||
    text.includes("tie") ||
    text.includes("abandoned")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


/* ============================================================
   FIND BATTING TEAM
============================================================ */

function findBattingTeamIndex(match) {

  const batting =
    String(
      match?.battingTeam ??
      match?.batting_team ??
      ""
    ).toLowerCase();

  if (!batting) {
    return null;
  }

  const team1 =
    cleanTeamName(
      match?.team1?.name ??
      match?.team1 ??
      match?.teams?.[0]?.name ??
      match?.teams?.[0] ??
      ""
    ).toLowerCase();

  const team2 =
    cleanTeamName(
      match?.team2?.name ??
      match?.team2 ??
      match?.teams?.[1]?.name ??
      match?.teams?.[1] ??
      ""
    ).toLowerCase();

  if (
    batting.includes(team1) ||
    team1.includes(batting)
  ) {
    return 0;
  }

  if (
    batting.includes(team2) ||
    team2.includes(batting)
  ) {
    return 1;
  }

  return null;
}


/* ============================================================
   CLEAN TEAM NAME
============================================================ */

function cleanTeamName(value) {

  if (!value) {
    return "";
  }

  if (typeof value === "object") {

    return String(
      value.name ??
      value.shortname ??
      value.shortName ??
      ""
    ).trim();
  }

  return String(value).trim();
}


/* ============================================================
   FORMAT CRIC SCORE MATCH
============================================================ */

function formatCricScoreMatch(match) {

  const status =
    getStatus(match);

  const team1 =
    cleanTeamName(
      match?.team1?.name ??
      match?.team1 ??
      match?.teams?.[0]?.name ??
      match?.teams?.[0] ??
      "Team 1"
    );

  const team2 =
    cleanTeamName(
      match?.team2?.name ??
      match?.team2 ??
      match?.teams?.[1]?.name ??
      match?.teams?.[1] ??
      "Team 2"
    );

  const score =
    Array.isArray(match?.score)
      ? match.score
      : Array.isArray(match?.scores)
      ? match.scores
      : [];

  const normalizedScore =
    score.map((item, index) => {

      const parsed =
        parseScore(item);

      return {

        team:
          cleanTeamName(
            item?.inning ??
            item?.team ??
            item?.name ??
            item?.teamName ??
            ""
          ) ||
          (index === 0 ? team1 : team2),

        r:
          parsed.runs,

        o:
          parsed.overs,

        runs:
          parsed.runs,

        overs:
          parsed.overs
      };

    });

  const matchId =
    match?.id ??
    match?.matchId ??
    match?.match_id ??
    "";

  const matchName =
    match?.name ??
    match?.matchName ??
    `${team1} vs ${team2}`;

  const venue =
    match?.venue ??
    match?.venueInfo?.ground ??
    match?.venueInfo?.name ??
    "";

  const series =
    match?.series ??
    match?.seriesName ??
    match?.tournament ??
    "";

  const matchType =
    match?.matchType ??
    match?.type ??
    "";

  const dateTime =
    match?.dateTimeGMT ??
    match?.date ??
    match?.startDate ??
    match?.dateTime ??
    "";

  const statusText =
    match?.status ??
    match?.matchStatus ??
    match?.state ??
    match?.result ??
    "";

  return {

    ...match,

    id: matchId,

    name: matchName,

    team1: {
      name: team1
    },

    team2: {
      name: team2
    },

    teams: [
      team1,
      team2
    ],

    score: normalizedScore,

    venue,

    series,

    matchType,

    dateTimeGMT: dateTime,

    status: status,

    statusText: statusText,

    battingTeamIndex:
      findBattingTeamIndex(match),

    matchStarted:
      status === "LIVE",

    matchEnded:
      status === "RESULT"
  };
}


/* ============================================================
   SORT MATCHES
============================================================ */

function sortMatches(matches) {

  return matches.sort((a, b) => {

    const order = {
      LIVE: 0,
      UPCOMING: 1,
      RESULT: 2
    };

    const statusDiff =
      (order[a.status] ?? 9) -
      (order[b.status] ?? 9);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const dateA =
      new Date(
        a.dateTimeGMT || 0
      ).getTime();

    const dateB =
      new Date(
        b.dateTimeGMT || 0
      ).getTime();

    return dateA - dateB;
  });
}


/* ============================================================
   GET ALL CRICKET MATCHES
============================================================ */

async function getAllCricketMatches(env) {

  const apiKey =
    env.CRICKET_API_KEY;

  if (!apiKey) {

    throw new Error(
      "CRICKET_API_KEY is not configured"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(apiKey)}`;

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
      "Cricket API returned invalid JSON"
    );
  }

  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Cricket API HTTP ${response.status}`
    );
  }

  if (
    data?.status &&
    String(data.status).toLowerCase() === "failure"
  ) {

    throw new Error(
      data?.message ||
      data?.error ||
      "Cricket API request failed"
    );
  }

  const rawMatches =
    Array.isArray(data?.data)
      ? data.data
      : [];

  const matches =
    rawMatches.map(
      formatCricScoreMatch
    );

  return sortMatches(matches);
}


/* ============================================================
   LIVE SCORES
============================================================ */

async function getCricketScores(env) {

  const all =
    await getAllCricketMatches(env);

  return all.filter(
    match => match.status === "LIVE"
  );
}


/* ============================================================
   FIXTURES
============================================================ */

async function getFixtures(env) {

  return await getAllCricketMatches(env);
}


/* ============================================================
   MATCH DETAIL
============================================================ */

async function getMatchDetail(
  env,
  endpoint,
  matchId
) {

  const apiKey =
    env.CRICKET_API_KEY;

  if (!apiKey) {

    throw new Error(
      "CRICKET_API_KEY is not configured"
    );
  }

  if (!matchId) {

    throw new Error(
      "Match ID is required"
    );
  }

  const url =
    `https://api.cricapi.com/v1/${endpoint}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&offset=0` +
    `&id=${encodeURIComponent(matchId)}`;

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
      "Cricket API returned invalid JSON"
    );
  }

  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Cricket API HTTP ${response.status}`
    );
  }

  return data;
}


/* ============================================================
   AI PROMPT
============================================================ */

function buildAIPrompt(body) {

  const player =
    body.player ??
    body.playerName ??
    "Cricket Player";

  const team =
    body.team ??
    "India";

  const pose =
    body.pose ??
    "Batting";

  const type =
    body.type ??
    "Batsman";

  const hand =
    body.hand ??
    "Right";

  const style =
    body.style ??
    "Realistic";

  const jersey =
    body.jersey ??
    body.jerseyColor ??
    "Blue";

  const number =
    body.number ??
    body.jerseyNumber ??
    "18";

  const stadium =
    body.stadium ??
    "International Stadium";

  const weather =
    body.weather ??
    "Clear";

  const matchTime =
    body.matchTime ??
    "Day";

  const camera =
    body.camera ??
    body.cameraAngle ??
    "Front";

  const tournament =
    body.tournament ??
    "Cricket Match";

  const customPrompt =
    body.customPrompt ??
    "";

  /* ----------------------------------------------------------
     CUSTOM PROMPT
  ---------------------------------------------------------- */

  if (
    typeof customPrompt === "string" &&
    customPrompt.trim().length > 0
  ) {

    return (
      customPrompt.trim() +
      `

Photorealistic cricket sports photography.
Ultra realistic human appearance.
Professional international cricket stadium.
Dramatic cinematic lighting.
High detail.
Realistic cricket equipment.
Natural anatomy.
No text.
No watermark.
Vertical 9:16 composition.`
    );
  }

  /* ----------------------------------------------------------
     NORMAL AI PLAYER PROMPT
  ---------------------------------------------------------- */

  return `
Photorealistic cinematic cricket sports image of ${player},
representing ${team},
a ${type},
${hand}-handed cricket player,
performing ${pose}.

Wearing a realistic ${team} cricket jersey,
${jersey} jersey color,
jersey number ${number}.

Playing at a ${stadium} cricket stadium,
${weather} weather,
${matchTime} match,
${camera} camera angle.

Tournament atmosphere:
${tournament}.

Packed cricket stadium crowd,
professional cricket ground,
realistic cricket bat and equipment,
dramatic stadium floodlights,
cinematic sports photography,
powerful athletic pose,
realistic face,
natural human anatomy,
realistic skin texture,
ultra detailed,
high resolution,
sharp focus,
professional sports photography.

Vertical 9:16 composition.
Keep the player and stadium clearly visible.
No text.
No watermark.
`;
}


/* ============================================================
   BASE64 TO BYTES
============================================================ */

function base64ToUint8Array(base64) {

  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}


/* ============================================================
   AI IMAGE GENERATION
============================================================ */

async function generateImage(
  request,
  env
) {

  let body;

  try {

    body =
      await request.json();

  } catch {

    return jsonResponse(
      {
        success: false,
        error: "Invalid JSON body"
      },
      400
    );
  }

  const prompt =
    buildAIPrompt(body);

  if (!env.AI) {

    return jsonResponse(
      {
        success: false,
        error: "Cloudflare AI binding is not configured"
      },
      500
    );
  }

  try {

    const result =
      await env.AI.run(
        AI_MODEL,
        {
          prompt
        }
      );

    /* --------------------------------------------------------
       AI IMAGE RESPONSE
    -------------------------------------------------------- */

    if (
      result &&
      result.image
    ) {

      const bytes =
        base64ToUint8Array(
          result.image
        );

      return new Response(
        bytes,
        {
          status: 200,
          headers: corsHeaders({
            "Content-Type": "image/jpeg",
            "Content-Disposition":
              'inline; filename="cricket-short-ai.jpg"'
          })
        }
      );
    }

    /* --------------------------------------------------------
       ARRAY RESPONSE FALLBACK
    -------------------------------------------------------- */

    if (
      result &&
      result.images &&
      Array.isArray(result.images) &&
      result.images[0]
    ) {

      const bytes =
        base64ToUint8Array(
          result.images[0]
        );

      return new Response(
        bytes,
        {
          status: 200,
          headers: corsHeaders({
            "Content-Type": "image/jpeg",
            "Content-Disposition":
              'inline; filename="cricket-short-ai.jpg"'
          })
        }
      );
    }

    return jsonResponse(
      {
        success: false,
        error: "AI did not return image data"
      },
      500
    );

  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          "AI image generation failed"
      },
      500
    );
  }
}


/* ============================================================
   REQUEST HANDLER
============================================================ */

export default {

  async fetch(request, env) {

    /* --------------------------------------------------------
       OPTIONS
    -------------------------------------------------------- */

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

    try {

      /* ======================================================
         HEALTH
      ====================================================== */

      if (
        path === "/api/health"
      ) {

        return jsonResponse({

          success: true,

          app: "Cricket Short",

          worker: "cricket-ai-app",

          workersAI:
            Boolean(env.AI),

          cricketApiKey:
            Boolean(env.CRICKET_API_KEY),

          assets:
            Boolean(env.ASSETS),

          time:
            new Date().toISOString()
        });
      }


      /* ======================================================
         LIVE SCORE
      ====================================================== */

      if (
        path === "/api/live-score"
      ) {

        if (
          request.method !== "GET"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "GET required"
            },
            405
          );
        }

        const matches =
          await getCricketScores(env);

        return jsonResponse({

          success: true,

          matches,

          data: matches,

          count: matches.length,

          liveCount: matches.length,

          updatedAt:
            new Date().toISOString(),

          source: "cricScore",

          range: "CURRENT LIVE ONLY"
        });
      }


      /* ======================================================
         FIXTURES
      ====================================================== */

      if (
        path === "/api/fixtures"
      ) {

        if (
          request.method !== "GET"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "GET required"
            },
            405
          );
        }

        const matches =
          await getFixtures(env);

        return jsonResponse({

          success: true,

          matches,

          data: matches,

          count: matches.length,

          updatedAt:
            new Date().toISOString(),

          source: "cricScore",

          range:
            "API MATCH DATA"
        });
      }


      /* ======================================================
         SCORECARD
      ====================================================== */

      if (
        path === "/api/scorecard"
      ) {

        if (
          request.method !== "GET"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "GET required"
            },
            405
          );
        }

        const matchId =
          url.searchParams.get("id");

        if (!matchId) {

          return jsonResponse(
            {
              success: false,
              error: "Match ID is required"
            },
            400
          );
        }

        const data =
          await getMatchDetail(
            env,
            "match_scorecard",
            matchId
          );

        return jsonResponse({
          success: true,
          matchId,
          data
        });
      }


      /* ======================================================
         MATCH POINTS
      ====================================================== */

      if (
        path === "/api/match-points"
      ) {

        if (
          request.method !== "GET"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "GET required"
            },
            405
          );
        }

        const matchId =
          url.searchParams.get("id");

        if (!matchId) {

          return jsonResponse(
            {
              success: false,
              error: "Match ID is required"
            },
            400
          );
        }

        const data =
          await getMatchDetail(
            env,
            "match_points",
            matchId
          );

        return jsonResponse({
          success: true,
          matchId,
          data
        });
      }


      /* ======================================================
         BALL BY BALL
         SAFE PLACEHOLDER
      ====================================================== */

      if (
        path === "/api/ball-by-ball"
      ) {

        return jsonResponse(
          {
            success: false,

            error:
              "BALL_BY_BALL_ENDPOINT_NOT_CONFIGURED",

            message:
              "Exact Ball-by-Ball endpoint must be confirmed in the Cricket Data API documentation/playground. No endpoint is guessed.",

            matchId:
              url.searchParams.get("id") || ""
          },
          501
        );
      }


      /* ======================================================
         AI GENERATE IMAGE
      ====================================================== */

      if (
        path === "/api/generate-image"
      ) {

        if (
          request.method !== "POST"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "POST required"
            },
            405
          );
        }

        return await generateImage(
          request,
          env
        );
      }


      /* ======================================================
         OLD /api/generate COMPATIBILITY
      ====================================================== */

      if (
        path === "/api/generate"
      ) {

        if (
          request.method !== "POST"
        ) {

          return jsonResponse(
            {
              success: false,
              error: "POST required"
            },
            405
          );
        }

        return await generateImage(
          request,
          env
        );
      }


      /* ======================================================
         ASSETS
      ====================================================== */

      if (
        env.ASSETS
      ) {

        return env.ASSETS.fetch(
          request
        );
      }


      /* ======================================================
         ROOT
      ====================================================== */

      if (
        path === "/" ||
        path === ""
      ) {

        return new Response(
          "Cricket Short Worker is running.",
          {
            status: 200,
            headers: corsHeaders({
              "Content-Type":
                "text/plain; charset=utf-8"
            })
          }
        );
      }


      /* ======================================================
         NOT FOUND
      ====================================================== */

      return jsonResponse(
        {
          success: false,
          error: "Not Found",
          path
        },
        404
      );

    } catch (error) {

      return jsonResponse(
        {
          success: false,

          error:
            error?.message ||
            "Internal Server Error"
        },
        500
      );
    }
  }
};
