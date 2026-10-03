// ============================================================
// CRICKET SHORT - V2 FINAL WORKER.JS
// Live Score + Fixtures + Scorecard + Points
// AI Cricket Image + Poster Prompt + Static Assets
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CRICKET_API_URL = "https://api.cricapi.com/v1/cricScore";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    ...extra
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function parseScore(scoreText) {
  if (!scoreText) {
    return {
      runs: null,
      wickets: null,
      overs: null,
      display: ""
    };
  }

  const text = String(scoreText).trim();

  let runs = null;
  let wickets = null;
  let overs = null;

  const scoreMatch = text.match(/(\d+)\s*\/\s*(\d+)/);

  if (scoreMatch) {
    runs = Number(scoreMatch[1]);
    wickets = Number(scoreMatch[2]);
  } else {
    const runMatch = text.match(/(\d+)/);
    if (runMatch) {
      runs = Number(runMatch[1]);
    }
  }

  const overMatch = text.match(/(\d+(?:\.\d+)?)\s*ov/i);

  if (overMatch) {
    overs = overMatch[1];
  }

  return {
    runs,
    wickets,
    overs,
    display: text
  };
}

function findOvers(match, index = 0) {
  if (!match) return null;

  if (Array.isArray(match.score) && match.score[index]) {
    const item = match.score[index];

    if (item.o !== undefined && item.o !== null) {
      return String(item.o);
    }

    if (item.overs !== undefined && item.overs !== null) {
      return String(item.overs);
    }
  }

  if (match.score) {
    const scoreText = Array.isArray(match.score)
      ? JSON.stringify(match.score)
      : String(match.score);

    const found = scoreText.match(/(\d+(?:\.\d+)?)\s*ov/i);

    if (found) {
      return found[1];
    }
  }

  return null;
}

function getStatus(match) {
  const status = String(match?.status || "").toLowerCase();

  if (
    status.includes("live") ||
    status.includes("ongoing") ||
    status.includes("in progress")
  ) {
    return "LIVE";
  }

  if (
    status.includes("result") ||
    status.includes("won") ||
    status.includes("finished") ||
    status.includes("complete")
  ) {
    return "RESULT";
  }

  return "UPCOMING";
}

function findBattingTeamIndex(match) {
  if (!Array.isArray(match?.score) || !Array.isArray(match?.teamInfo)) {
    return 0;
  }

  for (let i = 0; i < match.score.length; i++) {
    const score = match.score[i];

    if (
      score &&
      (
        score.inning ||
        score.r ||
        score.w ||
        score.o
      )
    ) {
      return i;
    }
  }

  return 0;
}

function cleanTeamName(name) {
  if (!name) return "";

  return String(name)
    .replace(/\s+/g, " ")
    .trim();
}

function formatCricScoreMatch(match) {
  const teamInfo = Array.isArray(match?.teamInfo)
    ? match.teamInfo
    : [];

  const team1 = cleanTeamName(
    match?.teams?.[0] ||
    teamInfo?.[0]?.name ||
    "Team 1"
  );

  const team2 = cleanTeamName(
    match?.teams?.[1] ||
    teamInfo?.[1]?.name ||
    "Team 2"
  );

  const scores = Array.isArray(match?.score)
    ? match.score
    : [];

  const scoreList = scores.map((item, index) => {
    const scoreText =
      item?.r !== undefined
        ? `${item.r}/${item.w ?? 0}${item.o !== undefined ? ` (${item.o} ov)` : ""}`
        : String(item?.inning || "");

    return {
      index,
      inning: item?.inning || "",
      runs: item?.r ?? null,
      wickets: item?.w ?? null,
      overs: item?.o ?? null,
      score: scoreText
    };
  });

  const battingIndex = findBattingTeamIndex(match);

  return {
    id: match?.id || "",
    name: match?.name || `${team1} vs ${team2}`,
    matchType: match?.matchType || "",
    status: getStatus(match),
    rawStatus: match?.status || "",
    venue: match?.venue || "",
    date: match?.date || "",
    dateTimeGMT: match?.dateTimeGMT || "",
    series: match?.series_id || match?.series || "",
    teams: [team1, team2],
    teamInfo: teamInfo.map(item => ({
      name: item?.name || "",
      shortname: item?.shortname || "",
      img: item?.img || ""
    })),
    score: scoreList,
    currentInnings:
      scoreList[battingIndex] ||
      scoreList[scoreList.length - 1] ||
      null,
    tossWinner: match?.tossWinner || "",
    tossChoice: match?.tossChoice || "",
    result: match?.status || "",
    description: match?.status || "",
    raw: match
  };
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const order = {
      LIVE: 0,
      UPCOMING: 1,
      RESULT: 2
    };

    const statusA = order[a.status] ?? 9;
    const statusB = order[b.status] ?? 9;

    if (statusA !== statusB) {
      return statusA - statusB;
    }

    const dateA = new Date(a.dateTimeGMT || a.date || 0).getTime();
    const dateB = new Date(b.dateTimeGMT || b.date || 0).getTime();

    return dateA - dateB;
  });
}

async function getAllCricketMatches(env) {
  const apiKey = env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error("CRICKET_API_KEY is not configured");
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Cricket API HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (data?.status === "failure") {
    throw new Error(
      data?.reason ||
      data?.message ||
      "Cricket API returned failure"
    );
  }

  const rawMatches =
    Array.isArray(data?.data)
      ? data.data
      : [];

  const matches = rawMatches.map(formatCricScoreMatch);

  return sortMatches(matches);
}

async function getCricketScores(env) {
  const matches = await getAllCricketMatches(env);

  return matches.filter(
    match => match.status === "LIVE"
  );
}

async function getFixtures(env) {
  return getAllCricketMatches(env);
}

async function getMatchDetail(env, endpoint, matchId) {
  const apiKey = env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error("CRICKET_API_KEY is not configured");
  }

  if (!matchId) {
    throw new Error("Match ID is required");
  }

  const url =
    `https://api.cricapi.com/v1/${endpoint}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&offset=0` +
    `&id=${encodeURIComponent(matchId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Cricket API HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (data?.status === "failure") {
    throw new Error(
      data?.reason ||
      data?.message ||
      "Cricket API returned failure"
    );
  }

  return data;
}

function buildAIImagePrompt(body) {
  const player =
    body.player ||
    body.playerName ||
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
    body.imageStyle ||
    "Realistic";

  const jersey =
    body.jersey ||
    body.jerseyColor ||
    "Blue";

  const number =
    body.number ||
    body.jerseyNumber ||
    "18";

  const stadium =
    body.stadium ||
    "International Stadium";

  const weather =
    body.weather ||
    "Clear";

  const matchTime =
    body.matchTime ||
    "Day";

  const camera =
    body.camera ||
    body.cameraAngle ||
    "Front";

  const tournament =
    body.tournament ||
    "T20 World Cup";

  const customPrompt =
    body.customPrompt ||
    "";

  let prompt = `
Create a photorealistic cinematic cricket sports image.

Player: ${player}
Team: ${team}
Playing role: ${type}
Batting hand: ${hand}
Pose: ${pose}
Jersey color: ${jersey}
Jersey number: ${number}
Stadium: ${stadium}
Weather: ${weather}
Match time: ${matchTime}
Camera angle: ${camera}
Tournament: ${tournament}

Visual requirements:
- professional international cricket player appearance
- realistic cricket uniform
- realistic cricket bat and protective equipment where appropriate
- dramatic stadium atmosphere
- realistic floodlights and crowd
- cinematic sports photography
- natural skin texture
- realistic face
- sharp subject
- high detail
- dynamic action
- premium sports poster quality
- no text
- no logos added artificially
- no watermark
`;

  if (customPrompt) {
    prompt += `
Additional user instructions:
${customPrompt}
`;
  }

  return prompt.trim();
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function generateAIImage(env, body) {
  if (!env.AI) {
    throw new Error("Workers AI binding is not configured");
  }

  const prompt = buildAIImagePrompt(body);

  const result = await env.AI.run(AI_MODEL, {
    prompt
  });

  if (!result) {
    throw new Error("Workers AI returned an empty response");
  }

  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }

  if (result instanceof Uint8Array) {
    return result;
  }

  if (result?.image) {
    return base64ToUint8Array(result.image);
  }

  if (result?.data?.image) {
    return base64ToUint8Array(result.data.image);
  }

  throw new Error("Workers AI image response was not recognized");
}

function errorMessage(error) {
  if (!error) return "Unknown error";

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    try {
      // --------------------------------------------------------
      // HEALTH
      // --------------------------------------------------------
      if (
        pathname === "/api/health" &&
        request.method === "GET"
      ) {
        return jsonResponse({
          success: true,
          app: "Cricket Short",
          worker: "cricket-ai-app",
          workersAI: Boolean(env.AI),
          cricketApiKey: Boolean(env.CRICKET_API_KEY),
          assets: Boolean(env.ASSETS),
          endpoints: [
            "/api/generate",
            "/api/generate-image",
            "/api/score",
            "/api/live-score",
            "/api/fixtures",
            "/api/scorecard",
            "/api/ball-by-ball",
            "/api/match-points",
            "/api/health"
          ]
        });
      }

      // --------------------------------------------------------
      // LIVE SCORE
      // --------------------------------------------------------
      if (
        pathname === "/api/live-score" &&
        request.method === "GET"
      ) {
        const matches = await getCricketScores(env);

        return jsonResponse({
          success: true,
          count: matches.length,
          matches,
          data: matches,
          lastUpdated: new Date().toISOString()
        });
      }

      // --------------------------------------------------------
      // FIXTURES
      // --------------------------------------------------------
      if (
        pathname === "/api/fixtures" &&
        request.method === "GET"
      ) {
        const matches = await getFixtures(env);

        return jsonResponse({
          success: true,
          count: matches.length,
          matches,
          data: matches,
          lastUpdated: new Date().toISOString()
        });
      }

      // --------------------------------------------------------
      // SCORECARD
      // --------------------------------------------------------
      if (
        pathname === "/api/scorecard" &&
        request.method === "GET"
      ) {
        const matchId = url.searchParams.get("id");

        if (!matchId) {
          return jsonResponse(
            {
              success: false,
              error: "Match ID is required"
            },
            400
          );
        }

        const data = await getMatchDetail(
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

      // --------------------------------------------------------
      // MATCH POINTS
      // --------------------------------------------------------
      if (
        pathname === "/api/match-points" &&
        request.method === "GET"
      ) {
        const matchId = url.searchParams.get("id");

        if (!matchId) {
          return jsonResponse(
            {
              success: false,
              error: "Match ID is required"
            },
            400
          );
        }

        const data = await getMatchDetail(
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

      // --------------------------------------------------------
      // BALL BY BALL
      // --------------------------------------------------------
      // Intentionally kept safe until the exact Cricket API
      // ball-by-ball endpoint is confirmed.
      if (
        pathname === "/api/ball-by-ball" &&
        request.method === "GET"
      ) {
        const matchId = url.searchParams.get("id");

        return jsonResponse(
          {
            success: false,
            configured: false,
            matchId: matchId || "",
            error: "BALL_BY_BALL_ENDPOINT_NOT_CONFIGURED",
            message:
              "Ball-by-ball API endpoint is not configured yet."
          },
          501
        );
      }

      // --------------------------------------------------------
      // AI IMAGE GENERATION
      // --------------------------------------------------------
      if (
        pathname === "/api/generate-image" &&
        request.method === "POST"
      ) {
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Invalid JSON request body"
            },
            400
          );
        }

        const imageBytes =
          await generateAIImage(env, body || {});

        return new Response(imageBytes, {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "image/jpeg",
            "Content-Disposition":
              "inline; filename=\"cricket-short-ai.jpg\""
          }
        });
      }

      // --------------------------------------------------------
      // AI GENERATE COMPATIBILITY ROUTE
      // --------------------------------------------------------
      if (
        pathname === "/api/generate" &&
        request.method === "POST"
      ) {
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Invalid JSON request body"
            },
            400
          );
        }

        const imageBytes =
          await generateAIImage(env, body || {});

        return new Response(imageBytes, {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "image/jpeg",
            "Content-Disposition":
              "inline; filename=\"cricket-short-ai.jpg\""
          }
        });
      }

      // --------------------------------------------------------
      // SCORE COMPATIBILITY ROUTE
      // --------------------------------------------------------
      if (
        pathname === "/api/score" &&
        request.method === "GET"
      ) {
        const matches = await getCricketScores(env);

        return jsonResponse({
          success: true,
          count: matches.length,
          matches,
          data: matches,
          lastUpdated: new Date().toISOString()
        });
      }

      // --------------------------------------------------------
      // STATIC ASSETS
      // --------------------------------------------------------
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      // --------------------------------------------------------
      // ROOT
      // --------------------------------------------------------
      if (pathname === "/" && request.method === "GET") {
        return new Response(
          "Cricket Short Worker is running.",
          {
            status: 200,
            headers: {
              ...corsHeaders(),
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }

      // --------------------------------------------------------
      // 404
      // --------------------------------------------------------
      return jsonResponse(
        {
          success: false,
          error: "Not Found",
          path: pathname
        },
        404
      );

    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error: errorMessage(error)
        },
        500
      );
    }
  }
};
// Production deployment trigger 2026-10-03
