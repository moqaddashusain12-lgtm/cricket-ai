// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// Live Score + CricketLiveApi Backup + AI Image + Assets
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CRICKET_API_URL =
  "https://api.cricapi.com/v1/cricScore";

const CRICKET_LIVE_API_URL =
  "https://cricketliveapi.com/api/v1/cricket/live";

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
    ...extra,
  };
}

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders(extra),
      },
    }
  );
}

// ============================================================
// BASIC HELPERS
// ============================================================

function cleanTeamName(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    return (
      value.name ||
      value.shortName ||
      value.short_name ||
      value.teamName ||
      value.team_name ||
      value.title ||
      value.code ||
      ""
    );
  }

  return String(value).trim();
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    return value !== 0;
  }

  const s = String(value || "").toLowerCase().trim();

  return [
    "true",
    "1",
    "yes",
    "live",
    "started",
  ].includes(s);
}

// ============================================================
// TEAM NAME EXTRACTION
// ============================================================

function getTeamName(team) {
  if (!team) return "";

  if (typeof team === "string") {
    return team.trim();
  }

  return cleanTeamName(
    team.name ||
    team.shortName ||
    team.short_name ||
    team.teamName ||
    team.team_name ||
    team.title ||
    team.code ||
    team.id ||
    ""
  );
}

function extractTeams(match) {
  let team1 = "";
  let team2 = "";

  // CricketLiveApi documented format
  if (match) {
    team1 = getTeamName(
      match.team1 ||
      match.team_1 ||
      match.home_team ||
      match.homeTeam
    );

    team2 = getTeamName(
      match.team2 ||
      match.team_2 ||
      match.away_team ||
      match.awayTeam
    );
  }

  // teams as array
  if (
    (!team1 || !team2) &&
    Array.isArray(match?.teams)
  ) {
    team1 = team1 || getTeamName(match.teams[0]);
    team2 = team2 || getTeamName(match.teams[1]);
  }

  // teams as string: "India vs West Indies"
  if (
    (!team1 || !team2) &&
    typeof match?.teams === "string"
  ) {
    const parts = match.teams
      .split(/\s+vs\.?\s+|\s+v\.?\s+|\s+-\s+/i)
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      team1 = team1 || parts[0];
      team2 = team2 || parts[1];
    }
  }

  // name / title fallback
  if (
    (!team1 || !team2) &&
    typeof match?.name === "string"
  ) {
    const parts = match.name
      .split(/\s+vs\.?\s+|\s+v\.?\s+|\s+-\s+/i)
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      team1 = team1 || parts[0];
      team2 = team2 || parts[1];
    }
  }

  return {
    team1: team1 || "Team 1",
    team2: team2 || "Team 2",
  };
}

// ============================================================
// VENUE
// ============================================================

function extractVenue(match) {
  if (!match) return "Venue unavailable";

  const venue =
    match.venue ||
    match.venueName ||
    match.venue_name ||
    match.ground ||
    match.stadium ||
    match.location ||
    match.venueInfo ||
    "";

  if (typeof venue === "string" && venue.trim()) {
    return venue.trim();
  }

  if (typeof venue === "object") {
    return (
      venue.name ||
      venue.venue ||
      venue.ground ||
      venue.stadium ||
      venue.location ||
      "Venue unavailable"
    );
  }

  return "Venue unavailable";
}

// ============================================================
// SCORE PARSING
// ============================================================

function parseScore(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return parseScoreObject(value);
  }

  const text = String(value).trim();

  if (!text) return null;

  // Example:
  // India 141/2 (23.6 ov)
  // 141/2 (23.6 ov)
  const match = text.match(
    /(\d+)\s*\/\s*(\d+)(?:\s*\(([\d.]+)\s*ov(?:ers?)?\))?/i
  );

  if (match) {
    return {
      runs: Number(match[1]),
      wickets: Number(match[2]),
      overs: match[3] || "",
      text,
    };
  }

  return {
    runs: null,
    wickets: null,
    overs: "",
    text,
  };
}

function parseScoreObject(obj) {
  if (!obj || typeof obj !== "object") return null;

  const runs =
    obj.runs ??
    obj.run ??
    obj.score ??
    obj.r ??
    null;

  const wickets =
    obj.wickets ??
    obj.wicket ??
    obj.w ??
    obj.wkts ??
    null;

  const overs =
    obj.overs ??
    obj.over ??
    obj.o ??
    "";

  if (
    runs !== null &&
    wickets !== null
  ) {
    return {
      runs: Number(runs),
      wickets: Number(wickets),
      overs: String(overs || ""),
      text:
        `${runs}/${wickets}` +
        (overs ? ` (${overs} ov)` : ""),
    };
  }

  return parseScore(
    obj.score ||
    obj.scoreText ||
    obj.score_text ||
    ""
  );
}

// ============================================================
// SCORE EXTRACTION
// ============================================================

function extractScores(match) {
  if (!match) return [];

  const result = [];

  // ----------------------------------------------------------
  // CricketLiveApi primary documented "score"
  // ----------------------------------------------------------

  if (match.score) {
    if (Array.isArray(match.score)) {
      for (const item of match.score) {
        const parsed = parseScore(item);

        if (parsed) {
          result.push({
            team: "",
            ...parsed,
          });
        }
      }
    } else if (typeof match.score === "object") {
      // score may be:
      // { team1: "...", team2: "..." }
      const scoreObj = match.score;

      const team1Score =
        scoreObj.team1 ||
        scoreObj.team_1 ||
        scoreObj.home ||
        scoreObj.homeTeam ||
        scoreObj[match.team1];

      const team2Score =
        scoreObj.team2 ||
        scoreObj.team_2 ||
        scoreObj.away ||
        scoreObj.awayTeam ||
        scoreObj[match.team2];

      if (team1Score) {
        const parsed = parseScore(team1Score);

        if (parsed) {
          result.push({
            team: cleanTeamName(match.team1),
            ...parsed,
          });
        }
      }

      if (team2Score) {
        const parsed = parseScore(team2Score);

        if (parsed) {
          result.push({
            team: cleanTeamName(match.team2),
            ...parsed,
          });
        }
      }

      // If score itself looks like one score object
      if (!result.length) {
        const parsed = parseScore(scoreObj);

        if (parsed) {
          result.push({
            team: "",
            ...parsed,
          });
        }
      }
    } else {
      const parsed = parseScore(match.score);

      if (parsed) {
        result.push({
          team: cleanTeamName(match.team1),
          ...parsed,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // Other common score fields
  // ----------------------------------------------------------

  const possibleArrays = [
    match.scores,
    match.scorecard,
    match.innings,
    match.inningsScores,
    match.innings_scores,
  ];

  for (const arr of possibleArrays) {
    if (!Array.isArray(arr)) continue;

    for (const item of arr) {
      const parsed = parseScore(item);

      if (parsed) {
        result.push({
          team:
            cleanTeamName(
              item.team ||
              item.teamName ||
              item.team_name ||
              item.battingTeam ||
              ""
            ),
          ...parsed,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // team1Score / team2Score
  // ----------------------------------------------------------

  const t1 = parseScore(
    match.team1Score ||
    match.team1_score ||
    match.homeScore ||
    match.home_score ||
    ""
  );

  if (t1) {
    result.push({
      team: cleanTeamName(match.team1),
      ...t1,
    });
  }

  const t2 = parseScore(
    match.team2Score ||
    match.team2_score ||
    match.awayScore ||
    match.away_score ||
    ""
  );

  if (t2) {
    result.push({
      team: cleanTeamName(match.team2),
      ...t2,
    });
  }

  return result;
}

// ============================================================
// CURRENT SCORE
// ============================================================

function findCurrentScore(scores) {
  if (!Array.isArray(scores) || !scores.length) {
    return null;
  }

  return scores[scores.length - 1];
}

// ============================================================
// STATUS
// ============================================================

function getStatus(match) {
  const raw = String(
    match?.status ||
    match?.state ||
    match?.matchStatus ||
    match?.match_status ||
    match?.ms ||
    ""
  ).toLowerCase();

  if (
    raw.includes("live") ||
    raw.includes("in progress") ||
    raw.includes("playing") ||
    raw.includes("started")
  ) {
    return "LIVE";
  }

  if (
    raw.includes("result") ||
    raw.includes("finished") ||
    raw.includes("completed") ||
    raw.includes("won")
  ) {
    return "RESULT";
  }

  if (
    raw.includes("upcoming") ||
    raw.includes("fixture") ||
    raw.includes("scheduled")
  ) {
    return "UPCOMING";
  }

  if (
    toBoolean(match?.matchStarted) &&
    !toBoolean(match?.matchEnded)
  ) {
    return "LIVE";
  }

  if (toBoolean(match?.matchEnded)) {
    return "RESULT";
  }

  return "UPCOMING";
}

// ============================================================
// FORMAT CRICAPI MATCH
// ============================================================

function formatCricScoreMatch(match) {
  const teams = extractTeams(match);
  const scores = extractScores(match);

  return {
    id:
      match?.id ||
      match?.matchId ||
      match?.match_id ||
      "",

    team1: teams.team1,
    team2: teams.team2,

    teams: `${teams.team1} vs ${teams.team2}`,

    format:
      match?.matchType ||
      match?.format ||
      match?.type ||
      "CRICKET",

    series:
      match?.series ||
      match?.seriesName ||
      match?.name ||
      "",

    status: getStatus(match),

    venue: extractVenue(match),

    scores,

    currentScore: findCurrentScore(scores),

    raw: match,
  };
}

// ============================================================
// CRICAPI PRIMARY
// ============================================================

async function getAllCricketMatches(env) {
  if (!env.CRICKET_API_KEY) {
    throw new Error("CRICKET_API_KEY missing");
  }

  const url =
    `${CRICKET_API_URL}?apikey=` +
    encodeURIComponent(env.CRICKET_API_KEY);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Cricket API HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Cricket API returned invalid JSON");
  }

  const matches =
    data?.data ||
    data?.matches ||
    data?.results ||
    [];

  if (!Array.isArray(matches)) {
    return [];
  }

  return matches.map(formatCricScoreMatch);
}

// ============================================================
// CRICKETLIVEAPI BACKUP
// ============================================================

function formatCricketLiveApiMatch(match) {
  const teams = extractTeams(match);

  const scores = extractScores(match);

  // If API gives one simple score string,
  // attach it to team1.
  if (
    !scores.length &&
    match?.score
  ) {
    const parsed = parseScore(match.score);

    if (parsed) {
      scores.push({
        team: teams.team1,
        ...parsed,
      });
    }
  }

  const status = getStatus(match);

  const format =
    match?.format ||
    match?.matchType ||
    match?.match_type ||
    match?.type ||
    "CRICKET";

  const series =
    match?.series ||
    match?.seriesName ||
    match?.series_name ||
    "";

  const venue = extractVenue(match);

  const id =
    match?.match_id ||
    match?.matchId ||
    match?.id ||
    "";

  return {
    id: String(id),

    team1: teams.team1,
    team2: teams.team2,

    teams:
      `${teams.team1} vs ${teams.team2}`,

    format: String(format),

    series: String(series),

    status,

    venue,

    scores,

    currentScore:
      findCurrentScore(scores),

    // Extra fields for frontend
    score:
      match?.score ||
      match?.scores ||
      "",

    lastBall:
      match?.last_ball ||
      match?.lastBall ||
      "",

    raw: match,
  };
}

async function getCricketLiveApiMatches(env) {
  if (!env.CRICKET_LIVE_API_TOKEN) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN missing"
    );
  }

  const response = await fetch(
    CRICKET_LIVE_API_URL,
    {
      method: "GET",

      headers: {
        "Accept": "application/json",
        "Authorization":
          `Bearer ${env.CRICKET_LIVE_API_TOKEN}`,
      },
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `CricketLiveApi HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "CricketLiveApi returned invalid JSON"
    );
  }

  const matches =
    data?.data ||
    data?.matches ||
    data?.results ||
    data?.match ||
    [];

  let list = [];

  if (Array.isArray(matches)) {
    list = matches;
  } else if (
    matches &&
    typeof matches === "object"
  ) {
    list = [matches];
  }

  return list.map(
    formatCricketLiveApiMatch
  );
}

// ============================================================
// LIVE SCORE WITH AUTOMATIC FALLBACK
// ============================================================

async function getCricketScores(env) {
  let primaryError = null;

  // ----------------------------------------------------------
  // 1. PRIMARY API
  // ----------------------------------------------------------

  try {
    const primary =
      await getAllCricketMatches(env);

    const livePrimary =
      primary.filter(
        m => m.status === "LIVE"
      );

    if (livePrimary.length) {
      return livePrimary;
    }
  } catch (error) {
    primaryError = error;
  }

  // ----------------------------------------------------------
  // 2. BACKUP API
  // ----------------------------------------------------------

  try {
    const backup =
      await getCricketLiveApiMatches(env);

    const liveBackup =
      backup.filter(
        m => m.status === "LIVE"
      );

    if (liveBackup.length) {
      return liveBackup;
    }

    // If backup returns matches but
    // status field is different, still return
    // the available matches.
    if (backup.length) {
      return backup;
    }

    throw new Error(
      "CricketLiveApi returned no matches"
    );
  } catch (backupError) {
    throw new Error(
      `Live score failed. Primary: ${
        primaryError?.message || "no live matches"
      } | Backup: ${
        backupError?.message || "failed"
      }`
    );
  }
}

// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {
  const matches =
    await getAllCricketMatches(env);

  return matches
    .sort((a, b) => {
      const sa =
        a.status === "LIVE" ? 0 :
        a.status === "UPCOMING" ? 1 : 2;

      const sb =
        b.status === "LIVE" ? 0 :
        b.status === "UPCOMING" ? 1 : 2;

      return sa - sb;
    });
}

// ============================================================
// MATCH DETAIL
// ============================================================

async function getMatchDetail(env, id) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  if (!env.CRICKET_API_KEY) {
    throw new Error(
      "CRICKET_API_KEY missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=` +
    encodeURIComponent(env.CRICKET_API_KEY) +
    `&id=` +
    encodeURIComponent(id);

  const response =
    await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Cricket API HTTP ${response.status}: ${text.slice(0, 1200)}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Cricket API returned invalid JSON"
    );
  }

  return data;
}

// ============================================================
// AI PROMPT
// ============================================================

function buildImagePrompt(body) {
  const {
    playerName = "Virat Kohli",
    team = "India",
    pose = "Batting",
    playerType = "Batsman",
    hand = "Right",
    imageStyle = "Realistic",
    jersey = "Blue",
    number = "18",
    stadium = "International",
    weather = "Clear",
    matchTime = "Day",
    camera = "Front",
    tournament = "T20 World Cup",
  } = body || {};

  return `
Photorealistic professional cricket sports image.

Cricketer:
${playerName}

Team:
${team}

Player type:
${playerType}

Pose:
${pose}

Batting hand:
${hand}

Jersey:
${jersey}

Jersey number:
${number}

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
${imageStyle}

Create a realistic professional cricket photograph.
Authentic cricket stadium.
Professional cricket uniform.
Natural human anatomy.
Realistic face.
Detailed cricket bat and equipment.
Dramatic stadium lighting.
Energetic crowd in background.
High detail.
Sports photography.
Cinematic composition.
No text.
No watermark.
`;
}

// ============================================================
// BASE64
// ============================================================

function arrayBufferToBase64(buffer) {
  const bytes =
    new Uint8Array(buffer);

  const chunkSize = 0x8000;

  let binary = "";

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length
        )
      )
    );
  }

  return btoa(binary);
}

// ============================================================
// AI IMAGE
// ============================================================

async function generateImage(env, body) {
  if (!env.AI) {
    throw new Error(
      "Workers AI binding missing"
    );
  }

  const prompt =
    buildImagePrompt(body);

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt,
        num_steps: 4,
      }
    );

  if (!result) {
    throw new Error(
      "AI returned empty result"
    );
  }

  // Cloudflare AI may return image bytes
  if (
    result instanceof ArrayBuffer
  ) {
    return {
      image:
        arrayBufferToBase64(result),
      mimeType:
        "image/png",
    };
  }

  if (
    result?.image
  ) {
    return {
      image:
        result.image,
      mimeType:
        "image/png",
    };
  }

  if (
    result?.arrayBuffer
  ) {
    const buffer =
      await result.arrayBuffer();

    return {
      image:
        arrayBufferToBase64(buffer),
      mimeType:
        "image/png",
    };
  }

  throw new Error(
    "AI image format not supported"
  );
}

// ============================================================
// REQUEST BODY
// ============================================================

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ============================================================
// HEALTH
// ============================================================

function health(env) {
  return jsonResponse({
    success: true,
    app: "Cricket Short",
    worker: "cricket-ai-app",

    workersAI:
      Boolean(env.AI),

    cricketApiKey:
      Boolean(env.CRICKET_API_KEY),

    cricketLiveApiToken:
      Boolean(
        env.CRICKET_LIVE_API_TOKEN
      ),

    assets:
      Boolean(env.ASSETS),

    endpoints: [
      "/api/generate",
      "/api/generate-image",
      "/api/score",
      "/api/live-score",
      "/api/fixtures",
      "/api/scorecard",
      "/api/ball-by-ball",
      "/api/match-points",
      "/api/health",
    ],
  });
}

// ============================================================
// MAIN FETCH
// ============================================================

export default {
  async fetch(request, env) {
    try {
      // ------------------------------------------------------
      // OPTIONS
      // ------------------------------------------------------

      if (request.method === "OPTIONS") {
        return new Response(
          null,
          {
            status: 204,
            headers: corsHeaders(),
          }
        );
      }

      const url =
        new URL(request.url);

      const path =
        url.pathname;

      // ------------------------------------------------------
      // HEALTH
      // ------------------------------------------------------

      if (
        path === "/api/health"
      ) {
        return health(env);
      }

      // ------------------------------------------------------
      // LIVE SCORE
      // ------------------------------------------------------

      if (
        path === "/api/live-score" ||
        path === "/api/score"
      ) {
        const matches =
          await getCricketScores(env);

        return jsonResponse({
          success: true,
          data: matches,
          matches,
          count: matches.length,
          timestamp:
            new Date().toISOString(),
        });
      }

      // ------------------------------------------------------
      // FIXTURES
      // ------------------------------------------------------

      if (
        path === "/api/fixtures"
      ) {
        const matches =
          await getFixtures(env);

        return jsonResponse({
          success: true,
          data: matches,
          matches,
          count: matches.length,
        });
      }

      // ------------------------------------------------------
      // SCORECARD
      // ------------------------------------------------------

      if (
        path === "/api/scorecard"
      ) {
        const id =
          url.searchParams.get("id");

        if (!id) {
          return jsonResponse(
            {
              success: false,
              error:
                "Match ID is required",
            },
            400
          );
        }

        // CricAPI requires its GUID-style
        // match ID, not a short numeric ID.
        if (
          !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            .test(id)
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Invalid Match ID. Please use the full CricAPI Match ID.",
            },
            400
          );
        }

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data,
        });
      }

      // ------------------------------------------------------
      // BALL BY BALL
      // ------------------------------------------------------

      if (
        path === "/api/ball-by-ball"
      ) {
        const id =
          url.searchParams.get("id");

        if (!id) {
          return jsonResponse(
            {
              success: false,
              error:
                "Match ID is required",
            },
            400
          );
        }

        if (
          !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            .test(id)
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Invalid Match ID. Please use the full CricAPI Match ID.",
            },
            400
          );
        }

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data,
        });
      }

      // ------------------------------------------------------
      // MATCH POINTS
      // ------------------------------------------------------

      if (
        path === "/api/match-points"
      ) {
        const id =
          url.searchParams.get("id");

        if (!id) {
          return jsonResponse(
            {
              success: false,
              error:
                "Match ID is required",
            },
            400
          );
        }

        if (
          !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            .test(id)
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Invalid Match ID. Please use the full CricAPI Match ID.",
            },
            400
          );
        }

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data,
        });
      }

      // ------------------------------------------------------
      // AI IMAGE
      // ------------------------------------------------------

      if (
        path === "/api/generate-image" ||
        path === "/api/generate"
      ) {
        if (
          request.method !== "POST"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "POST required",
            },
            405
          );
        }

        const body =
          await readJson(request);

        const result =
          await generateImage(
            env,
            body
          );

        return jsonResponse({
          success: true,
          image:
            result.image,
          mimeType:
            result.mimeType,
        });
      }

      // ------------------------------------------------------
      // STATIC ASSETS
      // ------------------------------------------------------

      if (env.ASSETS) {
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

      // ------------------------------------------------------
      // ROOT
      // ------------------------------------------------------

      if (path === "/") {
        return new Response(
          `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Cricket Short</title>
</head>
<body>
<h2>🏏 Cricket Short</h2>
<p>AI Cricket • Live Score • Cricket Tools</p>
</body>
</html>
          `,
          {
            headers: {
              "Content-Type":
                "text/html; charset=utf-8",
              ...corsHeaders(),
            },
          }
        );
      }

      return jsonResponse(
        {
          success: false,
          error: "Not Found",
        },
        404
      );

    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error:
            error?.message ||
            String(error),
        },
        500
      );
    }
  },
};
