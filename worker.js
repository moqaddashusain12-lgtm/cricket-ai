export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =====================================================
    // LIVE CRICKET SCORE API
    // =====================================================
    if (url.pathname === "/api/live-score") {
      if (request.method !== "GET") {
        return json(
          {
            success: false,
            error: "GET request required"
          },
          405
        );
      }

      const apiKey = env.CRICKET_API_KEY;

      if (!apiKey) {
        return json(
          {
            success: false,
            error: "CRICKET_API_KEY is not configured in Cloudflare Worker"
          },
          500
        );
      }

      try {
        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(apiKey) +
          "&offset=0";

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          return json(
            {
              success: false,
              error:
                "Cricket API returned HTTP " +
                response.status
            },
            502
          );
        }

        const apiData = await response.json();

        if (!apiData || !Array.isArray(apiData.data)) {
          return json(
            {
              success: false,
              error: "Invalid cricket API response"
            },
            502
          );
        }

        // -------------------------------------------------
        // INDIA LOCAL DATE (Asia/Kolkata)
        // -------------------------------------------------
        const indiaToday = getIndiaDate();

        // -------------------------------------------------
        // FORMAT + FILTER MATCHES
        // -------------------------------------------------
        const matches = apiData.data
          .map(formatMatch)
          .filter(match => {
            if (!match.date) {
              return false;
            }

            const matchDate = String(match.date).slice(0, 10);

            // केवल आज के मैच
            return matchDate === indiaToday;
          });

        // -------------------------------------------------
        // SORTING
        // LIVE → STUMPS → DELAYED → UPCOMING → RESULT
        // -------------------------------------------------
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

          if (pa !== pb) {
            return pa - pb;
          }

          // India matches first
          const ai =
            /india/i.test(
              `${a.name} ${a.team1} ${a.team2}`
            )
              ? 0
              : 1;

          const bi =
            /india/i.test(
              `${b.name} ${b.team1} ${b.team2}`
            )
              ? 0
              : 1;

          if (ai !== bi) {
            return ai - bi;
          }

          return a.name.localeCompare(b.name);
        });

        return json({
          success: true,
          updatedAt: new Date().toISOString(),
          date: indiaToday,
          count: matches.length,
          matches
        });
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error?.message ||
              "Unable to fetch live cricket score"
          },
          500
        );
      }
    }

    // =====================================================
    // AI IMAGE GENERATOR
    // =====================================================
    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return json(
          {
            success: false,
            error: "Only POST requests are allowed"
          },
          405
        );
      }

      try {
        const body = await request.json();

        const prompt = String(
          body?.prompt || ""
        ).trim();

        if (!prompt) {
          return json(
            {
              success: false,
              error: "Prompt is required"
            },
            400
          );
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
          imageBytes =
            base64ToArrayBuffer(result.image);
        } else {
          return json(
            {
              success: false,
              error: "AI image response was empty"
            },
            502
          );
        }

        const base64 =
          arrayBufferToBase64(imageBytes);

        return json({
          success: true,
          image:
            "data:image/png;base64," +
            base64
        });
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error?.message ||
              "Image generation failed"
          },
          500
        );
      }
    }

    // =====================================================
    // STATIC WEBSITE
    // =====================================================
    return env.ASSETS.fetch(request);
  }
};


// =====================================================
// FORMAT CRICKET MATCH
// =====================================================
function formatMatch(match) {
  const teams = Array.isArray(match.teamInfo)
    ? match.teamInfo
    : [];

  const teamNames = Array.isArray(match.teams)
    ? match.teams
    : [];

  const team1 =
    teamNames[0] ||
    teams[0]?.name ||
    "Team 1";

  const team2 =
    teamNames[1] ||
    teams[1]?.name ||
    "Team 2";

  const score = Array.isArray(match.score)
    ? match.score
    : [];

  // -----------------------------------------------------
  // REAL MATCH NAME
  // -----------------------------------------------------
  const matchName =
    match.name ||
    `${team1} vs ${team2}`;

  // -----------------------------------------------------
  // MATCH TYPE
  // -----------------------------------------------------
  const matchType = getMatchType(match);

  return {
    id:
      match.id ||
      `${team1}-${team2}-${match.date || ""}`,

    name: matchName,

    seriesName:
      match.seriesName ||
      match.series ||
      match.series_id ||
      "",

    team1,

    team2,

    team1Logo:
      teams[0]?.img ||
      "",

    team2Logo:
      teams[1]?.img ||
      "",

    score: score.map(s => ({
      inning:
        s?.inning ||
        "",

      runs:
        s?.r !== undefined &&
        s?.r !== null &&
        s?.r !== ""
          ? Number(s.r)
          : null,

      wickets:
        s?.w !== undefined &&
        s?.w !== null &&
        s?.w !== ""
          ? Number(s.w)
          : null,

      overs:
        s?.o !== undefined &&
        s?.o !== null
          ? s.o
          : null
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

    matchType,

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
      match.status ||
      ""
  };
}


// =====================================================
// MATCH TYPE
// =====================================================
function getMatchType(match) {
  const type = String(
    match.matchType ||
    match.type ||
    ""
  ).toLowerCase();

  if (
    type.includes("odi")
  ) {
    return "ODI";
  }

  if (
    type.includes("t20")
  ) {
    return "T20";
  }

  if (
    type.includes("test")
  ) {
    return "TEST";
  }

  // Match name से पहचानने की कोशिश
  const text = String(
    match.name ||
    ""
  ).toLowerCase();

  if (text.includes("odi")) {
    return "ODI";
  }

  if (
    text.includes("t20") ||
    text.includes("twenty20") ||
    text.includes("twenty-20")
  ) {
    return "T20";
  }

  if (text.includes("test")) {
    return "TEST";
  }

  return "CRICKET";
}


// =====================================================
// STATUS
// =====================================================
function getStatus(match) {
  const status = String(
    match.status || ""
  ).toLowerCase();

  // RESULT
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

  // STUMPS / BREAK
  if (
    status.includes("stumps") ||
    status.includes("lunch") ||
    status.includes("tea") ||
    status.includes("innings break") ||
    status.includes("break")
  ) {
    return "STUMPS";
  }

  // DELAYED
  if (
    status.includes("delay") ||
    status.includes("rain") ||
    status.includes("bad light") ||
    status.includes("weather") ||
    status.includes("wet outfield")
  ) {
    return "DELAYED";
  }

  // LIVE
  if (
    match.matchStarted &&
    !match.matchEnded
  ) {
    return "LIVE";
  }

  // UPCOMING
  return "UPCOMING";
}


// =====================================================
// INDIA DATE
// =====================================================
function getIndiaDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());
}


// =====================================================
// JSON RESPONSE
// =====================================================
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

        Pragma:
          "no-cache",

        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


// =====================================================
// ARRAY BUFFER → BASE64
// =====================================================
function arrayBufferToBase64(buffer) {
  const bytes =
    new Uint8Array(buffer);

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
        i + chunkSize
      )
    );
  }

  return btoa(binary);
}


// =====================================================
// BASE64 → ARRAY BUFFER
// =====================================================
function base64ToArrayBuffer(base64) {
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

  return bytes.buffer;
              }
