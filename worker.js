export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==============================
    // LIVE CRICKET SCORE API
    // ==============================
    if (url.pathname === "/api/live-score") {
      if (request.method !== "GET") {
        return json({ success: false, error: "GET request required" }, 405);
      }

      const apiKey = env.CRICKET_API_KEY;

      if (!apiKey) {
        return json({
          success: false,
          error: "CRICKET_API_KEY is not configured in Cloudflare Worker"
        }, 500);
      }

      try {
        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(apiKey) +
          "&offset=0";

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          return json({
            success: false,
            error: "Cricket API returned HTTP " + response.status
          }, 502);
        }

        const apiData = await response.json();

        if (!apiData || !Array.isArray(apiData.data)) {
          return json({
            success: false,
            error: "Invalid cricket API response"
          }, 502);
        }

        const matches = apiData.data.map(formatMatch);

        // LIVE → STUMPS → DELAYED → UPCOMING → RESULT
        const priority = {
          LIVE: 1,
          STUMPS: 2,
          DELAYED: 3,
          UPCOMING: 4,
          RESULT: 5
        };

        matches.sort((a, b) => {
          const pa = priority[a.status] || 9;
          const pb = priority[b.status] || 9;

          if (pa !== pb) return pa - pb;

          // India matches first
          const ai = /india/i.test(a.name) ? 0 : 1;
          const bi = /india/i.test(b.name) ? 0 : 1;

          return ai - bi;
        });

        return json({
          success: true,
          updatedAt: new Date().toISOString(),
          count: matches.length,
          matches
        });

      } catch (error) {
        return json({
          success: false,
          error: error?.message || "Unable to fetch live cricket score"
        }, 500);
      }
    }

    // ==============================
    // AI IMAGE GENERATOR
    // ==============================
    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return json({
          success: false,
          error: "Only POST requests are allowed"
        }, 405);
      }

      try {
        const body = await request.json();
        const prompt = String(body?.prompt || "").trim();

        if (!prompt) {
          return json({
            success: false,
            error: "Prompt is required"
          }, 400);
        }

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt
          }
        );

        let imageBytes;

        if (result instanceof ArrayBuffer) {
          imageBytes = result;
        } else if (result?.image) {
          imageBytes = base64ToArrayBuffer(result.image);
        } else {
          return json({
            success: false,
            error: "AI image response was empty"
          }, 502);
        }

        const base64 = arrayBufferToBase64(imageBytes);

        return json({
          success: true,
          image: "data:image/png;base64," + base64
        });

      } catch (error) {
        return json({
          success: false,
          error: error?.message || "Image generation failed"
        }, 500);
      }
    }

    // ==============================
    // STATIC WEBSITE
    // ==============================
    return env.ASSETS.fetch(request);
  }
};


// =====================================
// FORMAT CRICKET MATCH
// =====================================
function formatMatch(match) {
  const teams = Array.isArray(match.teamInfo)
    ? match.teamInfo
    : [];

  const team1 =
    match.teams?.[0] ||
    teams?.[0]?.name ||
    "Team 1";

  const team2 =
    match.teams?.[1] ||
    teams?.[1]?.name ||
    "Team 2";

  const score = Array.isArray(match.score)
    ? match.score
    : [];

  return {
    id: match.id || crypto.randomUUID(),

    name: match.name || `${team1} vs ${team2}`,

    seriesName:
      match.series_id ||
      match.seriesName ||
      "",

    team1,
    team2,

    team1Logo:
      teams?.[0]?.img ||
      "",

    team2Logo:
      teams?.[1]?.img ||
      "",

    score: score.map(s => ({
      inning: s.inning || "",
      runs: Number.isFinite(Number(s.r))
        ? Number(s.r)
        : null,
      wickets: Number.isFinite(Number(s.w))
        ? Number(s.w)
        : null,
      overs: s.o ?? null
    })),

    venue:
      match.venue ||
      "Venue not available",

    date:
      match.date ||
      "",

    dateTimeGMT:
      match.dateTimeGMT ||
      "",

    matchType:
      String(match.matchType || "CRICKET")
        .toUpperCase(),

    statusText:
      match.status ||
      "",

    status:
      getStatus(match),

    matchStarted:
      Boolean(match.matchStarted),

    matchEnded:
      Boolean(match.matchEnded),

    toss:
      match.tossWinner
        ? `${match.tossWinner} won the toss`
        : "",

    rawStatus:
      match.status || ""
  };
}


// =====================================
// STATUS
// =====================================
function getStatus(match) {
  const status = String(match.status || "").toLowerCase();

  if (
    status.includes("won by") ||
    status.includes("won") ||
    status.includes("draw") ||
    status.includes("tied") ||
    status.includes("no result") ||
    status.includes("abandoned")
  ) {
    return "RESULT";
  }

  if (
    status.includes("stumps") ||
    status.includes("lunch") ||
    status.includes("tea") ||
    status.includes("innings break") ||
    status.includes("break")
  ) {
    return "STUMPS";
  }

  if (
    status.includes("delay") ||
    status.includes("rain") ||
    status.includes("bad light") ||
    status.includes("weather")
  ) {
    return "DELAYED";
  }

  if (match.matchStarted && !match.matchEnded) {
    return "LIVE";
  }

  return "UPCOMING";
}


// =====================================
// JSON RESPONSE
// =====================================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Access-Control-Allow-Origin": "*"
    }
  });
}


// =====================================
// BASE64 HELPERS
// =====================================
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
                     }
