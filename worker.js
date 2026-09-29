const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CRICKET_API_URL = "https://api.cricapi.com/v1/currentMatches";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function normalizeScore(score) {
  if (!score) {
    return null;
  }

  return {
    inning: score.inning || "",
    runs: numberOrNull(
      score.runs !== undefined ? score.runs : score.r
    ),
    wickets: numberOrNull(
      score.wickets !== undefined ? score.wickets : score.w
    ),
    overs:
      score.overs !== undefined
        ? score.overs
        : score.o !== undefined
        ? score.o
        : ""
  };
}

function normalizeMatch(match) {
  const teams = Array.isArray(match.teams)
    ? match.teams
    : [];

  const teamInfo = Array.isArray(match.teamInfo)
    ? match.teamInfo
    : [];

  const team1 = teams[0] || "Team 1";
  const team2 = teams[1] || "Team 2";

  const logo1 =
    teamInfo.find(
      item =>
        normalizeName(item.name) ===
        normalizeName(team1)
    )?.img || "";

  const logo2 =
    teamInfo.find(
      item =>
        normalizeName(item.name) ===
        normalizeName(team2)
    )?.img || "";

  const scores = Array.isArray(match.score)
    ? match.score.map(normalizeScore).filter(Boolean)
    : [];

  let status = String(
    match.status || ""
  );

  const statusUpper = status.toUpperCase();

  let displayStatus = "LIVE";

  if (
    statusUpper.includes("STUMP") ||
    statusUpper.includes("BREAK")
  ) {
    displayStatus = "STUMPS";
  } else if (
    statusUpper.includes("DELAY") ||
    statusUpper.includes("RAIN")
  ) {
    displayStatus = "DELAYED";
  } else if (
    statusUpper.includes("WON") ||
    statusUpper.includes("RESULT") ||
    statusUpper.includes("DRAW")
  ) {
    displayStatus = "RESULT";
  } else if (
    statusUpper.includes("LIVE") ||
    match.matchStarted === true
  ) {
    displayStatus = "LIVE";
  }

  return {
    id: match.id || "",
    name:
      match.name ||
      `${team1} vs ${team2}`,
    team1,
    team2,
    team1Logo: logo1,
    team2Logo: logo2,
    score: scores,
    status: displayStatus,
    statusText: status,
    venue:
      match.venue ||
      match.venueInfo?.ground ||
      "",
    date:
      match.date ||
      match.dateTimeGMT ||
      "",
    matchType:
      match.matchType ||
      "",
    series:
      match.series_id ||
      "",
    matchStarted:
      match.matchStarted === true,
    matchEnded:
      match.matchEnded === true
  };
}

async function getLiveScores(env) {
  const apiKey = env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CRICKET_API_KEY is missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=` +
    encodeURIComponent(apiKey) +
    `&offset=0`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  });

  if (!response.ok) {
    throw new Error(
      `Cricket API HTTP ${response.status}`
    );
  }

  const raw = await response.json();

  if (
    raw &&
    raw.status &&
    String(raw.status).toLowerCase() === "failure"
  ) {
    throw new Error(
      raw.info ||
      "Cricket API returned failure"
    );
  }

  const matches = Array.isArray(raw.data)
    ? raw.data
    : [];

  return matches.map(normalizeMatch);
}

async function generateImage(env, request) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Workers AI binding is missing"
      },
      500
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        success: false,
        error: "Invalid JSON body"
      },
      400
    );
  }

  const prompt =
    String(body?.prompt || "").trim();

  if (!prompt) {
    return json(
      {
        success: false,
        error: "Prompt is required"
      },
      400
    );
  }

  if (prompt.length > 2048) {
    return json(
      {
        success: false,
        error: "Prompt is too long"
      },
      400
    );
  }

  try {
    const result = await env.AI.run(
      AI_MODEL,
      {
        prompt,
        steps: 4,
        seed: Math.floor(
          Math.random() * 2147483647
        )
      }
    );

    if (!result || !result.image) {
      throw new Error(
        "Workers AI did not return an image"
      );
    }

    return json({
      success: true,
      image: result.image,
      contentType: "image/jpeg"
    });
  } catch (error) {
    console.error(
      "Workers AI error:",
      error
    );

    return json(
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

async function handleHealth(env) {
  return json({
    success: true,
    app: "Cricket Short",
    worker: "cricket-ai-app",
    workersAI: !!env.AI,
    cricketApiKey:
      !!env.CRICKET_API_KEY,
    endpoints: {
      generate: "/api/generate",
      generateImage: "/api/generate-image",
      score: "/api/score",
      liveScore: "/api/live-score",
      health: "/api/health"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type"
        }
      });
    }

    /*
     * HEALTH
     */
    if (
      url.pathname === "/api/health"
    ) {
      return handleHealth(env);
    }

    /*
     * AI IMAGE
     *
     * Both endpoints are supported
     * so old/new frontend code works.
     */
    if (
      request.method === "POST" &&
      (
        url.pathname === "/api/generate" ||
        url.pathname === "/api/generate-image"
      )
    ) {
      return generateImage(
        env,
        request
      );
    }

    /*
     * LIVE SCORE
     *
     * Both endpoints are supported.
     */
    if (
      request.method === "GET" &&
      (
        url.pathname === "/api/score" ||
        url.pathname === "/api/live-score"
      )
    ) {
      try {
        const matches =
          await getLiveScores(env);

        return json({
          success: true,
          matches,
          count: matches.length,
          updatedAt:
            new Date().toISOString()
        });
      } catch (error) {
        console.error(
          "Score API error:",
          error
        );

        return json(
          {
            success: false,
            matches: [],
            error:
              error?.message ||
              "Live score API failed"
          },
          502
        );
      }
    }

    /*
     * STATIC WEBSITE
     *
     * Everything else goes to
     * public/index.html/assets.
     */
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "Cricket Short Worker is running.",
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }
};
