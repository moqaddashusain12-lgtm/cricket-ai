// ============================================================
// CRICKET SHORT - FINAL WORKER.JS
// Live Score + Overs + AI Image + Static Assets
// ============================================================

const AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CRICKET_API_URL = "https://api.cricapi.com/v1/cricScore";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    })
  });
}

function cleanTeamName(value) {
  if (!value) return "";

  return String(value)
    .replace(/\s*\[[A-Z0-9]+\]\s*$/i, "")
    .trim();
}

/* ------------------------------------------------------------
   SCORE PARSER
   Supports:
   110/1
   110/1 (18.2 ov)
   110/1 (18.2 Overs)
------------------------------------------------------------ */

function parseScore(value) {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  const scoreMatch = text.match(
    /(\d+)\s*\/\s*(\d+)/i
  );

  const overMatch = text.match(
    /\(([\d.]+)\s*(?:ov|overs?)\)/i
  );

  if (!scoreMatch) {
    return {
      raw: text,
      runs: null,
      wickets: null,
      overs: overMatch ? overMatch[1] : ""
    };
  }

  return {
    raw: text,

    runs: Number(scoreMatch[1]),

    wickets: Number(scoreMatch[2]),

    overs: overMatch
      ? overMatch[1]
      : ""
  };
}

/* ------------------------------------------------------------
   FIND OVERS FROM ANY POSSIBLE API FIELD
------------------------------------------------------------ */

function findOvers(match, teamIndex, parsedScore) {

  if (
    parsedScore &&
    parsedScore.overs !== undefined &&
    parsedScore.overs !== null &&
    parsedScore.overs !== ""
  ) {
    return String(parsedScore.overs);
  }

  const possibleFields =
    teamIndex === 0
      ? [
          "t1o",
          "t1overs",
          "team1Overs",
          "team1overs",
          "overs1"
        ]
      : [
          "t2o",
          "t2overs",
          "team2Overs",
          "team2overs",
          "overs2"
        ];

  for (const field of possibleFields) {

    if (
      match[field] !== undefined &&
      match[field] !== null &&
      String(match[field]).trim() !== ""
    ) {
      return String(match[field]).trim();
    }
  }

  return "";
}

/* ------------------------------------------------------------
   STATUS
------------------------------------------------------------ */

function getStatus(mode, text) {

  const m = String(mode || "").toLowerCase();

  const s = String(text || "").toLowerCase();

  if (
    m === "result" ||
    m === "completed" ||
    s.includes("won by") ||
    s.includes("lost by") ||
    s.includes("match drawn") ||
    s.includes("no result") ||
    s.includes("tied") ||
    s.includes("abandoned")
  ) {
    return "RESULT";
  }

  if (
    s.includes("stumps") ||
    s.includes("stump")
  ) {
    return "STUMPS";
  }

  if (
    s.includes("delay") ||
    s.includes("delayed") ||
    s.includes("rain")
  ) {
    return "DELAYED";
  }

  if (
    m === "fixture" ||
    s.includes("match starts") ||
    s.includes("starts at") ||
    s.includes("scheduled")
  ) {
    return "UPCOMING";
  }

  if (
    m === "live" ||
    s.includes("live") ||
    s.includes("playing") ||
    s.includes("in progress")
  ) {
    return "LIVE";
  }

  return "UPCOMING";
}

/* ------------------------------------------------------------
   FIND BATTING TEAM
------------------------------------------------------------ */

function findBattingTeamIndex(
  team1,
  team2,
  statusText
) {

  const t1 =
    String(team1 || "").toLowerCase();

  const t2 =
    String(team2 || "").toLowerCase();

  const status =
    String(statusText || "").toLowerCase();

  if (
    status.includes(
      t1 + " opt to bowl"
    ) ||
    status.includes(
      t1 + " opted to bowl"
    )
  ) {
    return 1;
  }

  if (
    status.includes(
      t2 + " opt to bowl"
    ) ||
    status.includes(
      t2 + " opted to bowl"
    )
  ) {
    return 0;
  }

  if (
    status.includes(
      t1 + " opt to bat"
    ) ||
    status.includes(
      t1 + " opted to bat"
    )
  ) {
    return 0;
  }

  if (
    status.includes(
      t2 + " opt to bat"
    ) ||
    status.includes(
      t2 + " opted to bat"
    )
  ) {
    return 1;
  }

  if (
    status.includes(
      t1 + " batting"
    ) ||
    status.includes(
      t1 + " are batting"
    )
  ) {
    return 0;
  }

  if (
    status.includes(
      t2 + " batting"
    ) ||
    status.includes(
      t2 + " are batting"
    )
  ) {
    return 1;
  }

  return null;
}

/* ------------------------------------------------------------
   FORMAT MATCH
------------------------------------------------------------ */

function formatCricScoreMatch(m) {

  if (!m || !m.id) {
    return null;
  }

  const team1 =
    cleanTeamName(m.t1);

  const team2 =
    cleanTeamName(m.t2);

  const statusRaw =
    String(m.status || "").trim();

  const mode =
    String(m.ms || "").toLowerCase();

  const status =
    getStatus(mode, statusRaw);

  const rawScore1 =
    parseScore(m.t1s);

  const rawScore2 =
    parseScore(m.t2s);

  /* Get overs separately */

  const team1Overs =
    findOvers(
      m,
      0,
      rawScore1
    );

  const team2Overs =
    findOvers(
      m,
      1,
      rawScore2
    );

  const battingTeamIndex =
    findBattingTeamIndex(
      team1,
      team2,
      statusRaw
    );

  let score1 =
    rawScore1;

  let score2 =
    rawScore2;

  /* ----------------------------------------------------------
     LIVE MATCH
     Only show currently batting team's score when possible
  ---------------------------------------------------------- */

  if (
    status === "LIVE" ||
    status === "STUMPS"
  ) {

    if (battingTeamIndex === 0) {

      score2 = null;

    }

    if (battingTeamIndex === 1) {

      score1 = null;

    }

    if (battingTeamIndex === null) {

      if (
        rawScore1 &&
        !rawScore2
      ) {

        score1 = rawScore1;
        score2 = null;

      } else if (
        !rawScore1 &&
        rawScore2
      ) {

        score1 = null;
        score2 = rawScore2;

      } else {

        score1 = null;
        score2 = null;

      }
    }
  }

  const score = [];

  if (score1) {
    score.push(score1);
  }

  if (score2) {
    score.push(score2);
  }

  return {

    id:
      String(m.id),

    name:
      `${team1 || "Team 1"} vs ${
        team2 || "Team 2"
      }`,

    team1:
      team1 || "Team 1",

    team2:
      team2 || "Team 2",

    team1Logo:
      m.t1img || "",

    team2Logo:
      m.t2img || "",

    score,

    team1Score:
      score1,

    team2Score:
      score2,

    rawTeam1Score:
      rawScore1,

    rawTeam2Score:
      rawScore2,

    /* IMPORTANT */
    team1Overs,

    team2Overs,

    battingTeamIndex,

    status,

    statusText:
      statusRaw,

    venue:
      m.venue ||
      "Venue not available",

    date:
      m.date ||
      (
        m.dateTimeGMT
          ? String(
              m.dateTimeGMT
            ).slice(0, 10)
          : ""
      ),

    dateTimeGMT:
      m.dateTimeGMT || "",

    matchType:
      String(
        m.matchType ||
        "cricket"
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

/* ------------------------------------------------------------
   SORT
------------------------------------------------------------ */

function sortMatches(matches) {

  const priority = {

    LIVE: 1,

    STUMPS: 2,

    DELAYED: 3,

    UPCOMING: 4,

    RESULT: 5

  };

  return matches.sort(
    (a, b) => {

      const pa =
        priority[a.status] ||
        99;

      const pb =
        priority[b.status] ||
        99;

      if (pa !== pb) {
        return pa - pb;
      }

      return String(
        a.dateTimeGMT || ""
      ).localeCompare(
        String(
          b.dateTimeGMT || ""
        )
      );
    }
  );
}

/* ------------------------------------------------------------
   CRICKET API
------------------------------------------------------------ */

async function getCricketScores(env) {

  if (!env.CRICKET_API_KEY) {

    throw new Error(
      "CRICKET_API_KEY secret is missing."
    );
  }

  const apiUrl =
    `${CRICKET_API_URL}?apikey=${
      encodeURIComponent(
        env.CRICKET_API_KEY
      )
    }`;

  const response =
    await fetch(
      apiUrl,
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

  } catch (error) {

    throw new Error(
      "Cricket API returned invalid JSON."
    );
  }

  if (!response.ok) {

    throw new Error(
      `Cricket API HTTP ${response.status}`
    );
  }

  if (
    data.status !== "success" &&
    data.status !== true
  ) {

    throw new Error(
      data.info ||
      data.message ||
      "Cricket API request failed."
    );
  }

  const list =
    Array.isArray(data.data)
      ? data.data
      : [];

  const matches =
    list
      .map(
        formatCricScoreMatch
      )
      .filter(Boolean);

  return sortMatches(
    matches
  );
}

/* ------------------------------------------------------------
   MAIN WORKER
------------------------------------------------------------ */

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );

    /* OPTIONS */

    if (
      request.method ===
      "OPTIONS"
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

    /* --------------------------------------------------------
       HEALTH
    -------------------------------------------------------- */

    if (
      url.pathname ===
        "/api/health" &&
      request.method ===
        "GET"
    ) {

      return jsonResponse({

        success: true,

        worker:
          "Cricket Short Worker",

        ai:
          !!env.AI,

        cricketApiKey:
          !!env.CRICKET_API_KEY,

        assets:
          !!env.ASSETS,

        time:
          new Date().toISOString()

      });
    }

    /* --------------------------------------------------------
       LIVE SCORE
    -------------------------------------------------------- */

    if (
      url.pathname ===
        "/api/live-score" &&
      request.method ===
        "GET"
    ) {

      try {

        const matches =
          await getCricketScores(
            env
          );

        const liveCount =
          matches.filter(
            m =>
              m.status ===
                "LIVE" ||
              m.status ===
                "STUMPS"
          ).length;

        return jsonResponse({

          success: true,

          count:
            matches.length,

          liveCount,

          updatedAt:
            new Date().toISOString(),

          source:
            "cricScore",

          range:
            "Last 7 days + Next 7 days + Current Live",

          matches

        });

      } catch (error) {

        return jsonResponse(

          {
            success: false,

            error:
              error?.message ||
              "Live score failed."
          },

          500

        );
      }
    }

    /* --------------------------------------------------------
       AI IMAGE
    -------------------------------------------------------- */

    if (
      url.pathname ===
        "/api/generate-image" &&
      request.method ===
        "POST"
    ) {

      if (!env.AI) {

        return jsonResponse(

          {
            success: false,

            error:
              "Workers AI binding is missing."
          },

          500

        );
      }

      let body;

      try {

        body =
          await request.json();

      } catch (error) {

        return jsonResponse(

          {
            success: false,

            error:
              "Invalid JSON request."
          },

          400

        );
      }

      const prompt =
        String(
          body?.prompt || ""
        ).trim();

      if (!prompt) {

        return jsonResponse(

          {
            success: false,

            error:
              "Prompt is required."
          },

          400

        );
      }

      try {

        const result =
          await env.AI.run(

            AI_MODEL,

            {
              prompt,

              steps: 4
            }

          );

        if (
          !result ||
          !result.image
        ) {

          return jsonResponse(

            {
              success: false,

              error:
                "AI image was not returned."
            },

            500

          );
        }

        let base64 =
          String(
            result.image
          );

        if (
          base64.includes(",")
        ) {

          base64 =
            base64
              .split(",")
              .pop();

        }

        const binaryString =
          atob(base64);

        const bytes =
          new Uint8Array(
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

        return new Response(
          bytes,
          {
            status: 200,

            headers:
              corsHeaders({

                "Content-Type":
                  "image/jpeg",

                "Content-Length":
                  String(
                    bytes.length
                  ),

                "Cache-Control":
                  "no-store, no-cache, must-revalidate",

                "Pragma":
                  "no-cache"

              })
          }
        );

      } catch (error) {

        return jsonResponse(

          {
            success: false,

            error:
              error?.message ||
              "AI image generation failed."
          },

          500

        );
      }
    }

    /* --------------------------------------------------------
       STATIC ASSETS
    -------------------------------------------------------- */

    if (env.ASSETS) {

      try {

        return await env.ASSETS.fetch(
          request
        );

      } catch (error) {

        return new Response(
          "Static asset error.",
          {
            status: 500,

            headers:
              corsHeaders({

                "Content-Type":
                  "text/plain; charset=utf-8"

              })
          }
        );
      }
    }

    /* --------------------------------------------------------
       NOT FOUND
    -------------------------------------------------------- */

    return jsonResponse(

      {
        success: false,

        error:
          "Route not found."
      },

      404

    );
  }
};
