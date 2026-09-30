export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {

      // =====================================================
      // HEALTH
      // =====================================================
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


      // =====================================================
      // LIVE / UPCOMING / RESULT CRICKET SCORE
      // =====================================================
      if (url.pathname === "/api/live-score") {

        if (!env.CRICKET_API_KEY) {
          return json({
            success: false,
            error: "CRICKET_API_KEY is missing"
          }, 500);
        }

        const apiUrl =
          "https://api.cricapi.com/v1/cricScore?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        const raw = await response.text();

        let apiData;

        try {
          apiData = JSON.parse(raw);
        } catch (e) {
          return json({
            success: false,
            error: "Cricket API returned invalid JSON",
            httpStatus: response.status,
            rawPreview: raw.slice(0, 1000)
          }, 502);
        }

        if (!Array.isArray(apiData?.data)) {
          return json({
            success: false,
            error: "Cricket API data array not found",
            apiResponse: apiData
          }, 502);
        }

        const matches = apiData.data
          .map(formatCricScoreMatch)
          .filter(Boolean)
          .sort(sortMatches);


        return json({
          success: true,
          count: matches.length,
          updatedAt: new Date().toISOString(),
          source: "cricScore",
          range: "Last 7 days + Next 7 days + Current Live",
          matches
        });
      }


      // =====================================================
      // AI IMAGE GENERATOR
      // =====================================================
      if (url.pathname === "/api/generate-image") {

        if (!env.AI) {
          return json({
            success: false,
            error: "Workers AI binding is missing"
          }, 500);
        }

        if (request.method !== "POST") {
          return json({
            success: false,
            error: "Only POST requests are allowed"
          }, 405);
        }

        let body;

        try {
          body = await request.json();
        } catch (e) {
          return json({
            success: false,
            error: "Invalid JSON request"
          }, 400);
        }

        const prompt = String(body?.prompt || "").trim();

        if (!prompt) {
          return json({
            success: false,
            error: "Prompt is required"
          }, 400);
        }

        try {

          const result = await env.AI.run(
            "@cf/black-forest-labs/flux-1-schnell",
            {
              prompt: prompt
            }
          );

          if (!result || !result.image) {
            return json({
              success: false,
              error: "Workers AI returned no image"
            }, 502);
          }

          const base64 = arrayBufferToBase64(result.image);

          return json({
            success: true,
            image: "data:image/jpeg;base64," + base64
          });

        } catch (error) {

          return json({
            success: false,
            error: "AI generation failed",
            details: error?.message || String(error)
          }, 500);
        }
      }


      // =====================================================
      // STATIC WEBSITE
      // =====================================================
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response(
        "Cricket Short Worker is running.",
        {
          status: 200,
          headers: {
            "content-type": "text/plain;charset=UTF-8"
          }
        }
      );

    } catch (error) {

      return json({
        success: false,
        error: error?.message || String(error)
      }, 500);
    }
  }
};


// =========================================================
// CRICSCORE PARSER
// =========================================================

function formatCricScoreMatch(m) {

  if (!m || !m.id) return null;

  const team1 = cleanTeamName(m.t1);
  const team2 = cleanTeamName(m.t2);

  const statusRaw = String(m.status || "").trim();
  const mode = String(m.ms || "").toLowerCase();

  const status = getStatus(mode, statusRaw);

  const score1 = parseScore(m.t1s);
  const score2 = parseScore(m.t2s);

  const matchName =
    team1 && team2
      ? `${team1} vs ${team2}`
      : "Cricket Match";

  return {
    id: String(m.id),

    name: matchName,

    team1: team1 || "Team 1",
    team2: team2 || "Team 2",

    team1Logo: m.t1img || "",
    team2Logo: m.t2img || "",

    score: [
      score1,
      score2
    ].filter(Boolean),

    team1Score: score1,
    team2Score: score2,

    status: status,

    statusText: statusRaw,

    venue: m.venue || "Cricket Stadium",

    date:
      m.date ||
      (m.dateTimeGMT
        ? String(m.dateTimeGMT).slice(0, 10)
        : ""),

    dateTimeGMT: m.dateTimeGMT || "",

    matchType:
      String(m.matchType || "cricket").toUpperCase(),

    series: m.series || "",

    matchStarted:
      mode === "live" ||
      mode === "result" ||
      mode === "completed" ||
      !!score1 ||
      !!score2,

    matchEnded:
      status === "RESULT"
  };
}


// =========================================================
// TEAM NAME
// =========================================================

function cleanTeamName(value) {

  if (!value) return "";

  return String(value)
    .replace(/\s*\[[A-Z0-9]+\]\s*$/i, "")
    .trim();
}


// =========================================================
// STATUS
// =========================================================

function getStatus(mode, text) {

  const s = String(text || "").toLowerCase();

  if (
    mode === "live" ||
    s.includes("live") ||
    s.includes("playing") ||
    s.includes("innings")
  ) {
    return "LIVE";
  }

  if (
    s.includes("stumps") ||
    s.includes("stump")
  ) {
    return "STUMPS";
  }

  if (
    s.includes("delay") ||
    s.includes("delayed")
  ) {
    return "DELAYED";
  }

  if (
    mode === "fixture" ||
    s.includes("match starts") ||
    s.includes("starts at")
  ) {
    return "UPCOMING";
  }

  if (
    mode === "result" ||
    mode === "completed" ||
    s.includes("won by") ||
    s.includes("match drawn") ||
    s.includes("no result") ||
    s.includes("tied")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}


// =========================================================
// SCORE PARSER
// =========================================================

function parseScore(value) {

  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  /*
    Examples supported:

    300/2
    300/2 (41.4)
    300/2 (41.4 ov)
    168/1 (28.2)
    295/7 (50)
    120/3
  */

  const runMatch = text.match(/(\d+)\s*\/\s*(\d+)/);

  if (!runMatch) {

    // Sometimes API may return only runs
    const onlyRuns = text.match(/^\s*(\d+)\s*$/);

    if (!onlyRuns) {
      return {
        raw: text,
        runs: null,
        wickets: null,
        overs: null,
        display: text
      };
    }

    return {
      raw: text,
      runs: Number(onlyRuns[1]),
      wickets: null,
      overs: null,
      display: text
    };
  }

  const runs = Number(runMatch[1]);
  const wickets = Number(runMatch[2]);

  let overs = null;

  const overMatch = text.match(
    /\(\s*(\d+(?:\.\d+)?)\s*(?:ov|overs?)?\s*\)/i
  );

  if (overMatch) {
    overs = Number(overMatch[1]);
  }

  const display =
    overs !== null
      ? `${runs}/${wickets} (${formatOvers(overs)} ov)`
      : `${runs}/${wickets}`;

  return {
    raw: text,
    runs,
    wickets,
    overs,
    display
  };
}


// =========================================================
// OVERS FORMAT
// =========================================================

function formatOvers(value) {

  if (value === null || value === undefined) {
    return "";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return String(number);
}


// =========================================================
// MATCH SORTING
// =========================================================

function sortMatches(a, b) {

  const priority = {
    LIVE: 1,
    STUMPS: 2,
    DELAYED: 3,
    UPCOMING: 4,
    RESULT: 5
  };

  const pa = priority[a.status] || 9;
  const pb = priority[b.status] || 9;

  if (pa !== pb) {
    return pa - pb;
  }

  const indiaA =
    /india/i.test(a.team1) ||
    /india/i.test(a.team2);

  const indiaB =
    /india/i.test(b.team1) ||
    /india/i.test(b.team2);

  if (indiaA && !indiaB) return -1;
  if (!indiaA && indiaB) return 1;

  const da =
    new Date(a.dateTimeGMT || 0).getTime();

  const db =
    new Date(b.dateTimeGMT || 0).getTime();

  if (a.status === "UPCOMING") {
    return da - db;
  }

  return db - da;
}


// =========================================================
// JSON
// =========================================================

function json(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    }
  );
}


// =========================================================
// ARRAYBUFFER → BASE64
// =========================================================

function arrayBufferToBase64(buffer) {

  const bytes = new Uint8Array(buffer);

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {

    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      )
    );
  }

  return btoa(binary);
              }
