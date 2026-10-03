// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// Live Score + Backup API + Fixtures + Scorecard
// Ball-by-Ball + Points + AI Image Generator
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}


// ============================================================
// SAFE TEXT
// ============================================================

function cleanText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}


// ============================================================
// TEAM NAME EXTRACTOR
// ============================================================

function getTeamName(team) {

  if (!team) return "";

  if (typeof team === "string") {
    return team.trim();
  }

  if (typeof team === "object") {

    const possible = [
      team.name,
      team.teamName,
      team.team_name,
      team.title,
      team.shortName,
      team.short_name,
      team.code,
      team.abbreviation,
      team.abbr,
      team.country,
      team.nationality
    ];

    for (const item of possible) {
      const value = cleanText(item);
      if (value) return value;
    }
  }

  return "";
}


// ============================================================
// TEAM EXTRACTION
// ============================================================

function extractTeams(match) {

  let team1 = "";
  let team2 = "";

  // --------------------------------------------
  // Direct documented fields
  // --------------------------------------------

  team1 = getTeamName(match?.team1);
  team2 = getTeamName(match?.team2);

  // --------------------------------------------
  // Alternate fields
  // --------------------------------------------

  if (!team1) team1 = getTeamName(match?.team_1);
  if (!team2) team2 = getTeamName(match?.team_2);

  if (!team1) team1 = getTeamName(match?.homeTeam);
  if (!team2) team2 = getTeamName(match?.awayTeam);

  if (!team1) team1 = getTeamName(match?.home_team);
  if (!team2) team2 = getTeamName(match?.away_team);

  if (!team1) team1 = getTeamName(match?.teamA);
  if (!team2) team2 = getTeamName(match?.teamB);

  if (!team1) team1 = getTeamName(match?.team_a);
  if (!team2) team2 = getTeamName(match?.team_b);

  // --------------------------------------------
  // Teams array
  // --------------------------------------------

  if ((!team1 || !team2) && Array.isArray(match?.teams)) {

    const teams = match.teams;

    if (!team1 && teams[0]) {
      team1 = getTeamName(teams[0]);
    }

    if (!team2 && teams[1]) {
      team2 = getTeamName(teams[1]);
    }
  }

  // --------------------------------------------
  // Teams object
  // --------------------------------------------

  if ((!team1 || !team2) && match?.teams && typeof match.teams === "object") {

    const teams = match.teams;

    if (!team1) {
      team1 =
        getTeamName(teams.team1) ||
        getTeamName(teams.home) ||
        getTeamName(teams.a);
    }

    if (!team2) {
      team2 =
        getTeamName(teams.team2) ||
        getTeamName(teams.away) ||
        getTeamName(teams.b);
    }
  }

  // --------------------------------------------
  // Name strings such as "India vs West Indies"
  // --------------------------------------------

  if ((!team1 || !team2) && typeof match?.name === "string") {

    const parts = match.name
      .split(/\s+vs\.?\s+|\s+v\s+/i)
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      if (!team1) team1 = parts[0];
      if (!team2) team2 = parts[1];
    }
  }

  if ((!team1 || !team2) && typeof match?.match === "string") {

    const parts = match.match
      .split(/\s+vs\.?\s+|\s+v\s+/i)
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      if (!team1) team1 = parts[0];
      if (!team2) team2 = parts[1];
    }
  }

  return {
    team1: team1 || "Team 1",
    team2: team2 || "Team 2"
  };
}


// ============================================================
// SCORE PARSER
// ============================================================

function parseScore(value) {

  if (value === null || value === undefined) {
    return null;
  }

  // --------------------------------------------
  // String
  // --------------------------------------------

  if (typeof value === "string") {

    const text = value.trim();

    if (!text) return null;

    // Examples:
    // 141/2 (23.6 ov)
    // 300/2
    // 295/7 (50 ov)

    const match = text.match(
      /(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]*)\))?/i
    );

    if (match) {

      return {
        runs: Number(match[1]),
        wickets: Number(match[2]),
        overs: match[3] ? match[3].trim() : ""
      };
    }

    // Score without wickets
    const runsOnly = text.match(/(\d+)/);

    if (runsOnly) {
      return {
        runs: Number(runsOnly[1]),
        wickets: null,
        overs: ""
      };
    }

    return null;
  }

  // --------------------------------------------
  // Number
  // --------------------------------------------

  if (typeof value === "number") {

    return {
      runs: value,
      wickets: null,
      overs: ""
    };
  }

  // --------------------------------------------
  // Object
  // --------------------------------------------

  if (typeof value === "object") {

    const runs =
      value.runs ??
      value.run ??
      value.score ??
      value.total ??
      value.r;

    const wickets =
      value.wickets ??
      value.wicket ??
      value.w ??
      value.wkts;

    const overs =
      value.overs ??
      value.over ??
      value.ov;

    if (
      runs !== undefined ||
      wickets !== undefined ||
      overs !== undefined
    ) {

      return {
        runs:
          runs !== undefined && runs !== null
            ? Number(runs)
            : null,

        wickets:
          wickets !== undefined && wickets !== null
            ? Number(wickets)
            : null,

        overs:
          overs !== undefined && overs !== null
            ? String(overs)
            : ""
      };
    }

    // Nested score
    if (value.score) {
      return parseScore(value.score);
    }
  }

  return null;
}


// ============================================================
// SCORE EXTRACTION
// ============================================================

function extractScores(match) {

  const result = [];

  // --------------------------------------------
  // Most common CricketLiveApi field
  // --------------------------------------------

  if (match?.score !== undefined) {

    if (Array.isArray(match.score)) {

      for (const item of match.score) {

        const parsed = parseScore(item);

        if (parsed) {
          result.push(parsed);
        }
      }

    } else {

      const parsed = parseScore(match.score);

      if (parsed) {
        result.push(parsed);
      }
    }
  }

  // --------------------------------------------
  // Alternate score fields
  // --------------------------------------------

  const alternateFields = [
    match?.scores,
    match?.scorecard,
    match?.teamScores,
    match?.team_scores,
    match?.innings
  ];

  for (const field of alternateFields) {

    if (Array.isArray(field)) {

      for (const item of field) {

        const parsed = parseScore(item);

        if (parsed) {
          result.push(parsed);
        }
      }

    } else if (field) {

      const parsed = parseScore(field);

      if (parsed) {
        result.push(parsed);
      }
    }
  }

  // --------------------------------------------
  // Direct runs/wickets/overs
  // --------------------------------------------

  if (
    match?.runs !== undefined ||
    match?.wickets !== undefined ||
    match?.overs !== undefined
  ) {

    const parsed = parseScore({
      runs: match.runs,
      wickets: match.wickets,
      overs: match.overs
    });

    if (parsed) {
      result.push(parsed);
    }
  }

  // --------------------------------------------
  // Remove duplicates
  // --------------------------------------------

  const unique = [];

  for (const item of result) {

    const key =
      `${item.runs}|${item.wickets}|${item.overs}`;

    if (!unique.some(
      x => `${x.runs}|${x.wickets}|${x.overs}` === key
    )) {
      unique.push(item);
    }
  }

  return unique;
}


// ============================================================
// STATUS
// ============================================================

function getStatus(match) {

  const value = cleanText(
    match?.status ||
    match?.state ||
    match?.matchStatus ||
    match?.match_status ||
    match?.liveStatus ||
    match?.live_status
  );

  if (!value) {
    return "LIVE";
  }

  const lower = value.toLowerCase();

  if (
    lower.includes("live") ||
    lower.includes("in progress") ||
    lower.includes("playing") ||
    lower.includes("ongoing")
  ) {
    return "LIVE";
  }

  if (
    lower.includes("complete") ||
    lower.includes("finished") ||
    lower.includes("result") ||
    lower.includes("won") ||
    lower.includes("ended")
  ) {
    return value;
  }

  return value;
}


// ============================================================
// FORMAT
// ============================================================

function getFormat(match) {

  return cleanText(
    match?.format ||
    match?.type ||
    match?.matchType ||
    match?.match_type ||
    match?.fixtureType
  ) || "CRICKET";
}


// ============================================================
// VENUE
// ============================================================

function extractVenue(match) {

  if (typeof match?.venue === "string") {
    return match.venue;
  }

  if (match?.venue && typeof match.venue === "object") {

    return (
      cleanText(match.venue.name) ||
      cleanText(match.venue.venueName) ||
      cleanText(match.venue.title) ||
      ""
    );
  }

  return (
    cleanText(match?.ground) ||
    cleanText(match?.stadium) ||
    cleanText(match?.location) ||
    ""
  );
}


// ============================================================
// SERIES
// ============================================================

function extractSeries(match) {

  return (
    cleanText(match?.series) ||
    cleanText(match?.seriesName) ||
    cleanText(match?.series_name) ||
    cleanText(match?.tournament) ||
    cleanText(match?.competition) ||
    ""
  );
}


// ============================================================
// LAST BALL
// ============================================================

function extractLastBall(match) {

  return (
    cleanText(match?.last_ball) ||
    cleanText(match?.lastBall) ||
    cleanText(match?.lastball) ||
    cleanText(match?.commentary) ||
    ""
  );
}


// ============================================================
// FORMAT CRICKETLIVEAPI MATCH
// ============================================================

function formatCricketLiveApiMatch(match, index = 0) {

  const teams = extractTeams(match);
  const scores = extractScores(match);

  const score1 = scores[0] || null;
  const score2 = scores[1] || null;

  const id =
    cleanText(match?.id) ||
    cleanText(match?.matchId) ||
    cleanText(match?.match_id) ||
    `live-${index + 1}`;

  return {

    id,

    name:
      cleanText(match?.name) ||
      `${teams.team1} vs ${teams.team2}`,

    team1: teams.team1,
    team2: teams.team2,

    team1Score: score1
      ? formatScoreText(score1)
      : "-",

    team2Score: score2
      ? formatScoreText(score2)
      : "-",

    score: scores,

    status: getStatus(match),

    format: getFormat(match),

    venue: extractVenue(match),

    series: extractSeries(match),

    last_ball: extractLastBall(match),

    source: "CricketLiveApi"
  };
}


// ============================================================
// FORMAT SCORE TEXT
// ============================================================

function formatScoreText(score) {

  if (!score) return "-";

  let text = "";

  if (score.runs !== null && !Number.isNaN(score.runs)) {
    text += String(score.runs);
  }

  if (
    score.wickets !== null &&
    score.wickets !== undefined &&
    !Number.isNaN(score.wickets)
  ) {
    text += `/${score.wickets}`;
  }

  if (score.overs) {
    text += ` (${score.overs})`;
  }

  return text || "-";
}


// ============================================================
// CRICKETLIVEAPI FETCH
// ============================================================

async function getCricketLiveApiMatches(env) {

  const token = env.CRICKET_LIVE_API_TOKEN;

  if (!token) {
    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );
  }

  const response = await fetch(
    CRICKET_LIVE_API_URL,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `CricketLiveApi invalid JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {

    throw new Error(
      `CricketLiveApi HTTP ${response.status}: ${
        data?.message ||
        data?.error ||
        text.slice(0, 300)
      }`
    );
  }

  let matches = [];

  if (Array.isArray(data)) {
    matches = data;
  } else if (Array.isArray(data?.data)) {
    matches = data.data;
  } else if (Array.isArray(data?.matches)) {
    matches = data.matches;
  } else if (Array.isArray(data?.results)) {
    matches = data.results;
  } else if (data?.data && typeof data.data === "object") {
    matches = [data.data];
  }

  return matches
    .filter(Boolean)
    .map((match, index) =>
      formatCricketLiveApiMatch(match, index)
    );
}


// ============================================================
// CRICAPI MATCH FORMAT
// ============================================================

function formatCricScoreMatch(match, index = 0) {

  const teams = extractTeams(match);

  const scores = extractScores(match);

  const score1 = scores[0] || null;
  const score2 = scores[1] || null;

  return {

    id:
      cleanText(match?.id) ||
      cleanText(match?.matchId) ||
      `cric-${index + 1}`,

    name:
      cleanText(match?.name) ||
      `${teams.team1} vs ${teams.team2}`,

    team1: teams.team1,
    team2: teams.team2,

    team1Score:
      score1 ? formatScoreText(score1) : "-",

    team2Score:
      score2 ? formatScoreText(score2) : "-",

    score: scores,

    status: getStatus(match),

    format: getFormat(match),

    venue: extractVenue(match),

    series: extractSeries(match),

    last_ball: extractLastBall(match),

    source: "CricAPI"
  };
}


// ============================================================
// PRIMARY CRICAPI
// ============================================================

async function getCricketScores(env) {

  const key = env.CRICKET_API_KEY;

  if (!key) {
    throw new Error(
      "CRICKET_API_KEY secret is missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `CricAPI invalid JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {

    throw new Error(
      `CricAPI HTTP ${response.status}: ${
        data?.message ||
        data?.error ||
        text.slice(0, 300)
      }`
    );
  }

  if (
    data?.status === "failure" ||
    data?.success === false
  ) {

    throw new Error(
      data?.reason ||
      data?.message ||
      data?.error ||
      "CricAPI request failed"
    );
  }

  let matches = [];

  if (Array.isArray(data?.data)) {
    matches = data.data;
  } else if (Array.isArray(data?.matches)) {
    matches = data.matches;
  } else if (Array.isArray(data)) {
    matches = data;
  }

  return matches.map((match, index) =>
    formatCricScoreMatch(match, index)
  );
}


// ============================================================
// CHECK WHETHER MATCH IS LIVE
// ============================================================

function isLiveMatch(match) {

  const status = cleanText(match?.status).toLowerCase();

  if (
    status === "live" ||
    status.includes("live") ||
    status.includes("in progress") ||
    status.includes("playing") ||
    status.includes("ongoing")
  ) {
    return true;
  }

  return false;
}


// ============================================================
// ALL CRICKET MATCHES WITH AUTOMATIC BACKUP
// ============================================================

async function getAllCricketMatches(env) {

  let primaryMatches = [];
  let primaryError = "";

  // --------------------------------------------
  // PRIMARY
  // --------------------------------------------

  try {

    primaryMatches = await getCricketScores(env);

    const livePrimary =
      primaryMatches.filter(isLiveMatch);

    if (livePrimary.length > 0) {

      return {
        matches: livePrimary,
        source: "CricAPI",
        primaryError: null,
        backupUsed: false
      };
    }

  } catch (error) {

    primaryError = error?.message ||
      "Primary API failed";
  }


  // --------------------------------------------
  // BACKUP
  // --------------------------------------------

  try {

    const backupMatches =
      await getCricketLiveApiMatches(env);

    const liveBackup =
      backupMatches.filter(isLiveMatch);

    if (liveBackup.length > 0) {

      return {
        matches: liveBackup,
        source: "CricketLiveApi",
        primaryError: primaryError || null,
        backupUsed: true
      };
    }

    // Some APIs may not use the exact word LIVE.
    // If data exists, return it as fallback.

    if (backupMatches.length > 0) {

      return {
        matches: backupMatches,
        source: "CricketLiveApi",
        primaryError: primaryError || null,
        backupUsed: true
      };
    }

  } catch (backupError) {

    return {
      matches: [],
      source: "none",
      primaryError:
        primaryError ||
        "Primary API failed",

      backupError:
        backupError?.message ||
        "Backup API failed",

      backupUsed: true
    };
  }


  return {
    matches: primaryMatches,
    source: "CricAPI",
    primaryError: primaryError || null,
    backupUsed: false
  };
}


// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  // First try primary API.
  try {

    const key = env.CRICKET_API_KEY;

    if (key) {

      const url =
        `https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(key)}`;

      const response = await fetch(url);

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (response.ok && data) {

        const matches =
          Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.matches)
              ? data.matches
              : [];

        return matches.map((match, index) =>
          formatCricScoreMatch(match, index)
        );
      }
    }

  } catch {
    // Continue to backup/empty result.
  }

  // Backup API live matches can still be displayed.
  try {

    const backup =
      await getCricketLiveApiMatches(env);

    return backup;

  } catch {

    return [];
  }
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

  // CricAPI requires GUID style ID.
  const guidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (!guidPattern.test(id)) {

    throw new Error(
      "Invalid Match ID. Please use the full CricAPI Match ID."
    );
  }

  const key = env.CRICKET_API_KEY;

  if (!key) {

    throw new Error(
      "CRICKET_API_KEY secret is missing"
    );
  }

  const url =
    `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`;

  const response = await fetch(url);

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `CricAPI invalid JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {

    throw new Error(
      `Cricket API HTTP ${response.status}: ${
        data?.message ||
        data?.reason ||
        text.slice(0, 300)
      }`
    );
  }

  return data;
}


// ============================================================
// AI IMAGE PROMPT
// ============================================================

function buildImagePrompt(body) {

  const player =
    cleanText(body?.playerName) ||
    "Cricket Player";

  const team =
    cleanText(body?.team) ||
    "India";

  const pose =
    cleanText(body?.pose) ||
    "Batting";

  const type =
    cleanText(body?.type) ||
    "Batsman";

  const hand =
    cleanText(body?.hand) ||
    "Right";

  const style =
    cleanText(body?.style) ||
    "Realistic";

  const jersey =
    cleanText(body?.jersey) ||
    "Blue";

  const number =
    cleanText(body?.number) ||
    "18";

  const stadium =
    cleanText(body?.stadium) ||
    "International Stadium";

  const weather =
    cleanText(body?.weather) ||
    "Clear";

  const matchTime =
    cleanText(body?.matchTime) ||
    "Day";

  const camera =
    cleanText(body?.camera) ||
    "Front";

  const tournament =
    cleanText(body?.tournament) ||
    "T20 World Cup";

  return `
Photorealistic professional cricket sports photography.

Create a fictional cricket sports image inspired by the following specifications:

Player: ${player}
Team: ${team}
Playing type: ${type}
Playing hand: ${hand}
Pose: ${pose}
Jersey color: ${jersey}
Jersey number: ${number}
Stadium: ${stadium}
Weather: ${weather}
Match time: ${matchTime}
Camera angle: ${camera}
Tournament: ${tournament}
Visual style: ${style}

The player is standing or playing naturally on a professional cricket ground.
Realistic cricket equipment.
Realistic athletic body proportions.
Detailed cricket jersey and helmet where appropriate.
Dramatic professional stadium atmosphere.
Large cricket stadium.
Stadium floodlights where appropriate.
Energetic crowd in the background.
Cinematic sports photography.
Ultra realistic.
High detail.
Natural skin texture.
Sharp subject.
Professional sports-news image.
No text.
No logo.
No watermark.
`;
}


// ============================================================
// ARRAY BUFFER TO BASE64
// ============================================================

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


// ============================================================
// AI IMAGE GENERATION
// ============================================================

async function generateImage(env, body) {

  if (!env.AI) {

    throw new Error(
      "Workers AI binding is missing"
    );
  }

  const prompt =
    buildImagePrompt(body);

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt
      }
    );

  // Cloudflare AI can return image bytes directly.
  if (result instanceof ArrayBuffer) {

    return {
      image:
        `data:image/png;base64,${arrayBufferToBase64(result)}`,
      prompt
    };
  }

  // Handle typed array / buffer style result.
  if (
    result &&
    result.byteLength !== undefined
  ) {

    return {
      image:
        `data:image/png;base64,${arrayBufferToBase64(result)}`,
      prompt
    };
  }

  // Handle object response.
  if (result?.image) {

    if (typeof result.image === "string") {

      return {
        image:
          result.image.startsWith("data:")
            ? result.image
            : `data:image/png;base64,${result.image}`,
        prompt
      };
    }

    if (
      result.image instanceof ArrayBuffer
    ) {

      return {
        image:
          `data:image/png;base64,${arrayBufferToBase64(result.image)}`,
        prompt
      };
    }
  }

  throw new Error(
    "AI image generation returned an unsupported response."
  );
}


// ============================================================
// READ JSON
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

async function health(env) {

  return {
    success: true,

    app: "Cricket Short",

    worker: "cricket-ai-app",

    workersAI: Boolean(env.AI),

    cricketApiKey:
      Boolean(env.CRICKET_API_KEY),

    cricketLiveApiToken:
      Boolean(env.CRICKET_LIVE_API_TOKEN),

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
      "/api/debug-live",
      "/api/health"
    ]
  };
}


// ============================================================
// DEBUG LIVE
// ============================================================

async function debugLive(env) {

  const token =
    env.CRICKET_LIVE_API_TOKEN;

  if (!token) {

    return {
      success: false,
      error:
        "CRICKET_LIVE_API_TOKEN secret is missing"
    };
  }

  const response =
    await fetch(
      CRICKET_LIVE_API_URL,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {

    return {
      success: false,
      httpStatus: response.status,
      error: "API returned invalid JSON",
      preview: text.slice(0, 500)
    };
  }

  let matches = [];

  if (Array.isArray(data)) {
    matches = data;
  } else if (Array.isArray(data?.data)) {
    matches = data.data;
  } else if (Array.isArray(data?.matches)) {
    matches = data.matches;
  } else if (Array.isArray(data?.results)) {
    matches = data.results;
  }

  const first =
    matches[0] || null;

  if (!first) {

    return {
      success: response.ok,
      httpStatus: response.status,
      message: "No match data returned",
      topLevelKeys:
        data && typeof data === "object"
          ? Object.keys(data)
          : []
    };
  }

  // IMPORTANT:
  // This endpoint does NOT return the API token.

  return {
    success: response.ok,

    httpStatus: response.status,

    matchCount: matches.length,

    topLevelKeys:
      Object.keys(first),

    team1: first.team1 ?? null,

    team2: first.team2 ?? null,

    teams: first.teams ?? null,

    score: first.score ?? null,

    scores: first.scores ?? null,

    status: first.status ?? null,

    format: first.format ?? null,

    venue: first.venue ?? null,

    series: first.series ?? null,

    last_ball:
      first.last_ball ??
      first.lastBall ??
      null
  };
}


// ============================================================
// MAIN FETCH HANDLER
// ============================================================

export default {

  async fetch(request, env) {

    // --------------------------------------------
    // OPTIONS
    // --------------------------------------------

    if (request.method === "OPTIONS") {

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


    // ========================================================
    // HEALTH
    // ========================================================

    if (
      path === "/api/health" ||
      path === "/health"
    ) {

      return jsonResponse(
        await health(env)
      );
    }


    // ========================================================
    // DEBUG LIVE
    // ========================================================

    if (
      path === "/api/debug-live"
    ) {

      try {

        return jsonResponse(
          await debugLive(env)
        );

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Debug request failed"
          },
          500
        );
      }
    }


    // ========================================================
    // LIVE SCORE
    // ========================================================

    if (
      path === "/api/live-score" ||
      path === "/api/score"
    ) {

      try {

        const result =
          await getAllCricketMatches(env);

        return jsonResponse({
          success: true,

          count:
            result.matches.length,

          source:
            result.source,

          backupUsed:
            Boolean(result.backupUsed),

          matches:
            result.matches,

          primaryError:
            result.primaryError || null,

          backupError:
            result.backupError || null,

          updatedAt:
            new Date().toISOString()
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Live score failed"
          },
          500
        );
      }
    }


    // ========================================================
    // FIXTURES
    // ========================================================

    if (
      path === "/api/fixtures"
    ) {

      try {

        const matches =
          await getFixtures(env);

        return jsonResponse({
          success: true,
          count: matches.length,
          matches,
          updatedAt:
            new Date().toISOString()
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Fixtures failed"
          },
          500
        );
      }
    }


    // ========================================================
    // SCORECARD
    // ========================================================

    if (
      path === "/api/scorecard"
    ) {

      const id =
        url.searchParams.get("id");

      try {

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Scorecard failed"
          },
          400
        );
      }
    }


    // ========================================================
    // BALL BY BALL
    // ========================================================

    if (
      path === "/api/ball-by-ball"
    ) {

      const id =
        url.searchParams.get("id");

      try {

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Ball-by-ball failed"
          },
          400
        );
      }
    }


    // ========================================================
    // MATCH POINTS
    // ========================================================

    if (
      path === "/api/match-points"
    ) {

      const id =
        url.searchParams.get("id");

      try {

        const data =
          await getMatchDetail(
            env,
            id
          );

        return jsonResponse({
          success: true,
          data
        });

      } catch (error) {

        return jsonResponse(
          {
            success: false,
            error:
              error?.message ||
              "Points failed"
          },
          400
        );
      }
    }


    // ========================================================
    // AI IMAGE
    // ========================================================

    if (
      path === "/api/generate-image" ||
      path === "/api/generate"
    ) {

      if (request.method !== "POST") {

        return jsonResponse(
          {
            success: false,
            error:
              "Use POST method"
          },
          405
        );
      }

      try {

        const body =
          await readJson(request);

        const result =
          await generateImage(
            env,
            body
          );

        return jsonResponse({
          success: true,
          image: result.image,
          prompt: result.prompt
        });

      } catch (error) {

        return jsonResponse(
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


    // ========================================================
    // ROOT
    // ========================================================

    if (
      path === "/" ||
      path === ""
    ) {

      return jsonResponse({
        success: true,
        app: "Cricket Short",
        message:
          "Cricket Short Worker is running.",
        liveScore:
          "/api/live-score",
        fixtures:
          "/api/fixtures",
        scorecard:
          "/api/scorecard?id=FULL_MATCH_ID",
        debugLive:
          "/api/debug-live",
        health:
          "/api/health"
      });
    }


    // ========================================================
    // 404
    // ========================================================

    return jsonResponse(
      {
        success: false,
        error: "Endpoint not found",
        path
      },
      404
    );
  }
};
