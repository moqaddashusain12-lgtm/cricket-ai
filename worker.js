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

        // =================================================
        // IMPORTANT:
        // Do NOT filter by today's date.
        // Return ALL matches received from Cricket API.
        // =================================================

        const matches = apiData.data
          .map(formatMatch)
          .filter(match => match && match.name);

        // =================================================
        // MATCH PRIORITY
        // LIVE first
        // STUMPS second
        // DELAYED third
        // UPCOMING fourth
        // RESULT last
        // =================================================

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
          const ai = /india/i.test(
            `${a.name} ${a.team1} ${a.team2}`
          )
            ? 0
            : 1;

          const bi = /india/i.test(
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
          count: matches.length,
          updatedAt: new Date().toISOString(),
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

        if (!env.AI) {
          return json(
            {
              success: false,
              error: "Workers AI binding 'AI' is not configured"
            },
            500
          );
        }

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );

        let imageBytes;

        // -----------------------------------------------
        // Case 1: AI returns ArrayBuffer
        // -----------------------------------------------
        if (result instanceof ArrayBuffer) {
          imageBytes = result;
        }

        // -----------------------------------------------
        // Case 2: AI returns Uint8Array
        // -----------------------------------------------
        else if (
          result instanceof Uint8Array
        ) {
          imageBytes = result.buffer;
        }

        // -----------------------------------------------
        // Case 3: AI returns { image: base64 }
        // -----------------------------------------------
        else if (result?.image) {
          imageBytes =
            base64ToArrayBuffer(result.image);
        }

        // -----------------------------------------------
        // Empty response
        // -----------------------------------------------
        else {
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
    if (url.pathname === "/api/health") {
      return json({
        success: true,
        worker: "Cricket Short Worker",
        ai: !!env.AI,
        cricketApiKey: !!env.CRICKET_API_KEY,
        assets: !!env.ASSETS,
        time: new Date().toISOString()
      });
    }

    // =====================================================
    // STATIC WEBSITE
    // =====================================================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "Cricket Short Worker is running, but ASSETS binding is missing.",
      {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};


// =======================================================
// FORMAT CRICKET MATCH
// =======================================================

function formatMatch(match) {
  const score = Array.isArray(match?.score)
    ? match.score
    : [];

  const formattedScore = score
    .map(item => ({
      inning: String(item?.inning || ""),
      runs: toNumber(item?.r ?? item?.runs),
      wickets: toNumber(
        item?.w ?? item?.wickets
      ),
      overs: item?.o ?? item?.overs ?? null
    }))
    .filter(item => item.inning);

  return {
    id:
      match?.id ||
      crypto.randomUUID(),

    name:
      match?.name ||
      `${match?.teams?.[0] || "Team 1"} vs ${match?.teams?.[1] || "Team 2"}`,

    team1:
      match?.teamInfo?.[0]?.name ||
      match?.teams?.[0] ||
      match?.team1 ||
      "Team 1",

    team2:
      match?.teamInfo?.[1]?.name ||
      match?.teams?.[1] ||
      match?.team2 ||
      "Team 2",

    team1Logo:
      match?.teamInfo?.[0]?.img ||
      match?.team1Logo ||
      "",

    team2Logo:
      match?.teamInfo?.[1]?.img ||
      match?.team2Logo ||
      "",

    score: formattedScore,

    status: getStatus(match),

    statusText:
      match?.status ||
      match?.statusText ||
      "",

    venue:
      match?.venue ||
      "Cricket Stadium",

    date:
      match?.date ||
      "",

    dateTimeGMT:
      match?.dateTimeGMT ||
      "",

    matchType:
      getMatchType(match),

    series:
      match?.series_id ||
      match?.series ||
      match?.seriesName ||
      "",

    matchStarted:
      Boolean(match?.matchStarted),

    matchEnded:
      Boolean(match?.matchEnded)
  };
}


// =======================================================
// MATCH TYPE
// =======================================================

function getMatchType(match) {
  const value =
    match?.matchType ||
    match?.matchtype ||
    "";

  return String(value).toLowerCase();
}


// =======================================================
// MATCH STATUS
// =======================================================

function getStatus(match) {
  const rawStatus = String(
    match?.status ||
    match?.statusText ||
    ""
  ).toLowerCase();

  const matchEnded =
    Boolean(match?.matchEnded);

  const matchStarted =
    Boolean(match?.matchStarted);

  // RESULT
  if (
    matchEnded ||
    rawStatus.includes("won") ||
    rawStatus.includes("draw") ||
    rawStatus.includes("tie") ||
    rawStatus.includes("no result") ||
    rawStatus.includes("abandoned") ||
    rawStatus.includes("result")
  ) {
    return "RESULT";
  }

  // STUMPS
  if (
    rawStatus.includes("stumps") ||
    rawStatus.includes("innings break") ||
    rawStatus.includes("day ")
  ) {
    return "STUMPS";
  }

  // DELAYED
  if (
    rawStatus.includes("delay") ||
    rawStatus.includes("rain") ||
    rawStatus.includes("postponed") ||
    rawStatus.includes("inspection")
  ) {
    return "DELAYED";
  }

  // LIVE
  if (
    matchStarted ||
    rawStatus.includes("live") ||
    rawStatus.includes("opt to") ||
    rawStatus.includes("bat") ||
    rawStatus.includes("bowl") ||
    rawStatus.includes("need") ||
    rawStatus.includes("runs")
  ) {
    return "LIVE";
  }

  // UPCOMING
  return "UPCOMING";
}


// =======================================================
// NUMBER HELPER
// =======================================================

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


// =======================================================
// JSON RESPONSE
// =======================================================

function json(data, status = 200) {
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

function arrayBufferToBase64(buffer) {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  let binary = "";

  const chunkSize = 0x8000;

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

    binary += String.fromCharCode(
      ...chunk
    );
  }

  return btoa(binary);
}


// =======================================================
// BASE64 → ARRAY BUFFER
// =======================================================

function base64ToArrayBuffer(base64) {
  let value = String(base64);

  // Remove data URI prefix if present
  if (value.includes(",")) {
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
