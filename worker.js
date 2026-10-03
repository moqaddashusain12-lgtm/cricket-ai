// ============================================================
// 🏏 CRICKET SHORT - FINAL WORKER.JS
// Live Score + CricketLiveApi Backup
// Fixtures + Scorecard + Ball-by-Ball + Points
// AI Cricket Image Generator
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
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  return "";
}


// ============================================================
// TEAM NAME
// Supports CricketLiveApi first_team / second_team
// ============================================================

function getTeamName(team) {

  if (!team) {
    return "";
  }

  // --------------------------------------------
  // String
  // --------------------------------------------

  if (typeof team === "string") {
    return team.trim();
  }

  // --------------------------------------------
  // Object
  // --------------------------------------------

  if (typeof team === "object") {

    const possibleNames = [
      team.name,
      team.team_name,
      team.teamName,
      team.title,
      team.short_name,
      team.shortName,
      team.display_name,
      team.displayName,
      team.country,
      team.code,
      team.abbreviation,
      team.abbr
    ];

    for (const item of possibleNames) {

      const value = cleanText(item);

      if (value) {
        return value;
      }
    }
  }

  return "";
}


// ============================================================
// TEAM OBJECT
// ============================================================

function getTeamObject(match, first = true) {

  if (first) {

    return (
      match?.first_team ??
      match?.team1 ??
      match?.team_1 ??
      match?.home_team ??
      match?.homeTeam ??
      match?.teamA ??
      match?.team_a ??
      null
    );

  } else {

    return (
      match?.second_team ??
      match?.team2 ??
      match?.team_2 ??
      match?.away_team ??
      match?.awayTeam ??
      match?.teamB ??
      match?.team_b ??
      null
    );
  }
}


// ============================================================
// TEAM EXTRACTION
// ============================================================

function extractTeams(match) {

  let team1Object = getTeamObject(match, true);
  let team2Object = getTeamObject(match, false);

  let team1 = getTeamName(team1Object);
  let team2 = getTeamName(team2Object);

  // --------------------------------------------
  // teams array fallback
  // --------------------------------------------

  if (
    (!team1 || !team2) &&
    Array.isArray(match?.teams)
  ) {

    if (!team1) {
      team1 = getTeamName(match.teams[0]);
    }

    if (!team2) {
      team2 = getTeamName(match.teams[1]);
    }
  }

  // --------------------------------------------
  // Match title/name fallback
  // --------------------------------------------

  const title =
    cleanText(match?.title) ||
    cleanText(match?.name) ||
    cleanText(match?.match);

  if ((!team1 || !team2) && title) {

    const parts = title
      .split(/\s+vs\.?\s+|\s+v\s+/i)
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {

      if (!team1) {
        team1 = parts[0];
      }

      if (!team2) {
        team2 = parts[1];
      }
    }
  }

  return {
    team1Object,
    team2Object,
    team1: team1 || "Team 1",
    team2: team2 || "Team 2"
  };
}


// ============================================================
// SCORE PARSER
// ============================================================

function parseScore(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  // --------------------------------------------
  // String
  // Examples:
  // 141/2
  // 141/2 (23.6)
  // 141/2 (23.6 ov)
  // --------------------------------------------

  if (typeof value === "string") {

    const text = value.trim();

    if (!text) {
      return null;
    }

    const match = text.match(
      /(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]*)\))?/i
    );

    if (match) {

      return {
        runs: Number(match[1]),
        wickets: Number(match[2]),
        overs: match[3]
          ? match[3].trim()
          : ""
      };
    }

    const runsOnly =
      text.match(/(\d+)/);

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

    // Direct values
    const runs =
      value.runs ??
      value.run ??
      value.total_runs ??
      value.totalRuns ??
      value.score ??
      value.total ??
      value.r;

    const wickets =
      value.wickets ??
      value.wicket ??
      value.wkts ??
      value.w;

    const overs =
      value.overs ??
      value.over ??
      value.ov;

    if (
      runs !== undefined ||
      wickets !== undefined ||
      overs !== undefined
    ) {

      let numericRuns = null;

      if (
        runs !== undefined &&
        runs !== null &&
        runs !== ""
      ) {

        // If score itself is "141/2"
        if (typeof runs === "string") {

          const parsed =
            parseScore(runs);

          if (parsed) {
            return parsed;
          }
        }

        const n = Number(runs);

        if (!Number.isNaN(n)) {
          numericRuns = n;
        }
      }

      let numericWickets = null;

      if (
        wickets !== undefined &&
        wickets !== null &&
        wickets !== ""
      ) {

        const n =
          Number(wickets);

        if (!Number.isNaN(n)) {
          numericWickets = n;
        }
      }

      return {
        runs: numericRuns,
        wickets: numericWickets,
        overs:
          overs !== undefined &&
          overs !== null
            ? String(overs)
            : ""
      };
    }

    // Nested score fields
    const nestedFields = [
      value.score,
      value.scorecard,
      value.current_score,
      value.currentScore,
      value.live_score,
      value.liveScore,
      value.batting
    ];

    for (const nested of nestedFields) {

      if (
        nested !== undefined &&
        nested !== null &&
        nested !== value
      ) {

        const parsed =
          parseScore(nested);

        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
}


// ============================================================
// EXTRACT SCORE FROM TEAM OBJECT
// ============================================================

function extractTeamScore(team) {

  if (!team) {
    return null;
  }

  // --------------------------------------------
  // Team itself may be a score string
  // --------------------------------------------

  if (typeof team === "string") {
    return parseScore(team);
  }

  if (typeof team !== "object") {
    return null;
  }

  // --------------------------------------------
  // Direct score fields
  // --------------------------------------------

  const possibleScores = [
    team.score,
    team.scores,
    team.current_score,
    team.currentScore,
    team.live_score,
    team.liveScore,
    team.scorecard,
    team.innings,
    team.total,
    team.runs
  ];

  for (const value of possibleScores) {

    const parsed =
      parseScore(value);

    if (parsed) {
      return parsed;
    }
  }

  // --------------------------------------------
  // Nested score object
  // --------------------------------------------

  if (team.stats) {

    const parsed =
      parseScore(team.stats);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}


// ============================================================
// EXTRACT MATCH SCORES
// ============================================================

function extractScores(match, team1Object, team2Object) {

  const scores = [];

  // --------------------------------------------
  // FIRST TEAM
  // --------------------------------------------

  const firstScore =
    extractTeamScore(team1Object);

  if (firstScore) {
    scores.push(firstScore);
  }

  // --------------------------------------------
  // SECOND TEAM
  // --------------------------------------------

  const secondScore =
    extractTeamScore(team2Object);

  if (secondScore) {
    scores.push(secondScore);
  }

  // --------------------------------------------
  // Match-level score
  // --------------------------------------------

  const matchScoreFields = [
    match?.score,
    match?.scores,
    match?.scorecard,
    match?.current_score,
    match?.currentScore,
    match?.live_score,
    match?.liveScore,
    match?.innings
  ];

  for (const field of matchScoreFields) {

    if (!field) {
      continue;
    }

    // Array
    if (Array.isArray(field)) {

      for (const item of field) {

        const parsed =
          parseScore(item);

        if (parsed) {
          scores.push(parsed);
        }
      }

      continue;
    }

    // Object
    if (
      typeof field === "object" &&
      !Array.isArray(field)
    ) {

      // If object contains team scores
      const objectValues =
        Object.values(field);

      for (const item of objectValues) {

        const parsed =
          parseScore(item);

        if (parsed) {
          scores.push(parsed);
        }
      }

      const direct =
        parseScore(field);

      if (direct) {
        scores.push(direct);
      }

      continue;
    }

    // String
    const parsed =
      parseScore(field);

    if (parsed) {
      scores.push(parsed);
    }
  }

  // --------------------------------------------
  // Direct match runs/wickets/overs
  // --------------------------------------------

  if (
    match?.runs !== undefined ||
    match?.wickets !== undefined ||
    match?.overs !== undefined
  ) {

    const parsed =
      parseScore({
        runs: match.runs,
        wickets: match.wickets,
        overs: match.overs
      });

    if (parsed) {
      scores.push(parsed);
    }
  }

  // --------------------------------------------
  // Remove duplicate scores
  // --------------------------------------------

  const unique = [];

  for (const score of scores) {

    const key =
      `${score.runs}|${score.wickets}|${score.overs}`;

    if (
      !unique.some(
        item =>
          `${item.runs}|${item.wickets}|${item.overs}` === key
      )
    ) {

      unique.push(score);
    }
  }

  return unique.slice(0, 2);
}


// ============================================================
// SCORE TEXT
// ============================================================

function formatScoreText(score) {

  if (!score) {
    return "-";
  }

  let text = "";

  if (
    score.runs !== null &&
    score.runs !== undefined &&
    !Number.isNaN(Number(score.runs))
  ) {

    text += String(score.runs);
  }

  if (
    score.wickets !== null &&
    score.wickets !== undefined &&
    !Number.isNaN(Number(score.wickets))
  ) {

    text += `/${score.wickets}`;
  }

  if (score.overs) {

    text += ` (${score.overs})`;
  }

  return text || "-";
}


// ============================================================
// STATUS
// ============================================================

function getStatus(match) {

  const value =
    cleanText(match?.status) ||
    cleanText(match?.status_detail) ||
    cleanText(match?.short_status) ||
    cleanText(match?.state) ||
    "LIVE";

  const lower =
    value.toLowerCase();

  if (
    lower.includes("live") ||
    lower.includes("progress") ||
    lower.includes("playing") ||
    lower.includes("ongoing")
  ) {

    return "LIVE";
  }

  return value;
}


// ============================================================
// FORMAT
// ============================================================

function getFormat(match) {

  return (
    cleanText(match?.format) ||
    cleanText(match?.match_type) ||
    cleanText(match?.matchType) ||
    cleanText(match?.type) ||
    "CRICKET"
  );
}


// ============================================================
// VENUE
// ============================================================

function extractVenue(match) {

  if (
    typeof match?.venue === "string"
  ) {

    return match.venue;
  }

  if (
    match?.venue &&
    typeof match.venue === "object"
  ) {

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
    cleanText(match?.series_name) ||
    cleanText(match?.seriesName) ||
    cleanText(match?.series) ||
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
    cleanText(match?.commentary) ||
    cleanText(match?.latest_ball) ||
    ""
  );
}


// ============================================================
// CRICKETLIVEAPI MATCH FORMAT
// ============================================================

function formatCricketLiveApiMatch(
  match,
  index = 0
) {

  const teams =
    extractTeams(match);

  const scores =
    extractScores(
      match,
      teams.team1Object,
      teams.team2Object
    );

  const score1 =
    scores[0] || null;

  const score2 =
    scores[1] || null;

  const matchId =
    cleanText(match?.match_id) ||
    cleanText(match?.matchId) ||
    cleanText(match?.id) ||
    `live-${index + 1}`;

  return {

    id: matchId,

    name:
      cleanText(match?.title) ||
      cleanText(match?.name) ||
      `${teams.team1} vs ${teams.team2}`,

    team1:
      teams.team1,

    team2:
      teams.team2,

    team1Score:
      formatScoreText(score1),

    team2Score:
      formatScoreText(score2),

    score:
      scores,

    status:
      getStatus(match),

    format:
      getFormat(match),

    venue:
      extractVenue(match),

    series:
      extractSeries(match),

    last_ball:
      extractLastBall(match),

    date:
      cleanText(match?.date),

    source:
      "CricketLiveApi"
  };
}


// ============================================================
// CRICKETLIVEAPI
// ============================================================

async function getCricketLiveApiMatches(env) {

  const token =
    env.CRICKET_LIVE_API_TOKEN;

  if (!token) {

    throw new Error(
      "CRICKET_LIVE_API_TOKEN secret is missing"
    );
  }

  const response =
    await fetch(
      CRICKET_LIVE_API_URL,
      {
        method: "GET",
        headers: {
          "Authorization":
            `Bearer ${token}`,
          "Accept":
            "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

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

  } else if (
    data?.data &&
    typeof data.data === "object"
  ) {

    matches = [data.data];
  }

  return matches
    .filter(Boolean)
    .map(
      (match, index) =>
        formatCricketLiveApiMatch(
          match,
          index
        )
    );
}


// ============================================================
// PRIMARY CRICAPI MATCH FORMAT
// ============================================================

function formatCricScoreMatch(
  match,
  index = 0
) {

  const teams =
    extractTeams(match);

  const scores =
    extractScores(
      match,
      teams.team1Object,
      teams.team2Object
    );

  return {

    id:
      cleanText(match?.id) ||
      cleanText(match?.matchId) ||
      `cric-${index + 1}`,

    name:
      cleanText(match?.name) ||
      `${teams.team1} vs ${teams.team2}`,

    team1:
      teams.team1,

    team2:
      teams.team2,

    team1Score:
      formatScoreText(
        scores[0]
      ),

    team2Score:
      formatScoreText(
        scores[1]
      ),

    score:
      scores,

    status:
      getStatus(match),

    format:
      getFormat(match),

    venue:
      extractVenue(match),

    series:
      extractSeries(match),

    last_ball:
      extractLastBall(match),

    source:
      "CricAPI"
  };
}


// ============================================================
// PRIMARY CRICAPI
// ============================================================

async function getCricketScores(env) {

  const key =
    env.CRICKET_API_KEY;

  if (!key) {

    throw new Error(
      "CRICKET_API_KEY secret is missing"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(key)}`;

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: {
          "Accept":
            "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

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

    matches =
      data.data;

  } else if (
    Array.isArray(data?.matches)
  ) {

    matches =
      data.matches;

  } else if (Array.isArray(data)) {

    matches =
      data;
  }

  return matches.map(
    (match, index) =>
      formatCricScoreMatch(
        match,
        index
      )
  );
}


// ============================================================
// LIVE STATUS CHECK
// ============================================================

function isLiveMatch(match) {

  const status =
    cleanText(match?.status)
      .toLowerCase();

  return (
    status === "live" ||
    status.includes("live") ||
    status.includes("progress") ||
    status.includes("playing") ||
    status.includes("ongoing")
  );
}


// ============================================================
// AUTOMATIC PRIMARY + BACKUP
// ============================================================

async function getAllCricketMatches(env) {

  let primaryMatches = [];

  let primaryError = "";

  // --------------------------------------------
  // PRIMARY API
  // --------------------------------------------

  try {

    primaryMatches =
      await getCricketScores(env);

    const livePrimary =
      primaryMatches.filter(
        isLiveMatch
      );

    if (livePrimary.length > 0) {

      return {
        matches:
          livePrimary,

        source:
          "CricAPI",

        primaryError:
          null,

        backupUsed:
          false
      };
    }

  } catch (error) {

    primaryError =
      error?.message ||
      "Primary API failed";
  }


  // --------------------------------------------
  // BACKUP API
  // --------------------------------------------

  try {

    const backupMatches =
      await getCricketLiveApiMatches(
        env
      );

    const liveBackup =
      backupMatches.filter(
        isLiveMatch
      );

    if (liveBackup.length > 0) {

      return {
        matches:
          liveBackup,

        source:
          "CricketLiveApi",

        primaryError:
          primaryError || null,

        backupUsed:
          true
      };
    }

    // Return backup data if API
    // provides matches without LIVE text.

    if (backupMatches.length > 0) {

      return {
        matches:
          backupMatches,

        source:
          "CricketLiveApi",

        primaryError:
          primaryError || null,

        backupUsed:
          true
      };
    }

  } catch (backupError) {

    return {

      matches: [],

      source:
        "none",

      primaryError:
        primaryError ||
        "Primary API failed",

      backupError:
        backupError?.message ||
        "Backup API failed",

      backupUsed:
        true
    };
  }


  return {

    matches:
      primaryMatches,

    source:
      "CricAPI",

    primaryError:
      primaryError || null,

    backupUsed:
      false
  };
}


// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  try {

    const key =
      env.CRICKET_API_KEY;

    if (key) {

      const url =
        `https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(key)}`;

      const response =
        await fetch(url);

      const text =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        data = null;
      }

      if (
        response.ok &&
        data
      ) {

        const matches =
          Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.matches)
              ? data.matches
              : [];

        return matches.map(
          (match, index) =>
            formatCricScoreMatch(
              match,
              index
            )
        );
      }
    }

  } catch {
    // Continue to backup.
  }

  try {

    return await getCricketLiveApiMatches(
      env
    );

  } catch {

    return [];
  }
}


// ============================================================
// MATCH DETAIL
// ============================================================

async function getMatchDetail(
  env,
  id
) {

  if (!id) {

    throw new Error(
      "Match ID is required"
    );
  }

  const guidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (
    !guidPattern.test(id)
  ) {

    throw new Error(
      "Invalid Match ID. Please use the full CricAPI Match ID."
    );
  }

  const key =
    env.CRICKET_API_KEY;

  if (!key) {

    throw new Error(
      "CRICKET_API_KEY secret is missing"
    );
  }

  const url =
    `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`;

  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

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

Create a fictional cricket sports image inspired by these specifications.

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

Professional cricket ground.
Realistic cricket equipment.
Realistic athletic body proportions.
Detailed cricket jersey.
Professional cricket stadium.
Stadium floodlights where appropriate.
Energetic crowd.
Dramatic cinematic atmosphere.
Professional sports-news photography.
Ultra realistic.
High detail.
Natural skin texture.
Sharp subject.
No text.
No logo.
No watermark.
`;
}


// ============================================================
// ARRAY BUFFER TO BASE64
// ============================================================

function arrayBufferToBase64(
  buffer
) {

  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {

    binary +=
      String.fromCharCode(
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
// AI IMAGE GENERATION
// ============================================================

async function generateImage(
  env,
  body
) {

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

  if (
    result instanceof ArrayBuffer
  ) {

    return {

      image:
        `data:image/png;base64,${arrayBufferToBase64(result)}`,

      prompt
    };
  }

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

  if (result?.image) {

    if (
      typeof result.image === "string"
    ) {

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

    app:
      "Cricket Short",

    worker:
      "cricket-ai-app",

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

      "/api/health"

    ]
  };
}


// ============================================================
// MAIN REQUEST HANDLER
// ============================================================

export default {

  async fetch(
    request,
    env
  ) {

    // --------------------------------------------
    // OPTIONS
    // --------------------------------------------

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
    // LIVE SCORE
    // ========================================================

    if (
      path === "/api/live-score" ||
      path === "/api/score"
    ) {

      try {

        const result =
          await getAllCricketMatches(
            env
          );

        return jsonResponse({

          success: true,

          count:
            result.matches.length,

          source:
            result.source,

          backupUsed:
            Boolean(
              result.backupUsed
            ),

          matches:
            result.matches,

          primaryError:
            result.primaryError ||
            null,

          backupError:
            result.backupError ||
            null,

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

          count:
            matches.length,

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

      if (
        request.method !== "POST"
      ) {

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

          image:
            result.image,

          prompt:
            result.prompt
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

        app:
          "Cricket Short",

        message:
          "Cricket Short Worker is running.",

        liveScore:
          "/api/live-score",

        fixtures:
          "/api/fixtures",

        scorecard:
          "/api/scorecard?id=FULL_MATCH_ID",

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

        error:
          "Endpoint not found",

        path
      },

      404
    );
  }
};
