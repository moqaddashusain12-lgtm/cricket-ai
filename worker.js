export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // AI CRICKET IMAGE GENERATOR
    // =========================
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        const data = await request.json();

        const prompt = `
Create a professional photorealistic cricket image.

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

Professional cricket stadium, realistic athlete,
dramatic sports lighting, detailed cricket uniform,
realistic face, realistic body proportions,
dynamic cricket action, high quality sports photography,
cinematic composition, ultra detailed, no text,
no watermark.
`;

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );

        return new Response(result, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store"
          }
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }


    // =========================
    // LIVE CRICKET SCORE
    // =========================
    if (url.pathname === "/api/score" && request.method === "GET") {
      try {

        // CRICKET_API_KEY को Cloudflare Worker Secret/Environment
        // Variable में रखें।
        const apiKey = env.CRICKET_API_KEY;

        if (!apiKey) {
          return Response.json(
            {
              success: false,
              error: "CRICKET_API_KEY is not configured."
            },
            { status: 500 }
          );
        }

        /*
          IMPORTANT:
          नीचे API URL आपके live-score provider के अनुसार बदला जा सकता है।
          अगर आपका API endpoint अलग है तो केवल API URL बदलें।
        */

        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(apiKey) +
          "&offset=0";

        const response = await fetch(apiUrl);

        if (!response.ok) {
          return Response.json(
            {
              success: false,
              error: `Live score API returned ${response.status}`
            },
            { status: 502 }
          );
        }

        const result = await response.json();

        return Response.json(result, {
          headers: {
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          }
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }


    // =========================
    // HEALTH CHECK
    // =========================
    if (url.pathname === "/api/health") {
      return Response.json({
        success: true,
        app: "Cricket Short",
        worker: "cricket-ai-app"
      });
    }


    // =========================
    // FRONTEND FILES
    // =========================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Cricket Short Worker is running.", {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
};
