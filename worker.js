// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// Live Score + AI Image + Static Assets
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CRICKET_API_URL = "https://api.cricapi.com/v1/cricScore";


// ============================================================
// CORS
// ============================================================

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    })
  });
}


// ============================================================
// TEAM NAME CLEANER
// India [IND] -> India
// ============================================================

function cleanTeamName(value) {
  if (!value) return "";

  return String(value)
    .replace(/\s*\[[A-Z0-9]+\]\s*$/i, "")
    .trim();
}


// ============================================================
// SCORE PARSER
// 300/2 (41.4 ov)
// 37/1 (5 ov)
// ============================================================

function parseScore(value) {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  const match = text.match(
    /(\d+)\s*\/\s*(\d+)(?:\s*\(([\d.]+)\s*ov\))?/i
  );

  if (!match) {
    return {
      raw: text,
      runs: null,
      wickets: null,
      overs: ""
    };
  }

  return {
    raw: text,
    runs: Number(match[1]),
    wickets: Number(match[2]),
    overs: match[3] ? match[3] : ""
  };
}


// ============================================================
// STATUS
// ============================================================

function getStatus(mode, text) {

  const m = String(mode || "").toLowerCase();
  const s = String(text || "").toLowerCase();

  // RESULT FIRST
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

  if (
    s.includes("stumps") ||
    s.includes("stump")
  ) {
    return "STUMPS";
  }

  if (
    s.includes("delay") ||
    s.includes("delayed") ||
    s.includes("rain")
  ) {
    return "DELAYED";
  }

  if (
    m === "fixture" ||
    s.includes("match starts") ||
    s.includes("starts at") ||
    s.includes("scheduled")
  ) {
    return "UPCOMING";
  }

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
// FIND CURRENT BATTING TEAM
//
// CricAPI cricScore normally gives status text such as:
// "India opt to bowl"
// "West Indies opt to bat"
//
// We use that information to determine which team's score
// should be displayed in LIVE mode.
//
// IMPORTANT:
// If we cannot confidently identify the batting team,
// we keep both scores available internally but mark
// battingTeamIndex as null.
// ============================================================

function findBattingTeamIndex(team1, team2, statusText) {

  const t1 = String(team1 || "").toLowerCase();
  const t2 = String(team2 || "").toLowerCase();

  const status = String(statusText || "").toLowerCase();

  // ----------------------------------------------------------
  // "Team 1 opt to bowl"
  // Therefore Team 2 is batting.
  // ----------------------------------------------------------

  if (
    status.includes(t1.toLowerCase() + " opt to bowl") ||
    status.includes(t1.toLowerCase() + " opted to bowl")
  ) {
    return 1;
  }

  // ----------------------------------------------------------
  // "Team 2 opt to bowl"
  // Therefore Team 1 is batting.
  // ----------------------------------------------------------

  if (
    status.includes(t2.toLowerCase() + " opt to bowl") ||
    status.includes(t2.toLowerCase() + " opted to bowl")
  ) {
    return 0;
  }

  // ----------------------------------------------------------
  // "Team 1 opt to bat"
  // Therefore Team 1 is batting.
  // ----------------------------------------------------------

  if (
    status.includes(t1.toLowerCase() + " opt to bat") ||
    status.includes(t1.toLowerCase() + " opted to bat")
  ) {
    return 0;
  }

  // ----------------------------------------------------------
  // "Team 2 opt to bat"
  // Therefore Team 2 is batting.
  // ----------------------------------------------------------

  if (
    status.includes(t2.toLowerCase() + " opt to bat") ||
    status.includes(t2.toLowerCase() + " opted to bat")
  ) {
    return 1;
  }

  // ----------------------------------------------------------
  // Alternative wording
  // ----------------------------------------------------------

  if (
    status.includes(t1.toLowerCase() + " batting") ||
    status.includes(t1.toLowerCase() + " are batting")
  ) {
    return 0;
  }

  if (
    status.includes(t2.toLowerCase() + " batting") ||
    status.includes(t2.toLowerCase() + " are batting")
  ) {
    return 1;
  }

  return null;
}


// ============================================================
// FORMAT ONE CRICKET SCORE MATCH
// ============================================================

function formatCricScoreMatch(m) {

  if (!m || !m.id) {
    return null;
  }

  const team1 = cleanTeamName(m.t1);
  const team2 = cleanTeamName(m.t2);

  const statusRaw = String(m.status || "").trim();
  const mode = String(m.ms || "").toLowerCase();

  const status = getStatus(mode, statusRaw);

  const rawScore1 = parseScore(m.t1s);
  const rawScore2 = parseScore(m.t2s);

  // ----------------------------------------------------------
  // Detect current batting team
  // ----------------------------------------------------------

  const battingTeamIndex = findBattingTeamIndex(
    team1,
    team2,
    statusRaw
  );

  // ----------------------------------------------------------
  // ONLY CURRENT BATTING TEAM SCORE
  //
  // For LIVE/STUMPS:
  // batting team gets score
  // other team gets null
  //
  // For RESULT:
  // both scores can remain visible
  // ----------------------------------------------------------

  let score1 = rawScore1;
  let score2 = rawScore2;

  if (
    status === "LIVE" ||
    status === "STUMPS"
  ) {

    if (battingTeamIndex === 0) {
      score2 = null;
    }

    if (battingTeamIndex === 1) {
      score1 = null;
    }

    // If API did not tell us batting team,
    // do not show both scores.
    //
    // Pick the score that exists if only one exists.
    // If both exist and batting team is unknown,
    // hide both rather than showing incorrect information.
    if (battingTeamIndex === null) {

      if (rawScore1 && !rawScore2) {
        score1 = rawScore1;
        score2 = null;
      }
      else if (!rawScore1 && rawScore2) {
        score1 = null;
        score2 = rawScore2;
      }
      else {
        score1 = null;
        score2 = null;
      }
    }
  }

  // ----------------------------------------------------------
  // Score array
  // ----------------------------------------------------------

  const score = [];

  if (score1) {
    score.push(score1);
  }

  if (score2) {
    score.push(score2);
  }

  return {
    id: String(m.id),

    name:
      `${team1 || "Team 1"} vs ${team2 || "Team 2"}`,

    team1:
      team1 || "Team 1",

    team2:
      team2 || "Team 2",

    team1Logo:
      m.t1img || "",

    team2Logo:
      m.t2img || "",

    // Only the score that should be displayed
    score,

    team1Score:
      score1,

    team2Score:
      score2,

    // Keep raw scores internally useful
    rawTeam1Score:
      rawScore1,

    rawTeam2Score:
      rawScore2,

    // 0 = Team 1 batting
    // 1 = Team 2 batting
    // null = unknown
    battingTeamIndex,

    status,

    statusText:
      statusRaw,

    venue:
      m.venue || "Venue not available",

    date:
      m.date ||
      (
        m.dateTimeGMT
          ? String(m.dateTimeGMT).slice(0, 10)
          : ""
      ),

    dateTimeGMT:
      m.dateTimeGMT || "",

    matchType:
      String(m.matchType || "cricket").toUpperCase(),

    series:
      m.series || "",

    matchStarted:
      status === "LIVE" ||
      status === "STUMPS" ||
      status === "RESULT",

    matchEnded:
      status === "RESULT"
  };
}


// ============================================================
// SORT MATCHES
// LIVE FIRST
// ============================================================

function sortMatches(matches) {

  const priority = {
    LIVE: 1,
    STUMPS: 2,
    DELAYED: 3,
    UPCOMING: 4,
    RESULT: 5
  };

  return matches.sort((a, b) => {

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
      String(b.dateTimeGMT || "")
    );
  });
}


// ============================================================
// FETCH CRICKET SCORE
// ============================================================

async function getCricketScores(env) {

  if (!env.CRICKET_API_KEY) {

    throw new Error(
      "CRICKET_API_KEY secret is missing."
    );
  }

  const apiUrl =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(
      env.CRICKET_API_KEY
    )}`;

  const response =
    await fetch(apiUrl, {
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
  }
  catch (error) {

    throw new Error(
      "Cricket API returned invalid JSON."
    );
  }

  if (!response.ok) {

    throw new Error(
      `Cricket API HTTP ${response.status}`
    );
  }

  if (
    data.status !== "success" &&
    data.status !== true
  ) {

    throw new Error(
      data.info ||
      data.message ||
      "Cricket API request failed."
    );
  }

  const list =
    Array.isArray(data.data)
      ? data.data
      : [];

  const matches =
    list
      .map(formatCricScoreMatch)
      .filter(Boolean);

  return sortMatches(matches);
}


// ============================================================
// MAIN WORKER
// ============================================================

export default {

  async fetch(request, env, ctx) {

    const url =
      new URL(request.url);

    // --------------------------------------------------------
    // OPTIONS
    // --------------------------------------------------------

    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {

      return jsonResponse({
        success: true,
        worker: "Cricket Short Worker",
        ai: !!env.AI,
        cricketApiKey: !!env.CRICKET_API_KEY,
        assets: !!env.ASSETS,
        time: new Date().toISOString()
      });
    }


    // ========================================================
    // LIVE SCORE
    // ========================================================

    if (
      url.pathname === "/api/live-score" &&
      request.method === "GET"
    ) {

      try {

        const matches =
          await getCricketScores(env);

        const liveCount =
          matches.filter(
            m =>
              m.status === "LIVE" ||
              m.status === "STUMPS"
          ).length;

        return jsonResponse({
          success: true,

          count:
            matches.length,

          liveCount,

          updatedAt:
            new Date().toISOString(),

          source:
            "cricScore",

          range:
            "Last 7 days + Next 7 days + Current Live",

          matches
        });

      }
      catch (error) {

        return jsonResponse({
          success: false,
          error:
            error?.message ||
            "Live score failed."
        }, 500);
      }
    }


    // ========================================================
    // AI IMAGE GENERATION
    // ========================================================

    if (
      url.pathname === "/api/generate-image" &&
      request.method === "POST"
    ) {

      if (!env.AI) {

        return jsonResponse({
          success: false,
          error:
            "Workers AI binding is missing."
        }, 500);
      }

      let body;

      try {

        body =
          await request.json();

      }
      catch (error) {

        return jsonResponse({
          success: false,
          error:
            "Invalid JSON request."
        }, 400);
      }

      const prompt =
        String(
          body?.prompt || ""
        ).trim();

      if (!prompt) {

        return jsonResponse({
          success: false,
          error:
            "Prompt is required."
        }, 400);
      }

      try {

        const result =
          await env.AI.run(
            AI_MODEL,
            {
              prompt,
              steps: 4
            }
          );

        if (
          !result ||
          !result.image
        ) {

          return jsonResponse({
            success: false,
            error:
              "AI image was not returned."
          }, 500);
        }

        let base64 =
          String(result.image);

        if (
          base64.includes(",")
        ) {

          base64 =
            base64
              .split(",")
              .pop();
        }

        const binaryString =
          atob(base64);

        const bytes =
          new Uint8Array(
            binaryString.length
          );

        for (
          let i = 0;
          i < binaryString.length;
          i++
        ) {

          bytes[i] =
            binaryString.charCodeAt(i);
        }

        return new Response(
          bytes,
          {
            status: 200,

            headers:
              corsHeaders({
                "Content-Type":
                  "image/jpeg",

                "Content-Length":
                  String(bytes.length),

                "Cache-Control":
                  "no-store, no-cache, must-revalidate",

                "Pragma":
                  "no-cache"
              })
          }
        );

      }
      catch (error) {

        return jsonResponse({
          success: false,
          error:
            error?.message ||
            "AI image generation failed."
        }, 500);
      }
    }


    // ========================================================
    // STATIC WEBSITE
    // ========================================================

    if (env.ASSETS) {

      try {

        return await env.ASSETS.fetch(
          request
        );

      }
      catch (error) {

        return new Response(
          "Static asset error.",
          {
            status: 500,
            headers:
              corsHeaders({
                "Content-Type":
                  "text/plain; charset=utf-8"
              })
          }
        );
      }
    }


    // ========================================================
    // FALLBACK
    // ========================================================

    return jsonResponse({
      success: false,
      error:
        "Route not found."
    }, 404);
  }
};
