export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // =====================================================
    // LIVE / UPCOMING / RECENT CRICKET SCORE
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
            error:
              "CRICKET_API_KEY is not configured in Cloudflare Worker"
          },
          500
        );
      }

      try {
        // =================================================
        // CricketData eCricScore
        // Last 7 days + Next 7 days + Current Live
        // =================================================
        const apiUrl =
          "https://api.cricapi.com/v1/cricScore?apikey=" +
          encodeURIComponent(apiKey);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cf: {
            cacheTtl: 240,
            cacheEverything: true
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
              error: "Invalid cricket API response",
              apiResponse: apiData
            },
            502
          );
        }

        // =================================================
        // Convert every API match into our app format
        // =================================================

        const matches = apiData.data
          .map(formatMatch)
          .filter(match => {
            return (
              match &&
              match.name &&
              match.team1 &&
              match.team2
            );
          });

        // =================================================
        // REMOVE DUPLICATE MATCHES
        // =================================================

        const unique = [];

        const seen = new Set();

        for (const match of matches) {
          const key =
            match.id ||
            `${match.name}-${match.date}`;

          if (!seen.has(key)) {
            seen.add(key);
            unique.push(match);
          }
        }

        // =================================================
        // SORT
        //
        // LIVE
        // STUMPS
        // DELAYED
        // UPCOMING
        // RESULT
        // =================================================

        const priority = {
          LIVE: 1,
          STUMPS: 2,
          DELAYED: 3,
          UPCOMING: 4,
          RESULT: 5
        };

        unique.sort((a, b) => {
          const pa =
            priority[a.status] || 9;

          const pb =
            priority[b.status] || 9;

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

          return String(a.name).localeCompare(
            String(b.name)
          );
        });

        return json({
          success: true,

          count: unique.length,

          updatedAt:
            new Date().toISOString(),

          source: "cricScore",

          range:
            "Last 7 days + Next 7 days + Current Live",

          matches: unique
        });
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error?.message ||
              "Unable to fetch cricket scores"
          },
          500
        );
      }
    }

    // =====================================================
    // AI IMAGE GENERATOR
    // =====================================================

    if (
      url.pathname ===
      "/api/generate-image"
    ) {
      if (request.method !== "POST") {
        return json(
          {
            success: false,
            error:
              "Only POST requests are allowed"
          },
          405
        );
      }

      try {
        const body =
          await request.json();

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

        if (!env.AI) {
          return json(
            {
              success: false,
              error:
                "Workers AI binding 'AI' is not configured"
            },
            500
          );
        }

        const result =
          await env.AI.run(
            "@cf/black-forest-labs/flux-1-schnell",
            {
              prompt
            }
          );

        let imageBytes;

        // ArrayBuffer
        if (
          result instanceof ArrayBuffer
        ) {
          imageBytes = result;
        }

        // Uint8Array
        else if (
          result instanceof Uint8Array
        ) {
          imageBytes =
            result.buffer;
        }

        // Base64 image
        else if (result?.image) {
          imageBytes =
            base64ToArrayBuffer(
              result.image
            );
        }

        else {
          return json(
            {
              success: false,
              error:
                "AI image response was empty"
            },
            502
          );
        }

        const base64 =
          arrayBufferToBase64(
            imageBytes
          );

        return json({
          success: true,
          image:
            "data:image/jpeg;base64," +
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
    // HEALTH CHECK
    // =====================================================

    if (
      url.pathname ===
      "/api/health"
    ) {
      return json({
        success: true,
        worker:
          "Cricket Short Worker",
        ai: !!env.AI,
        cricketApiKey:
          !!env.CRICKET_API_KEY,
        assets:
          !!env.ASSETS,
        time:
          new Date().toISOString()
      });
    }

    // =====================================================
    // WEBSITE
    // =====================================================

    if (env.ASSETS) {
      return env.ASSETS.fetch(
        request
      );
    }

    return new Response(
      "Cricket Short Worker is running, but ASSETS binding is missing.",
      {
        status: 500,
        headers: {
          "content-type":
            "text/plain; charset=UTF-8"
        }
      }
    );
  }
};


// =======================================================
// FORMAT MATCH
// =======================================================

function formatMatch(match) {
  const teams =
    Array.isArray(match?.teams)
      ? match.teams
      : [];

  const teamInfo =
    Array.isArray(match?.teamInfo)
      ? match.teamInfo
      : [];

  const team1 =
    teamInfo?.[0]?.name ||
    teams?.[0] ||
    match?.team1 ||
    "Team 1";

  const team2 =
    teamInfo?.[1]?.name ||
    teams?.[1] ||
    match?.team2 ||
    "Team 2";

  const team1Logo =
    teamInfo?.[0]?.img ||
    match?.team1Logo ||
    "";

  const team2Logo =
    teamInfo?.[1]?.img ||
    match?.team2Logo ||
    "";

  const score =
    parseScores(
      match,
      team1,
      team2
    );

  return {
    id:
      match?.id ||
      crypto.randomUUID(),

    name:
      match?.name ||
      `${team1} vs ${team2}`,

    team1,

    team2,

    team1Logo,

    team2Logo,

    score,

    status:
      getStatus(match),

    statusText:
      getStatusText(match),

    venue:
      match?.venue ||
      match?.stadium ||
      "Cricket Stadium",

    date:
      match?.date ||
      "",

    dateTimeGMT:
      match?.dateTimeGMT ||
      match?.dateTime ||
      "",

    matchType:
      String(
        match?.matchType ||
        match?.matchtype ||
        match?.type ||
        ""
      ).toLowerCase(),

    series:
      match?.seriesName ||
      match?.series ||
      match?.series_id ||
      "",

    matchStarted:
      Boolean(
        match?.matchStarted
      ),

    matchEnded:
      Boolean(
        match?.matchEnded
      )
  };
}


// =======================================================
// PARSE SCORES
// =======================================================

function parseScores(
  match,
  team1,
  team2
) {
  const rawScore =
    match?.score;

  // -----------------------------------------------
  // Normal currentMatches style:
  // score = [{inning,runs,wickets,overs}]
  // -----------------------------------------------

  if (
    Array.isArray(rawScore)
  ) {
    return rawScore
      .map(item => {
        if (
          typeof item === "string"
        ) {
          return parseScoreString(
            item
          );
        }

        return {
          inning:
            String(
              item?.inning ||
              ""
            ),

          runs:
            toNumber(
              item?.runs ??
              item?.r
            ),

          wickets:
            toNumber(
              item?.wickets ??
              item?.w
            ),

          overs:
            item?.overs ??
            item?.o ??
            null
        };
      })
      .filter(
        item =>
          item &&
          item.inning
      );
  }

  // -----------------------------------------------
  // String score from cricScore
  // -----------------------------------------------

  if (
    typeof rawScore ===
    "string"
  ) {
    return parseScoreText(
      rawScore,
      team1,
      team2
    );
  }

  // -----------------------------------------------
  // Some API responses may have
  // score as object
  // -----------------------------------------------

  if (
    rawScore &&
    typeof rawScore ===
      "object"
  ) {
    const values =
      Object.values(
        rawScore
      );

    return values
      .map(item => {
        if (
          typeof item ===
          "string"
        ) {
          return parseScoreString(
            item
          );
        }

        if (
          item &&
          typeof item ===
            "object"
        ) {
          return {
            inning:
              String(
                item.inning ||
                item.team ||
                ""
              ),

            runs:
              toNumber(
                item.runs ??
                item.r
              ),

            wickets:
              toNumber(
                item.wickets ??
                item.w
              ),

            overs:
              item.overs ??
              item.o ??
              null
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  return [];
}


// =======================================================
// PARSE SCORE TEXT
// =======================================================

function parseScoreText(
  text,
  team1,
  team2
) {
  const results = [];

  const value =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!value) {
    return results;
  }

  /*
    Examples:

    India 300/2 (41.4)
    West Indies 295/7 (50)

    or

    India: 300/2 (41.4)
    West Indies: 295/7 (50)
  */

  const teamNames = [
    team1,
    team2
  ];

  for (
    const team of teamNames
  ) {
    if (!team) {
      continue;
    }

    const escaped =
      escapeRegex(team);

    const regex =
      new RegExp(
        escaped +
          "\\s*:?\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*\\(([^)]+)\\)",
        "i"
      );

    const match =
      value.match(regex);

    if (match) {
      results.push({
        inning:
          team +
          " Inning 1",

        runs:
          Number(match[1]),

        wickets:
          Number(match[2]),

        overs:
          match[3]
      });
    }
  }

  // Generic fallback:
  // Find every 123/4 (18.2) pattern

  if (
    results.length === 0
  ) {
    const generic =
      /(\d+)\s*\/\s*(\d+)\s*\(([^)]+)\)/g;

    let found;

    while (
      (found =
        generic.exec(value))
    ) {
      results.push({
        inning:
          "Inning " +
          (results.length + 1),

        runs:
          Number(found[1]),

        wickets:
          Number(found[2]),

        overs:
          found[3]
      });
    }
  }

  return results;
}


// =======================================================
// PARSE SIMPLE SCORE STRING
// =======================================================

function parseScoreString(
  text
) {
  const value =
    String(text || "");

  const match =
    value.match(
      /(.+?)\s+(\d+)\s*\/\s*(\d+)\s*\(([^)]+)\)/
    );

  if (!match) {
    return null;
  }

  return {
    inning:
      match[1].trim(),

    runs:
      Number(match[2]),

    wickets:
      Number(match[3]),

    overs:
      match[4]
  };
}


// =======================================================
// STATUS
// =======================================================

function getStatus(match) {
  const raw = String(
    match?.status ||
    match?.statusText ||
    ""
  ).toLowerCase();

  const ended =
    Boolean(
      match?.matchEnded
    );

  const started =
    Boolean(
      match?.matchStarted
    );

  // RESULT
  if (
    ended ||
    raw.includes("won") ||
    raw.includes("draw") ||
    raw.includes("tie") ||
    raw.includes("no result") ||
    raw.includes("abandoned") ||
    raw.includes("completed") ||
    raw.includes("result")
  ) {
    return "RESULT";
  }

  // STUMPS
  if (
    raw.includes("stumps") ||
    raw.includes("innings break") ||
    raw.includes("day ")
  ) {
    return "STUMPS";
  }

  // DELAYED
  if (
    raw.includes("delay") ||
    raw.includes("rain") ||
    raw.includes("postponed") ||
    raw.includes("inspection")
  ) {
    return "DELAYED";
  }

  // LIVE
  if (
    raw.includes("live") ||
    raw.includes("opt to") ||
    raw.includes("bat") ||
    raw.includes("bowl") ||
    raw.includes("need") ||
    raw.includes("runs") ||
    started
  ) {
    return "LIVE";
  }

  // UPCOMING
  return "UPCOMING";
}


// =======================================================
// STATUS TEXT
// =======================================================

function getStatusText(
  match
) {
  return (
    match?.statusText ||
    match?.status ||
    match?.matchStatus ||
    ""
  );
}


// =======================================================
// NUMBER
// =======================================================

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


// =======================================================
// ESCAPE REGEX
// =======================================================

function escapeRegex(
  value
) {
  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}


// =======================================================
// JSON RESPONSE
// =======================================================

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "content-type":
          "application/json; charset=UTF-8",

        "cache-control":
          "no-store, no-cache, must-revalidate"
      }
    }
  );
}


// =======================================================
// ARRAY BUFFER → BASE64
// =======================================================

function arrayBufferToBase64(
  buffer
) {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length
        )
      );

    binary +=
      String.fromCharCode(
        ...chunk
      );
  }

  return btoa(binary);
}


// =======================================================
// BASE64 → ARRAY BUFFER
// =======================================================

function base64ToArrayBuffer(
  base64
) {
  let value =
    String(base64);

  if (
    value.includes(",")
  ) {
    value =
      value.split(",").pop();
  }

  const binary =
    atob(value);

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
