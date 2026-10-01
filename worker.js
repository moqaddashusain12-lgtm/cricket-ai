// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// LIVE SCORE ONLY + AI IMAGE + POSTER + PLAYER CARD SUPPORT
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";


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
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
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
// SCORE PARSER
// ============================================================

function parseScore(value) {

  if (!value) {
    return null;
  }

  // Object format
  if (typeof value === "object") {

    const runs =
      value.r ??
      value.runs ??
      value.run ??
      "";

    const wickets =
      value.w ??
      value.wickets ??
      value.wicket ??
      "";

    const overs =
      value.o ??
      value.overs ??
      value.ov ??
      "";

    if (
      runs === "" &&
      wickets === "" &&
      overs === ""
    ) {
      return null;
    }

    return {
      raw: JSON.stringify(value),

      runs:
        runs === ""
          ? null
          : Number(runs),

      wickets:
        wickets === ""
          ? null
          : Number(wickets),

      overs:
        overs === ""
          ? ""
          : String(overs)
    };
  }


  // String format

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }


  // Example:
  // 300/2 (41.4 ov)

  let match =
    text.match(
      /(\d+)\s*\/\s*(\d+)(?:\s*\(\s*([\d.]+)\s*(?:ov|overs?)?\s*\))?/i
    );


  if (match) {

    let overs =
      match[3] || "";


    if (!overs) {

      const afterScore =
        text.match(
          /\d+\s*\/\s*\d+\s+(?:in\s+)?([\d.]+)\s*(?:ov|overs?)?/i
        );

      if (afterScore) {
        overs = afterScore[1];
      }
    }


    return {
      raw: text,

      runs:
        Number(match[1]),

      wickets:
        Number(match[2]),

      overs:
        overs
          ? String(overs)
          : ""
    };
  }


  return {
    raw: text,
    runs: null,
    wickets: null,
    overs: ""
  };
}


// ============================================================
// OVERS FINDER
// ============================================================

function findOvers(
  match,
  teamIndex,
  parsedScore
) {

  if (
    parsedScore &&
    parsedScore.overs !== undefined &&
    parsedScore.overs !== null &&
    parsedScore.overs !== ""
  ) {
    return String(
      parsedScore.overs
    );
  }


  const possibleFields =
    teamIndex === 0
      ? [
          "t1o",
          "t1overs",
          "team1Overs",
          "team1overs",
          "overs1",
          "t1Over",
          "team1Over"
        ]
      : [
          "t2o",
          "t2overs",
          "team2Overs",
          "team2overs",
          "overs2",
          "t2Over",
          "team2Over"
        ];


  for (
    const field of possibleFields
  ) {

    if (
      match[field] !== undefined &&
      match[field] !== null &&
      String(match[field]).trim() !== ""
    ) {

      return String(
        match[field]
      ).trim();
    }
  }


  return "";
}


// ============================================================
// STATUS
// ============================================================

function getStatus(
  mode,
  text
) {

  const m =
    String(mode || "")
      .toLowerCase();

  const s =
    String(text || "")
      .toLowerCase();


  // Result
  if (
    m === "result" ||
    m === "completed" ||
    s.includes("won by") ||
    s.includes("lost by") ||
    s.includes("match drawn") ||
    s.includes("no result") ||
    s.includes("tied") ||
    s.includes("abandoned")
  ) {

    return "RESULT";
  }


  // Stumps
  if (
    s.includes("stumps") ||
    s.includes("stump")
  ) {

    return "STUMPS";
  }


  // Delay
  if (
    s.includes("delay") ||
    s.includes("delayed") ||
    s.includes("rain")
  ) {

    return "DELAYED";
  }


  // Upcoming
  if (
    m === "fixture" ||
    s.includes("match starts") ||
    s.includes("starts at") ||
    s.includes("scheduled")
  ) {

    return "UPCOMING";
  }


  // LIVE
  if (
    m === "live" ||
    s.includes("live") ||
    s.includes("playing") ||
    s.includes("in progress")
  ) {

    return "LIVE";
  }


  return "UPCOMING";
}


// ============================================================
// BATTTING TEAM FINDER
// ============================================================

function findBattingTeamIndex(
  match
) {

  const status =
    String(
      match.status || ""
    ).toLowerCase();

  const raw =
    String(
      match.rawStatus || ""
    ).toLowerCase();


  if (
    status.includes("batting") ||
    raw.includes("batting")
  ) {

    if (
      raw.includes(
        String(match.team1 || "")
          .toLowerCase()
      )
    ) {
      return 0;
    }

    if (
      raw.includes(
        String(match.team2 || "")
          .toLowerCase()
      )
    ) {
      return 1;
    }
  }


  return null;
}


// ============================================================
// TEAM NAME CLEANER
// ============================================================

function cleanTeamName(
  value
) {

  if (!value) {
    return "";
  }

  return String(value)
    .replace(/\s*\[[A-Z]{2,4}\]\s*$/i, "")
    .trim();
}


// ============================================================
// FORMAT CRIC SCORE MATCH
// ============================================================

function formatCricScoreMatch(
  match
) {

  if (!match) {
    return null;
  }


  const team1 =
    cleanTeamName(
      match.t1 ||
      match.team1 ||
      ""
    );

  const team2 =
    cleanTeamName(
      match.t2 ||
      match.team2 ||
      ""
    );


  if (!team1 || !team2) {
    return null;
  }


  const rawStatus =
    match.status || "";


  const mode =
    match.ms ||
    match.mode ||
    "";


  const status =
    getStatus(
      mode,
      rawStatus
    );


  const parsedScore1 =
    parseScore(
      match.t1s ||
      match.team1Score ||
      ""
    );


  const parsedScore2 =
    parseScore(
      match.t2s ||
      match.team2Score ||
      ""
    );


  const overs1 =
    findOvers(
      match,
      0,
      parsedScore1
    );


  const overs2 =
    findOvers(
      match,
      1,
      parsedScore2
    );


  const score1 =
    parsedScore1
      ? {
          ...parsedScore1,
          overs:
            overs1 ||
            parsedScore1.overs ||
            ""
        }
      : null;


  const score2 =
    parsedScore2
      ? {
          ...parsedScore2,
          overs:
            overs2 ||
            parsedScore2.overs ||
            ""
        }
      : null;


  const battingTeamIndex =
    findBattingTeamIndex({
      ...match,
      team1,
      team2,
      status,
      rawStatus
    });


  return {

    id:
      match.id ||
      `${team1}-${team2}-${match.dateTimeGMT || ""}`,

    name:
      `${team1} vs ${team2}`,

    team1,

    team2,

    team1Logo:
      match.t1img ||
      match.team1Logo ||
      "",

    team2Logo:
      match.t2img ||
      match.team2Logo ||
      "",

    team1Score:
      score1,

    team2Score:
      score2,

    // Kept for compatibility
    score: [
      score1,
      score2
    ],

    team1Overs:
      overs1 || "",

    team2Overs:
      overs2 || "",

    status,

    statusText:
      rawStatus,

    rawStatus,

    battingTeamIndex,

    venue:
      match.venue ||
      match.ground ||
      match.stadium ||
      "",

    date:
      match.date ||
      "",

    dateTimeGMT:
      match.dateTimeGMT ||
      "",

    matchType:
      match.matchType ||
      "",

    series:
      match.series ||
      "",

    matchStarted:
      status === "LIVE",

    matchEnded:
      status === "RESULT"
  };
}


// ============================================================
// SORT
// ============================================================

function sortMatches(
  matches
) {

  const priority = {
    LIVE: 1
  };


  return [...matches].sort(
    (a, b) => {

      const pa =
        priority[a.status] || 99;

      const pb =
        priority[b.status] || 99;

      if (pa !== pb) {
        return pa - pb;
      }

      return String(
        a.dateTimeGMT || ""
      ).localeCompare(
        String(
          b.dateTimeGMT || ""
        )
      );
    }
  );
}


// ============================================================
// CRICKET API
// ============================================================

async function getCricketScores(
  env
) {

  const apiKey =
    env.CRICKET_API_KEY;


  if (!apiKey) {

    throw new Error(
      "CRICKET_API_KEY secret missing."
    );
  }


  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(apiKey)}`;


  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          "Accept":
            "application/json"
        },

        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }
      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch (error) {

    throw new Error(
      "Cricket API ने valid JSON नहीं भेजा."
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
    String(data.status).toLowerCase() !== "success"
  ) {

    throw new Error(
      data?.message ||
      "Cricket API request failed."
    );
  }


  const list =
    Array.isArray(data?.data)
      ? data.data
      : [];


  // ========================================================
  // IMPORTANT:
  // ONLY CURRENT LIVE MATCHES
  // ========================================================

  const matches =
    list
      .map(
        formatCricScoreMatch
      )
      .filter(Boolean)
      .filter(
        match =>
          match.status === "LIVE"
      );


  return sortMatches(
    matches
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
          "Cloudflare AI binding missing."
      },
      500
    );
  }


  let body;

  try {

    body =
      await request.json();

  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Invalid JSON request."
      },
      400
    );
  }


  const player =
    String(
      body.player ||
      body.playerName ||
      "Cricket Player"
    ).trim();


  const team =
    String(
      body.team ||
      "India"
    ).trim();


  const pose =
    String(
      body.pose ||
      "Batting"
    ).trim();


  const type =
    String(
      body.type ||
      "Batsman"
    ).trim();


  const hand =
    String(
      body.hand ||
      "Right"
    ).trim();


  const style =
    String(
      body.style ||
      "Realistic"
    ).trim();


  const jersey =
    String(
      body.jersey ||
      body.jerseyColor ||
      "Blue"
    ).trim();


  const jerseyNumber =
    String(
      body.jerseyNumber ||
      body.number ||
      "18"
    ).trim();


  const stadium =
    String(
      body.stadium ||
      "International Stadium"
    ).trim();


  const weather =
    String(
      body.weather ||
      "Clear"
    ).trim();


  const matchTime =
    String(
      body.matchTime ||
      "Day"
    ).trim();


  const camera =
    String(
      body.camera ||
      body.cameraAngle ||
      "Front"
    ).trim();


  const tournament =
    String(
      body.tournament ||
      "T20 World Cup"
    ).trim();


  const prompt = `
Create a photorealistic cinematic cricket sports image.

Player:
${player}

Team:
${team}

Role:
${type}

Pose:
${pose}

Playing hand:
${hand}

Jersey color:
${jersey}

Jersey number:
${jerseyNumber}

Stadium:
${stadium}

Weather:
${weather}

Match time:
${matchTime}

Camera:
${camera}

Tournament:
${tournament}

Style:
${style}

Requirements:
- professional cricket photography
- realistic cricket uniform
- realistic cricket equipment
- dramatic stadium floodlights
- energetic cricket crowd
- realistic human proportions
- detailed face
- natural skin texture
- sharp subject
- cinematic lighting
- high detail
- dynamic sports photography
- no watermark
- no unnecessary text
`;


  try {

    const result =
      await env.AI.run(
        AI_MODEL,
        {
          prompt
        }
      );


    if (
      !result ||
      !result.image
    ) {

      return jsonResponse(
        {
          success: false,
          error:
            "AI ने image नहीं बनाई."
        },
        500
      );
    }


    // ======================================================
    // Cloudflare AI returns base64 image
    // Convert to JPEG
    // ======================================================

    const binary =
      atob(
        result.image
      );


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


    return new Response(
      bytes,
      {
        status: 200,

        headers: corsHeaders({
          "Content-Type":
            "image/jpeg",

          "Content-Disposition":
            'inline; filename="cricket-short-ai.jpg"'
        })
      }
    );

  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          "AI image generation failed."
      },
      500
    );
  }
}


// ============================================================
// MAIN WORKER
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
      new URL(request.url);


    const pathname =
      url.pathname;


    // --------------------------------------------------------
    // HEALTH
    // --------------------------------------------------------

    if (
      pathname === "/api/health"
    ) {

      return jsonResponse({
        success: true,

        worker:
          "Cricket Short Worker",

        ai:
          !!env.AI,

        cricketApiKey:
          !!env.CRICKET_API_KEY,

        assets:
          !!env.ASSETS,

        time:
          new Date().toISOString()
      });
    }


    // --------------------------------------------------------
    // LIVE SCORE
    // --------------------------------------------------------

    if (
      pathname === "/api/live-score"
    ) {

      try {

        const matches =
          await getCricketScores(
            env
          );


        return jsonResponse({
          success: true,

          count:
            matches.length,

          liveCount:
            matches.length,

          updatedAt:
            new Date().toISOString(),

          source:
            "cricScore",

          range:
            "CURRENT LIVE ONLY",

          matches
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,

            error:
              "LIVE_SCORE_ERROR",

            message:
              error?.message ||
              "Live score load failed."
          },
          500
        );
      }
    }


    // --------------------------------------------------------
    // AI IMAGE
    // --------------------------------------------------------

    if (
      pathname === "/api/generate-image"
    ) {

      if (
        request.method !== "POST"
      ) {

        return jsonResponse(
          {
            success: false,
            error:
              "POST method required."
          },
          405
        );
      }


      return generateImage(
        request,
        env
      );
    }


    // --------------------------------------------------------
    // STATIC ASSETS
    // --------------------------------------------------------

    if (
      env.ASSETS
    ) {

      return env.ASSETS.fetch(
        request
      );
    }


    return new Response(
      "Cricket Short Worker is running.",
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
};
