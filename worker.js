// ======================================================
// 🏏 CRICKET SHORT - CLOUDFLARE WORKER
// AI IMAGE + LIVE CRICKET SCORE
// ======================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CRICKET_API =
  "https://api.cricapi.com/v1/cricScore";


// ======================================================
// MAIN FETCH
// ======================================================

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // --------------------------------------------------
    // CORS
    // --------------------------------------------------

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    try {

      // =================================================
      // HEALTH CHECK
      // =================================================

      if (url.pathname === "/api/health") {

        return json({
          success: true,
          worker: "Cricket Short Worker",
          ai: !!env.AI,
          cricketApiKey: !!env.CRICKET_API_KEY,
          assets: !!env.ASSETS,
          time: new Date().toISOString()
        });
      }


      // =================================================
      // LIVE CRICKET SCORE
      // =================================================

      if (url.pathname === "/api/live-score") {

        if (!env.CRICKET_API_KEY) {
          return json({
            success: false,
            error: "CRICKET_API_KEY Secret नहीं मिला।"
          }, 500);
        }

        const apiUrl =
          `${CRICKET_API}?apikey=${encodeURIComponent(
            env.CRICKET_API_KEY
          )}&offset=0`;

        const apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          cf: {
            cacheTtl: 0,
            cacheEverything: false
          }
        });

        const rawText = await apiResponse.text();

        if (!rawText) {
          return json({
            success: false,
            error: "Cricket API ने खाली response दिया।"
          }, 502);
        }

        let data;

        try {
          data = JSON.parse(rawText);
        } catch (e) {

          return json({
            success: false,
            error: "Cricket API ने valid JSON नहीं भेजा।",
            httpStatus: apiResponse.status,
            response: rawText.slice(0, 500)
          }, 502);
        }

        if (!apiResponse.ok) {
          return json({
            success: false,
            error: "Cricket API request failed.",
            httpStatus: apiResponse.status,
            response: data
          }, 502);
        }

        if (
          data.status !== "success" ||
          !Array.isArray(data.data)
        ) {

          return json({
            success: false,
            error: "Cricket API से मैच data नहीं मिला।",
            apiStatus: data.status || null
          }, 502);
        }


        // -----------------------------------------------
        // FORMAT MATCHES
        // -----------------------------------------------

        const matches = data.data
          .map(formatCricScoreMatch)
          .filter(Boolean);


        // -----------------------------------------------
        // IMPORTANT:
        // LIVE MATCHES ALWAYS FIRST
        // -----------------------------------------------

        const priority = {
          LIVE: 1,
          STUMPS: 2,
          DELAYED: 3,
          UPCOMING: 4,
          RESULT: 5
        };

        matches.sort((a, b) => {

          const pa = priority[a.status] || 99;
          const pb = priority[b.status] || 99;

          if (pa !== pb) {
            return pa - pb;
          }

          return String(a.dateTimeGMT || "")
            .localeCompare(
              String(b.dateTimeGMT || "")
            );
        });


        return json({
          success: true,
          count: matches.length,
          updatedAt: new Date().toISOString(),
          source: "cricScore",
          liveCount: matches.filter(
            m => m.status === "LIVE"
          ).length,
          matches
        });
      }


      // =================================================
      // AI IMAGE GENERATION
      // =================================================

      if (
        url.pathname === "/api/generate-image" &&
        request.method === "POST"
      ) {

        if (!env.AI) {
          return json({
            success: false,
            error: "Workers AI binding 'AI' नहीं मिला।"
          }, 500);
        }

        let body;

        try {
          body = await request.json();
        } catch (e) {

          return json({
            success: false,
            error: "Invalid JSON request."
          }, 400);
        }

        const prompt = String(
          body?.prompt || ""
        ).trim();


        if (!prompt) {

          return json({
            success: false,
            error: "Image prompt खाली है।"
          }, 400);
        }


        // -----------------------------------------------
        // AI GENERATE
        // -----------------------------------------------

        const result = await env.AI.run(
          AI_MODEL,
          {
            prompt: prompt,
            steps: 4
          }
        );


        if (!result || !result.image) {

          return json({
            success: false,
            error: "AI ने image data नहीं लौटाया।"
          }, 500);
        }


        // -----------------------------------------------
        // BASE64 → BINARY IMAGE
        // -----------------------------------------------

        let base64 = String(result.image);

        // अगर API ने data:image/... prefix भेजा हो
        if (base64.includes(",")) {
          base64 = base64.split(",").pop();
        }

        try {

          const binaryString = atob(base64);

          const bytes = new Uint8Array(
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


          // -------------------------------------------
          // DIRECT IMAGE RESPONSE
          // Browser इसे सीधे image की तरह पढ़ेगा
          // -------------------------------------------

          return new Response(bytes, {

            status: 200,

            headers: {
              "Content-Type": "image/jpeg",
              "Content-Length": String(bytes.length),

              "Cache-Control":
                "no-store, no-cache, must-revalidate",

              "Pragma": "no-cache",

              "Access-Control-Allow-Origin": "*",

              "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

              "Access-Control-Allow-Headers":
                "Content-Type"
            }

          });

        } catch (error) {

          return json({
            success: false,
            error:
              "AI image को binary image में convert नहीं किया जा सका।",
            details: String(error)
          }, 500);
        }
      }


      // =================================================
      // STATIC WEBSITE
      // =================================================

      if (env.ASSETS) {

        return env.ASSETS.fetch(request);
      }


      return json({
        success: false,
        error: "ASSETS binding उपलब्ध नहीं है।"
      }, 500);


    } catch (error) {

      return json({
        success: false,
        error: "Worker internal error.",
        details: String(error)
      }, 500);
    }
  }
};


// ======================================================
// CRICKET MATCH FORMATTER
// ======================================================

function formatCricScoreMatch(m) {

  if (!m || !m.id) {
    return null;
  }


  const team1 = cleanTeamName(m.t1);
  const team2 = cleanTeamName(m.t2);

  const statusRaw =
    String(m.status || "").trim();

  const mode =
    String(m.ms || "").toLowerCase();


  const status =
    getStatus(mode, statusRaw);


  const score1 =
    parseScore(m.t1s);

  const score2 =
    parseScore(m.t2s);


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

    score:
      [score1, score2].filter(Boolean),

    team1Score:
      score1,

    team2Score:
      score2,

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
      String(
        m.matchType || "cricket"
      ).toUpperCase(),

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


// ======================================================
// STATUS DETECTION
// ======================================================

function getStatus(mode, text) {

  const s =
    String(text || "").toLowerCase();


  // ----------------------------------------------------
  // RESULT MUST BE CHECKED FIRST
  // ----------------------------------------------------

  if (

    mode === "result" ||

    mode === "completed" ||

    s.includes("won by") ||

    s.includes("lost by") ||

    s.includes("match drawn") ||

    s.includes("no result") ||

    s.includes("tied") ||

    s.includes("abandoned")

  ) {

    return "RESULT";
  }


  // ----------------------------------------------------
  // STUMPS
  // ----------------------------------------------------

  if (
    s.includes("stumps") ||
    s.includes("stump")
  ) {

    return "STUMPS";
  }


  // ----------------------------------------------------
  // DELAYED
  // ----------------------------------------------------

  if (
    s.includes("delay") ||
    s.includes("delayed") ||
    s.includes("rain")
  ) {

    return "DELAYED";
  }


  // ----------------------------------------------------
  // UPCOMING
  // ----------------------------------------------------

  if (

    mode === "fixture" ||

    s.includes("match starts") ||

    s.includes("starts at") ||

    s.includes("scheduled")

  ) {

    return "UPCOMING";
  }


  // ----------------------------------------------------
  // LIVE
  // IMPORTANT:
  // "innings" alone is NOT enough to call LIVE
  // ----------------------------------------------------

  if (

    mode === "live" ||

    s.includes("live") ||

    s.includes("playing") ||

    s.includes("in progress")

  ) {

    return "LIVE";
  }


  // ----------------------------------------------------
  // DEFAULT
  // ----------------------------------------------------

  return "UPCOMING";
}


// ======================================================
// TEAM NAME CLEANER
// ======================================================

function cleanTeamName(value) {

  if (!value) {
    return "";
  }

  return String(value)
    .replace(/\s*\[[A-Z]{2,4}\]\s*$/i, "")
    .trim();
}


// ======================================================
// SCORE PARSER
// ======================================================

function parseScore(value) {

  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }


  // Examples:
  // 120/3
  // 120/3 (15.2)
  // 300/2 (41.4 ov)
  // 168/10 (56.1 ov)

  const match =
    text.match(
      /^(\d+)(?:\/(\d+))?(?:\s*\(([^)]*)\))?/
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

    runs:
      match[1]
        ? Number(match[1])
        : null,

    wickets:
      match[2] !== undefined
        ? Number(match[2])
        : null,

    overs:
      match[3]
        ? String(match[3])
            .replace(/\s*ov.*/i, "")
            .trim()
        : ""
  };
}


// ======================================================
// JSON RESPONSE
// ======================================================

function json(data, status = 200) {

  return new Response(
    JSON.stringify(data),

    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Methods":
          "GET,POST,OPTIONS",

        "Access-Control-Allow-Headers":
          "Content-Type"
      }
    }
  );
}


// ======================================================
// CORS
// ======================================================

function corsHeaders() {

  return {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
      "GET,POST,OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type",

    "Access-Control-Max-Age":
      "86400"
  };
    }
