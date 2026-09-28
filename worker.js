export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================
    // AI CRICKET IMAGE GENERATOR
    // =========================================
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        const data = await request.json();

        const prompt = `
Create a professional photorealistic cricket player image.

Player Name: ${data.playerName || "Cricket Star"}
Team: ${data.team || "India"}
Pose: ${data.pose || "Batting"}
Player Type: ${data.playerType || "Batsman"}
Playing Hand: ${data.playingHand || "Right"}
Image Style: ${data.imageStyle || "Realistic"}
Jersey Color: ${data.jerseyColor || "Blue"}
Jersey Number: ${data.jerseyNumber || "18"}
Stadium: ${data.stadium || "International Stadium"}
Weather: ${data.weather || "Clear"}
Match Time: ${data.matchTime || "Day"}
Camera: ${data.camera || "Front"}
Tournament: ${data.tournament || "T20 World Cup"}

Professional cricket stadium,
realistic athletic cricket player,
detailed cricket uniform,
realistic face,
realistic body proportions,
dynamic cricket action,
dramatic sports lighting,
cinematic sports photography,
ultra detailed,
high quality,
sharp focus,
professional cricket poster style,
no text,
no watermark.
`;

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );

        if (!result || !result.image) {
          return Response.json(
            {
              success: false,
              error: "Workers AI did not return an image.",
              details: result
            },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }

        const binaryString = atob(result.image);

        const imageBytes = Uint8Array.from(
          binaryString,
          char => char.charCodeAt(0)
        );

        return new Response(imageBytes, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          }
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: "AI image generation failed.",
            details: error?.message || String(error)
          },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }


    // =========================================
    // LIVE CRICKET SCORE
    // =========================================
    if (url.pathname === "/api/score" && request.method === "GET") {
      try {
        const apiKey = env.CRICKET_API_KEY;

        if (!apiKey) {
          return Response.json(
            {
              success: false,
              error: "CRICKET_API_KEY is not configured in Cloudflare."
            },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }

        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(apiKey) +
          "&offset=0";

        const response = await fetch(apiUrl);

        if (!response.ok) {
          return Response.json(
            {
              success: false,
              error: `Live score API returned HTTP ${response.status}`
            },
            {
              status: 502,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }

        const result = await response.json();

        return Response.json(result, {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          }
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: "Live score request failed.",
            details: error?.message || String(error)
          },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }


    // =========================================
    // HEALTH CHECK
    // =========================================
    if (url.pathname === "/api/health") {
      return Response.json(
        {
          success: true,
          app: "Cricket Short",
          worker: "cricket-ai-app",
          ai: !!env.AI,
          cricketApiKey: !!env.CRICKET_API_KEY
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }


    // =========================================
    // FRONTEND FILES
    // =========================================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "Cricket Short Worker is running.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      }
    );
  }
};
