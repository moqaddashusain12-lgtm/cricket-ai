export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // REAL-TIME CRICKET SCORE — CRICKETDATA.ORG
    // ==========================================
    if (url.pathname === "/api/live-score") {
      // Only GET is allowed
      if (request.method !== "GET") {
        return json({
          success: false,
          error: "Only GET requests are allowed"
        }, 405);
      }

      try {
        // --------------------------------------
        // CHECK API KEY
        // --------------------------------------
        if (!env.CRICKET_API_KEY) {
          return json({
            success: false,
            error:
              "CRICKET_API_KEY is not configured in Cloudflare Worker Secrets"
          }, 500);
        }

        // --------------------------------------
        // CRICKETDATA CURRENT MATCHES API
        // --------------------------------------
        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches" +
          "?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY) +
          "&offset=0";

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        // --------------------------------------
        // API HTTP ERROR
        // --------------------------------------
        if (!response.ok) {
          return json({
            success: false,
            error: "CricketData API request failed",
            status: response.status,
            statusText: response.statusText
          }, 502);
        }

        // --------------------------------------
        // READ JSON
        // --------------------------------------
        const data = await response.json();

        if (!data || data.status !== "success") {
          return json({
            success: false,
            error: "CricketData API returned an error",
            apiStatus: data?.status || "unknown",
            apiInfo: data?.info || null
          }, 502);
        }

        const matches = Array.isArray(data.data)
          ? data.data
          : [];

        // ======================================
        // FORMAT MATCHES
        // ======================================

        const formattedMatches = matches.map(match => {
          const teams = Array.isArray(match.teams)
            ? match.teams
            : [];

          const scores = Array.isArray(match.score)
            ? match.score
            : [];

          // ------------------------------------
          // TEAM SCORES
          // ------------------------------------
          const formattedTeams = teams.map(teamName => {
            const teamScores = scores.filter(score => {
              if (!score || !score.inning) {
                return false;
              }

              const inning = String(
                score.inning
              ).toLowerCase();

              const team = String(
                teamName
              ).toLowerCase();

              return (
                inning === team ||
                inning.startsWith(team)
              );
            });

            // Latest score for this team
            const latest =
              teamScores.length > 0
                ? teamScores[teamScores.length - 1]
                : null;

            let scoreText = "-";
            let oversText = "-";

            if (latest) {
              const runs =
                latest.r !== undefined
                  ? latest.r
                  : 0;

              const wickets =
                latest.w !== undefined
                  ? latest.w
                  : 0;

              const overs =
                latest.o !== undefined
                  ? latest.o
                  : 0;

              scoreText =
                `${runs}/${wickets}`;

              oversText =
                String(overs);
            }

            return {
              name: teamName,
              score: scoreText,
              overs: oversText
            };
          });

          // ======================================
          // MATCH STATUS
          // ======================================

          const rawStatus =
            String(
              match.status || ""
            ).trim();

          const statusText =
            rawStatus.toUpperCase();

          let status = "UPCOMING";

          // LIVE
          if (
            statusText.includes("LIVE") ||
            statusText.includes("IN PROGRESS") ||
            statusText.includes("PLAYING") ||
            statusText.includes("DAY") &&
            statusText.includes("SESSION")
          ) {
            status = "LIVE";
          }

          // STUMPS / BREAK
          else if (
            statusText.includes("STUMPS") ||
            statusText.includes("STUMP") ||
            statusText.includes("LUNCH") ||
            statusText.includes("TEA") ||
            statusText.includes("BREAK")
          ) {
            status = "STUMPS";
          }

          // DELAYED
          else if (
            statusText.includes("DELAY") ||
            statusText.includes("RAIN") ||
            statusText.includes("ABANDONED") &&
            !statusText.includes("WON")
          ) {
            status = "DELAYED";
          }

          // RESULT
          else if (
            statusText.includes("RESULT") ||
            statusText.includes("WON BY") ||
            statusText.includes("WON") ||
            statusText.includes("DRAWN") ||
            statusText.includes("TIED") ||
            statusText.includes("NO RESULT")
          ) {
            status = "RESULT";
          }

          // FALLBACK
          else if (match.matchStarted === true) {
            status = "LIVE";
          }

          // ------------------------------------
          // MATCH TYPE
          // ------------------------------------
          let matchType =
            match.matchType || "cricket";

          matchType =
            String(matchType)
              .toUpperCase();

          // ------------------------------------
          // DATE
          // ------------------------------------
          let matchDate =
            match.date || "";

          if (!matchDate) {
            matchDate =
              new Date()
                .toISOString()
                .slice(0, 10);
          }

          // ------------------------------------
          // TITLE
          // ------------------------------------
          const title =
            match.name ||
            (
              teams.length >= 2
                ? `${teams[0]} vs ${teams[1]}`
                : "Cricket Match"
            );

          return {
            id:
              match.id ||
              `${title}-${matchDate}`,

            title: title,

            status: status,

            statusText: rawStatus,

            description:
              matchType,

            teams:
              formattedTeams,

            venue:
              match.venue ||
              "Cricket Stadium",

            date:
              matchDate,

            matchType:
              match.matchType ||
              "",

            series:
              match.series_id ||
              "",

            seriesName:
              match.series_name ||
              "",

            matchStarted:
              Boolean(match.matchStarted),

            matchEnded:
              Boolean(match.matchEnded)
          };
        });

        // ======================================
        // SORT
        // LIVE FIRST
        // ======================================

        const order = {
          LIVE: 1,
          STUMPS: 2,
          DELAYED: 3,
          UPCOMING: 4,
          RESULT: 5
        };

        formattedMatches.sort((a, b) => {
          return (
            (order[a.status] || 99) -
            (order[b.status] || 99)
          );
        });

        // ======================================
        // RESPONSE
        // ======================================

        return json({
          success: true,

          updatedAt:
            new Date().toISOString(),

          count:
            formattedMatches.length,

          matches:
            formattedMatches
        });

      } catch (error) {
        return json({
          success: false,

          error:
            "Unable to fetch live cricket scores",

          message:
            error?.message ||
            "Unknown error"
        }, 500);
      }
    }

    // ==========================================
    // AI CRICKET IMAGE GENERATOR
    // ==========================================

    if (
      url.pathname === "/api/generate-image" &&
      request.method === "POST"
    ) {
      try {
        const body =
          await request.json();

        const prompt =
          body?.prompt ||
          "Professional photorealistic cricket player";

        if (!env.AI) {
          return json({
            success: false,
            error:
              "Cloudflare AI binding is not configured"
          }, 500);
        }

        const result =
          await env.AI.run(
            "@cf/black-forest-labs/flux-1-schnell",
            {
              prompt: prompt
            }
          );

        const contentType =
          result?.headers?.get(
            "content-type"
          ) || "image/jpeg";

        const buffer =
          await result.arrayBuffer();

        const base64 =
          arrayBufferToBase64(buffer);

        return json({
          success: true,

          image:
            `data:${contentType};base64,${base64}`
        });

      } catch (error) {
        return json({
          success: false,

          error:
            error?.message ||
            "AI image generation failed"
        }, 500);
      }
    }

    // ==========================================
    // WEBSITE / PUBLIC FILES
    // ==========================================

    return env.ASSETS.fetch(request);
  }
};


// ==========================================
// JSON RESPONSE
// ==========================================

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status: status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Headers":
          "Content-Type",

        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS"
      }
    }
  );
}


// ==========================================
// ARRAY BUFFER → BASE64
// ==========================================

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
