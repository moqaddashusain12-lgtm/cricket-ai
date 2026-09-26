export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // REAL LIVE CRICKET SCORE
    // ==========================================
    if (url.pathname === "/api/live-score") {
      try {
        if (!env.CRICKET_API_KEY) {
          return json({
            success: false,
            error: "CRICKET_API_KEY is not configured in Cloudflare"
          }, 500);
        }

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

        if (!response.ok) {
          return json({
            success: false,
            error: "Cricket API request failed",
            status: response.status
          }, 502);
        }

        const data = await response.json();

        if (!data || data.status !== "success") {
          return json({
            success: false,
            error: "Cricket API returned an error",
            apiResponse: data
          }, 502);
        }

        const matches = Array.isArray(data.data)
          ? data.data
          : [];

        const formattedMatches = matches.map(match => {
          const teams = Array.isArray(match.teams)
            ? match.teams
            : [];

          const scores = Array.isArray(match.score)
            ? match.score
            : [];

          const formattedTeams = teams.map(teamName => {
            const teamScores = scores.filter(score => {
              if (!score || !score.inning) return false;

              return String(score.inning)
                .toLowerCase()
                .startsWith(
                  String(teamName).toLowerCase()
                );
            });

            const latest =
              teamScores.length > 0
                ? teamScores[teamScores.length - 1]
                : null;

            return {
              name: teamName,

              score: latest
                ? `${latest.r}/${latest.w}`
                : "-",

              overs: latest
                ? String(latest.o)
                : "-"
            };
          });

          // ======================================
          // MATCH STATUS
          // ======================================

          let status = String(
            match.status || ""
          ).toUpperCase();

          if (
            status.includes("LIVE") ||
            status.includes("IN PROGRESS")
          ) {
            status = "LIVE";

          } else if (
            status.includes("STUMPS")
          ) {
            status = "STUMPS";

          } else if (
            status.includes("DELAY")
          ) {
            status = "DELAYED";

          } else if (
            status.includes("RESULT") ||
            status.includes("WON")
          ) {
            status = "RESULT";

          } else {
            status = match.matchStarted
              ? "LIVE"
              : "UPCOMING";
          }

          return {
            id: match.id || "",

            title:
              match.name ||
              `${teams[0] || "Team 1"} vs ${
                teams[1] || "Team 2"
              }`,

            status: status,

            description:
              match.matchType
                ? String(match.matchType).toUpperCase()
                : "CRICKET MATCH",

            teams: formattedTeams,

            venue:
              match.venue ||
              "Cricket Stadium",

            date:
              match.date ||
              new Date()
                .toISOString()
                .slice(0, 10),

            matchType:
              match.matchType || "",

            series:
              match.series_id || ""
          };
        });

        // ======================================
        // LIVE MATCHES FIRST
        // ======================================

        formattedMatches.sort((a, b) => {
          const order = {
            LIVE: 1,
            STUMPS: 2,
            DELAYED: 3,
            UPCOMING: 4,
            RESULT: 5
          };

          return (
            (order[a.status] || 99) -
            (order[b.status] || 99)
          );
        });

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
            error.message
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
          body.prompt ||
          "Professional photorealistic cricket player";

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
            error.message
        }, 500);
      }
    }


    // ==========================================
    // WEBSITE FILES
    // ==========================================

    return env.ASSETS.fetch(request);
  }
};


// ==========================================
// JSON RESPONSE FUNCTION
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
          "no-store",

        "Access-Control-Allow-Origin":
          "*"
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
