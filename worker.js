// ============================================================
// CRICKET SHORT - V2 FINAL WORKER.JS
// LIVE SCORE + FIXTURES + SCORECARD + POINTS
// AI CRICKET IMAGE + STATIC ASSETS
// ROBUST TEAM + VENUE + SCORE EXTRACTION
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

// ============================================================
// CLEAN TEXT
// ============================================================

function cleanTeamName(name) {
  if (!name) return "";

  return String(name)
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// BOOLEAN
// ============================================================

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text =
    String(value ?? "")
      .toLowerCase()
      .trim();

  return (
    text === "true" ||
    text === "1" ||
    text === "yes"
  );
}

// ============================================================
// GET TEAM NAME
// ============================================================

function getTeamName(team, fallback = "") {
  if (!team) {
    return fallback;
  }

  if (typeof team === "string") {
    return cleanTeamName(team);
  }

  return cleanTeamName(
    team.name ||
    team.shortname ||
    team.shortName ||
    team.teamName ||
    team.team_name ||
    team.team ||
    team.title ||
    team.fullName ||
    team.full_name ||
    team.label ||
    ""
  ) || fallback;
}

// ============================================================
// SCORE PARSER
// ============================================================

function parseScore(scoreText) {
  if (
    scoreText === null ||
    scoreText === undefined ||
    scoreText === ""
  ) {
    return {
      runs: null,
      wickets: null,
      overs: null,
      display: ""
    };
  }

  const text =
    String(scoreText).trim();

  let runs = null;
  let wickets = null;
  let overs = null;

  const scoreMatch =
    text.match(/(\d+)\s*\/\s*(\d+)/);

  if (scoreMatch) {
    runs = Number(scoreMatch[1]);
    wickets = Number(scoreMatch[2]);
  } else {
    const runMatch =
      text.match(/(\d+)/);

    if (runMatch) {
      runs = Number(runMatch[1]);
    }
  }

  const overMatch =
    text.match(
      /(\d+(?:\.\d+)?)\s*ov/i
    );

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

// ============================================================
// SCORE OBJECT PARSER
// ============================================================

function parseScoreObject(item) {
  if (!item) {
    return {
      runs: null,
      wickets: null,
      overs: null,
      score: "",
      inning: ""
    };
  }

  // Direct numeric fields
  let runs =
    item.r ??
    item.runs ??
    item.run ??
    item.R ??
    null;

  let wickets =
    item.w ??
    item.wickets ??
    item.wicket ??
    item.W ??
    null;

  let overs =
    item.o ??
    item.overs ??
    item.over ??
    item.O ??
    null;

  let inning =
    item.inning ||
    item.innings ||
    item.title ||
    item.name ||
    "";

  // Score as string
  const textScore =
    item.scoreText ||
    item.scoreString ||
    item.display ||
    (
      typeof item.score === "string"
        ? item.score
        : ""
    );

  if (
    textScore
  ) {
    const parsed =
      parseScore(textScore);

    if (
      runs === null ||
      runs === undefined
    ) {
      runs = parsed.runs;
    }

    if (
      wickets === null ||
      wickets === undefined
    ) {
      wickets = parsed.wickets;
    }

    if (
      overs === null ||
      overs === undefined
    ) {
      overs = parsed.overs;
    }
  }

  // Nested score object
  if (
    typeof item.score === "object" &&
    item.score !== null
  ) {
    const nested =
      parseScoreObject(
        item.score
      );

    if (
      runs === null ||
      runs === undefined
    ) {
      runs = nested.runs;
    }

    if (
      wickets === null ||
      wickets === undefined
    ) {
      wickets = nested.wickets;
    }

    if (
      overs === null ||
      overs === undefined
    ) {
      overs = nested.overs;
    }

    if (!inning) {
      inning = nested.inning;
    }
  }

  let score = "";

  if (
    runs !== null &&
    runs !== undefined
  ) {
    score =
      `${runs}/${wickets ?? 0}`;

    if (
      overs !== null &&
      overs !== undefined &&
      overs !== ""
    ) {
      score +=
        ` (${overs} ov)`;
    }
  } else if (
    textScore
  ) {
    score =
      String(textScore);
  }

  return {
    runs,
    wickets,
    overs,
    score,
    inning
  };
}

// ============================================================
// STATUS
// ============================================================

function getStatus(match) {

  const source =
    match?.matchInfo ||
    match?.match ||
    match?.matchData ||
    match ||
    {};

  const status =
    String(
      match?.status ||
      source?.status ||
      source?.state ||
      source?.stateTitle ||
      source?.matchStatus ||
      ""
    )
      .toLowerCase()
      .trim();

  const ms =
    String(
      match?.ms ||
      source?.ms ||
      source?.matchStatus ||
      ""
    )
      .toLowerCase()
      .trim();

  const started =
    toBoolean(
      match?.matchStarted ??
      source?.matchStarted ??
      source?.started
    );

  const ended =
    toBoolean(
      match?.matchEnded ??
      source?.matchEnded ??
      source?.ended
    );

  // RESULT
  if (
    ended ||
    ms === "result" ||
    ms === "finished" ||
    ms === "completed" ||
    ms === "complete" ||
    status.includes("result") ||
    status.includes("won") ||
    status.includes("finished") ||
    status.includes("completed") ||
    status.includes("complete") ||
    status.includes("match ended") ||
    status.includes("abandoned") ||
    status.includes("cancelled")
  ) {
    return "RESULT";
  }

  // LIVE
  if (
    (started && !ended) ||
    ms === "live" ||
    ms === "ongoing" ||
    ms === "started" ||
    ms === "in progress" ||
    ms === "playing" ||
    ms === "innings break" ||
    status.includes("live") ||
    status.includes("ongoing") ||
    status.includes("in progress") ||
    status.includes("playing") ||
    status.includes("innings break") ||
    status.includes("stumps")
  ) {
    return "LIVE";
  }

  return "UPCOMING";
}

// ============================================================
// TEAM EXTRACTION
// ============================================================

function extractTeams(match) {

  const source =
    match?.matchInfo ||
    match?.match ||
    match?.matchData ||
    match ||
    {};

  let team1 = "";
  let team2 = "";

  // ----------------------------------------------------------
  // teams[]
  // ----------------------------------------------------------

  if (
    Array.isArray(source.teams)
  ) {
    team1 =
      getTeamName(
        source.teams[0]
      );

    team2 =
      getTeamName(
        source.teams[1]
      );
  }

  // ----------------------------------------------------------
  // teamInfo[]
  // ----------------------------------------------------------

  if (
    Array.isArray(source.teamInfo)
  ) {
    team1 =
      team1 ||
      getTeamName(
        source.teamInfo[0]
      );

    team2 =
      team2 ||
      getTeamName(
        source.teamInfo[1]
      );
  }

  // ----------------------------------------------------------
  // team1 / team2
  // ----------------------------------------------------------

  team1 =
    team1 ||
    getTeamName(
      source.team1
    ) ||
    getTeamName(
      source.teamA
    ) ||
    cleanTeamName(
      source.team1Name
    ) ||
    cleanTeamName(
      source.teamAName
    );

  team2 =
    team2 ||
    getTeamName(
      source.team2
    ) ||
    getTeamName(
      source.teamB
    ) ||
    cleanTeamName(
      source.team2Name
    ) ||
    cleanTeamName(
      source.teamBName
    );

  // ----------------------------------------------------------
  // Direct name fields
  // ----------------------------------------------------------

  if (
    !team1 &&
    source.team1ShortName
  ) {
    team1 =
      cleanTeamName(
        source.team1ShortName
      );
  }

  if (
    !team2 &&
    source.team2ShortName
  ) {
    team2 =
      cleanTeamName(
        source.team2ShortName
      );
  }

  // ----------------------------------------------------------
  // match name fallback
  // Example: India vs West Indies
  // ----------------------------------------------------------

  const matchName =
    source.name ||
    source.matchName ||
    source.title ||
    "";

  if (
    (!team1 || !team2) &&
    matchName
  ) {

    const parts =
      String(matchName)
        .split(/\s+vs\.?\s+/i);

    if (
      parts.length >= 2
    ) {
      team1 =
        team1 ||
        cleanTeamName(
          parts[0]
        );

      team2 =
        team2 ||
        cleanTeamName(
          parts[1]
        );
    }
  }

  return {
    team1:
      team1 ||
      "Team 1",

    team2:
      team2 ||
      "Team 2"
  };
}

// ============================================================
// VENUE EXTRACTION
// ============================================================

function extractVenue(match) {

  const source =
    match?.matchInfo ||
    match?.match ||
    match?.matchData ||
    match ||
    {};

  const venueInfo =
    source?.venueInfo ||
    source?.venueDetails ||
    match?.venueInfo ||
    {};

  return cleanTeamName(
    source?.venue ||
    source?.venueName ||
    source?.ground ||
    source?.stadium ||
    source?.location ||
    source?.venue_name ||

    venueInfo?.ground ||
    venueInfo?.name ||
    venueInfo?.venue ||
    venueInfo?.stadium ||
    venueInfo?.location ||

    match?.venue ||
    match?.venueName ||
    match?.ground ||
    match?.stadium ||
    match?.location ||

    ""
  );
}

// ============================================================
// SCORE EXTRACTION
// ============================================================

function extractScores(match) {

  const source =
    match?.matchInfo ||
    match?.match ||
    match?.matchData ||
    match ||
    {};

  const scoreSource =
    match?.matchScore ||
    source?.matchScore ||
    source?.scorecard ||
    source?.score ||
    match?.score ||
    [];

  const results = [];

  // ----------------------------------------------------------
  // score[]
  // ----------------------------------------------------------

  if (
    Array.isArray(scoreSource)
  ) {

    scoreSource.forEach(
      (item, index) => {

        const parsed =
          parseScoreObject(
            item
          );

        results.push({
          index,
          inning:
            parsed.inning ||
            "",
          runs:
            parsed.runs,
          wickets:
            parsed.wickets,
          overs:
            parsed.overs,
          score:
            parsed.score
        });
      }
    );
  }

  // ----------------------------------------------------------
  // matchScore.team1Score / team2Score
  // ----------------------------------------------------------

  const matchScore =
    source?.matchScore ||
    match?.matchScore ||
    null;

  if (
    matchScore &&
    typeof matchScore === "object"
  ) {

    const teamScores = [
      {
        key: "team1Score",
        teamIndex: 0
      },
      {
        key: "team2Score",
        teamIndex: 1
      }
    ];

    teamScores.forEach(
      entry => {

        const teamScore =
          matchScore[
            entry.key
          ];

        if (
          !teamScore
        ) {
          return;
        }

        // innings object
        const innings =
          teamScore?.inngs1 ||
          teamScore?.innings1 ||
          teamScore?.inning1 ||
          teamScore;

        const parsed =
          parseScoreObject(
            innings
          );

        if (
          parsed.score ||
          parsed.runs !== null
        ) {

          results.push({
            index:
              entry.teamIndex,

            inning:
              parsed.inning ||
              "",

            runs:
              parsed.runs,

            wickets:
              parsed.wickets,

            overs:
              parsed.overs,

            score:
              parsed.score
          });
        }
      }
    );
  }

  // ----------------------------------------------------------
  // Direct team scores
  // ----------------------------------------------------------

  const directScores = [
    source?.team1Score,
    source?.team2Score
  ];

  directScores.forEach(
    (item, index) => {

      if (!item) {
        return;
      }

      const parsed =
        parseScoreObject(
          item
        );

      if (
        parsed.score ||
        parsed.runs !== null
      ) {

        results.push({
          index,
          inning:
            parsed.inning ||
            "",
          runs:
            parsed.runs,
          wickets:
            parsed.wickets,
          overs:
            parsed.overs,
          score:
            parsed.score
        });
      }
    }
  );

  // ----------------------------------------------------------
  // Remove duplicates
  // ----------------------------------------------------------

  const unique = [];

  for (
    const item of results
  ) {

    const key =
      `${item.index}|${item.runs}|${item.wickets}|${item.overs}|${item.score}`;

    if (
      !unique.some(
        x =>
          x.__key === key
      )
    ) {

      unique.push({
        ...item,
        __key: key
      });
    }
  }

  return unique.map(
    ({
      __key,
      ...item
    }) => item
  );
}

// ============================================================
// FIND CURRENT SCORE
// ============================================================

function findCurrentScore(
  scores
) {

  if (
    !Array.isArray(scores) ||
    !scores.length
  ) {
    return null;
  }

  // Prefer last valid score
  for (
    let i = scores.length - 1;
    i >= 0;
    i--
  ) {

    const item =
      scores[i];

    if (
      item &&
      (
        item.score ||
        item.runs !== null
      )
    ) {
      return item;
    }
  }

  return null;
}

// ============================================================
// MATCH FORMATTER
// ============================================================

function formatCricScoreMatch(match) {

  const source =
    match?.matchInfo ||
    match?.match ||
    match?.matchData ||
    match ||
    {};

  const teams =
    extractTeams(
      match
    );

  const scores =
    extractScores(
      match
    );

  const current =
    findCurrentScore(
      scores
    );

  const venue =
    extractVenue(
      match
    );

  const status =
    getStatus(
      match
    );

  const matchName =
    source?.name ||
    source?.matchName ||
    source?.title ||
    `${teams.team1} vs ${teams.team2}`;

  const series =
    source?.series_name ||
    source?.seriesName ||
    source?.series ||
    source?.seriesName ||
    source?.series_id ||
    "";

  const teamInfo =
    Array.isArray(
      source?.teamInfo
    )
      ? source.teamInfo
      : [];

  return {

    id:
      match?.id ||
      source?.id ||
      source?.matchId ||
      "",

    name:
      matchName,

    matchType:
      source?.matchType ||
      source?.type ||
      match?.matchType ||
      match?.type ||
      "",

    status,

    rawStatus:
      source?.status ||
      match?.status ||
      "",

    matchStatus:
      source?.ms ||
      match?.ms ||
      "",

    matchStarted:
      toBoolean(
        match?.matchStarted ??
        source?.matchStarted
      ),

    matchEnded:
      toBoolean(
        match?.matchEnded ??
        source?.matchEnded
      ),

    venue,

    date:
      source?.date ||
      source?.dateTimeGMT ||
      match?.date ||
      match?.dateTimeGMT ||
      "",

    dateTimeGMT:
      source?.dateTimeGMT ||
      source?.date ||
      match?.dateTimeGMT ||
      match?.date ||
      "",

    series,

    teams: [
      teams.team1,
      teams.team2
    ],

    teamInfo:
      teamInfo.map(
        item => ({
          name:
            getTeamName(
              item
            ),

          shortname:
            cleanTeamName(
              item?.shortname ||
              item?.shortName ||
              item?.name ||
              ""
            ),

          img:
            item?.img ||
            item?.image ||
            ""
        })
      ),

    score:
      scores,

    currentInnings:
      current,

    currentScore:
      current?.score ||
      "",

    tossWinner:
      source?.tossWinner ||
      match?.tossWinner ||
      "",

    tossChoice:
      source?.tossChoice ||
      match?.tossChoice ||
      "",

    result:
      source?.status ||
      match?.status ||
      "",

    description:
      source?.status ||
      match?.status ||
      "",

    raw:
      match
  };
}

// ============================================================
// SORT
// ============================================================

function sortMatches(matches) {

  return [...matches].sort(
    (a, b) => {

      const order = {
        LIVE: 0,
        UPCOMING: 1,
        RESULT: 2
      };

      const statusA =
        order[a.status] ?? 9;

      const statusB =
        order[b.status] ?? 9;

      if (
        statusA !== statusB
      ) {
        return statusA - statusB;
      }

      const dateA =
        new Date(
          a.dateTimeGMT ||
          a.date ||
          0
        ).getTime();

      const dateB =
        new Date(
          b.dateTimeGMT ||
          b.date ||
          0
        ).getTime();

      return dateA - dateB;
    }
  );
}

// ============================================================
// GET ALL CRICKET MATCHES
// ============================================================

async function getAllCricketMatches(env) {

  const apiKey =
    env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CRICKET_API_KEY is not configured"
    );
  }

  const url =
    `${CRICKET_API_URL}?apikey=${encodeURIComponent(apiKey)}`;

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

  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `Cricket API HTTP ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  if (
    data?.status === "failure"
  ) {

    throw new Error(
      data?.reason ||
      data?.message ||
      data?.error ||
      JSON.stringify(data)
    );
  }

  // Support different API wrappers
  let rawMatches = [];

  if (
    Array.isArray(
      data?.data
    )
  ) {
    rawMatches =
      data.data;
  } else if (
    Array.isArray(
      data?.matches
    )
  ) {
    rawMatches =
      data.matches;
  } else if (
    Array.isArray(
      data?.results
    )
  ) {
    rawMatches =
      data.results;
  }

  const matches =
    rawMatches.map(
      formatCricScoreMatch
    );

  return sortMatches(
    matches
  );
}

// ============================================================
// LIVE
// ============================================================

async function getCricketScores(env) {

  const matches =
    await getAllCricketMatches(
      env
    );

  return matches.filter(
    match =>
      match.status === "LIVE"
  );
}

// ============================================================
// FIXTURES
// ============================================================

async function getFixtures(env) {

  return getAllCricketMatches(
    env
  );
}

// ============================================================
// MATCH DETAIL
// ============================================================

async function getMatchDetail(
  env,
  endpoint,
  matchId
) {

  const apiKey =
    env.CRICKET_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CRICKET_API_KEY is not configured"
    );
  }

  if (!matchId) {
    throw new Error(
      "Match ID is required"
    );
  }

  const url =
    `https://api.cricapi.com/v1/${endpoint}` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&offset=0` +
    `&id=${encodeURIComponent(matchId)}`;

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

  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `Cricket API HTTP ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  if (
    data?.status === "failure"
  ) {

    throw new Error(
      data?.reason ||
      data?.message ||
      data?.error ||
      JSON.stringify(data)
    );
  }

  return data;
}

// ============================================================
// AI IMAGE PROMPT
// ============================================================

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

// ============================================================
// BASE64
// ============================================================

function base64ToUint8Array(base64) {

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

  return bytes;
}

// ============================================================
// AI IMAGE
// ============================================================

async function generateAIImage(
  env,
  body
) {

  if (!env.AI) {
    throw new Error(
      "Workers AI binding is not configured"
    );
  }

  const prompt =
    buildAIImagePrompt(
      body
    );

  const result =
    await env.AI.run(
      AI_MODEL,
      {
        prompt
      }
    );

  if (!result) {
    throw new Error(
      "Workers AI returned an empty response"
    );
  }

  if (
    result instanceof ArrayBuffer
  ) {
    return new Uint8Array(
      result
    );
  }

  if (
    result instanceof Uint8Array
  ) {
    return result;
  }

  if (
    result?.image
  ) {
    return base64ToUint8Array(
      result.image
    );
  }

  if (
    result?.data?.image
  ) {
    return base64ToUint8Array(
      result.data.image
    );
  }

  throw new Error(
    "Workers AI image response was not recognized"
  );
}

// ============================================================
// ERROR
// ============================================================

function errorMessage(error) {

  if (!error) {
    return "Unknown error";
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}

// ============================================================
// WORKER
// ============================================================

export default {

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(request.url);

    const pathname =
      url.pathname;

    // ========================================================
    // OPTIONS
    // ========================================================

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

    try {

      // ======================================================
      // HEALTH
      // ======================================================

      if (
        pathname === "/api/health" &&
        request.method === "GET"
      ) {

        return jsonResponse({

          success: true,

          app:
            "Cricket Short",

          worker:
            "cricket-ai-app",

          workersAI:
            Boolean(
              env.AI
            ),

          cricketApiKey:
            Boolean(
              env.CRICKET_API_KEY
            ),

          assets:
            Boolean(
              env.ASSETS
            ),

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

      // ======================================================
      // LIVE SCORE
      // ======================================================

      if (
        pathname === "/api/live-score" &&
        request.method === "GET"
      ) {

        const matches =
          await getCricketScores(
            env
          );

        return jsonResponse({

          success: true,

          count:
            matches.length,

          matches,

          data:
            matches,

          lastUpdated:
            new Date().toISOString()

        });
      }

      // ======================================================
      // FIXTURES
      // ======================================================

      if (
        pathname === "/api/fixtures" &&
        request.method === "GET"
      ) {

        const matches =
          await getFixtures(
            env
          );

        return jsonResponse({

          success: true,

          count:
            matches.length,

          matches,

          data:
            matches,

          lastUpdated:
            new Date().toISOString()

        });
      }

      // ======================================================
      // SCORECARD
      // ======================================================

      if (
        pathname === "/api/scorecard" &&
        request.method === "GET"
      ) {

        const matchId =
          url.searchParams.get(
            "id"
          );

        if (!matchId) {

          return jsonResponse(
            {
              success: false,

              error:
                "Match ID is required"
            },
            400
          );
        }

        const data =
          await getMatchDetail(
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

      // ======================================================
      // MATCH POINTS
      // ======================================================

      if (
        pathname === "/api/match-points" &&
        request.method === "GET"
      ) {

        const matchId =
          url.searchParams.get(
            "id"
          );

        if (!matchId) {

          return jsonResponse(
            {
              success: false,

              error:
                "Match ID is required"
            },
            400
          );
        }

        const data =
          await getMatchDetail(
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

      // ======================================================
      // BALL BY BALL
      // ======================================================

      if (
        pathname === "/api/ball-by-ball" &&
        request.method === "GET"
      ) {

        const matchId =
          url.searchParams.get(
            "id"
          );

        return jsonResponse(
          {
            success: false,

            configured:
              false,

            matchId:
              matchId || "",

            error:
              "BALL_BY_BALL_ENDPOINT_NOT_CONFIGURED",

            message:
              "Ball-by-ball API endpoint is not configured yet."
          },
          501
        );
      }

      // ======================================================
      // AI IMAGE
      // ======================================================

      if (
        pathname === "/api/generate-image" &&
        request.method === "POST"
      ) {

        let body;

        try {

          body =
            await request.json();

        } catch {

          return jsonResponse(
            {
              success: false,

              error:
                "Invalid JSON request body"
            },
            400
          );
        }

        const imageBytes =
          await generateAIImage(
            env,
            body || {}
          );

        return new Response(
          imageBytes,
          {
            status: 200,

            headers: {

              ...corsHeaders(),

              "Content-Type":
                "image/jpeg",

              "Content-Disposition":
                "inline; filename=\"cricket-short-ai.jpg\""

            }
          }
        );
      }

      // ======================================================
      // AI GENERATE
      // ======================================================

      if (
        pathname === "/api/generate" &&
        request.method === "POST"
      ) {

        let body;

        try {

          body =
            await request.json();

        } catch {

          return jsonResponse(
            {
              success: false,

              error:
                "Invalid JSON request body"
            },
            400
          );
        }

        const imageBytes =
          await generateAIImage(
            env,
            body || {}
          );

        return new Response(
          imageBytes,
          {
            status: 200,

            headers: {

              ...corsHeaders(),

              "Content-Type":
                "image/jpeg",

              "Content-Disposition":
                "inline; filename=\"cricket-short-ai.jpg\""

            }
          }
        );
      }

      // ======================================================
      // SCORE COMPATIBILITY
      // ======================================================

      if (
        pathname === "/api/score" &&
        request.method === "GET"
      ) {

        const matches =
          await getCricketScores(
            env
          );

        return jsonResponse({

          success: true,

          count:
            matches.length,

          matches,

          data:
            matches,

          lastUpdated:
            new Date().toISOString()

        });
      }

      // ======================================================
      // STATIC ASSETS
      // ======================================================

      if (
        env.ASSETS
      ) {

        return env.ASSETS.fetch(
          request
        );
      }

      // ======================================================
      // ROOT
      // ======================================================

      if (
        pathname === "/" &&
        request.method === "GET"
      ) {

        return new Response(
          "Cricket Short Worker is running.",
          {
            status: 200,

            headers: {

              ...corsHeaders(),

              "Content-Type":
                "text/plain; charset=utf-8"

            }
          }
        );
      }

      // ======================================================
      // 404
      // ======================================================

      return jsonResponse(
        {
          success: false,

          error:
            "Not Found",

          path:
            pathname
        },
        404
      );

    } catch (error) {

      return jsonResponse(
        {
          success: false,

          error:
            errorMessage(
              error
            )
        },
        500
      );
    }
  }
};
