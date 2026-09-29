export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================
    // CORS
    // =========================================
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    // =========================================
    // AI CRICKET IMAGE GENERATOR
    // =========================================
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {

        // Check Workers AI binding
        if (!env.AI) {
          return Response.json(
            {
              success: false,
              error: "Workers AI binding 'AI' is missing.",
              message: "Check Cloudflare Workers > Settings > Bindings > Workers AI."
            },
            {
              status: 500,
              headers: corsHeaders
            }
          );
        }

        // Read request body
        const data = await request.json();

        // Build AI prompt
        const prompt = `
Create a professional photorealistic cricket player sports photograph.

Player Name: ${data.playerName || "Cricket Star"}
Team: ${data.team || "India"}
Pose: ${data.pose || "Batting"}
Player Type: ${data.playerType || "Batsman"}
Playing Hand: ${data.playingHand || "Right"}
Image Style: ${data.imageStyle || "Realistic"}
Jersey Color: ${data.jerseyColor || "Blue"}
Jersey Number: ${data.jerseyNumber || "18"}
Stadium: ${data.stadium || "Modern Stadium"}
Weather: ${data.weather || "Clear"}
Match Time: ${data.matchTime || "Day"}
Camera Angle: ${data.camera || "Front"}
Tournament: ${data.tournament || "T20 World Cup"}

Create a realistic professional cricket player in an authentic cricket stadium.

The player should have:
- realistic athletic body proportions
- realistic cricket equipment
- detailed cricket jersey
- correct jersey number
- natural face
- realistic skin texture
- realistic hands and fingers
- professional cricket batting pose
- dynamic sports photography
- cinematic stadium lighting
- sharp focus
- highly detailed image
- premium sports poster quality

Background:
professional modern cricket stadium,
large cricket crowd,
realistic stadium lights,
natural cricket field,
authentic match atmosphere.

Composition:
front camera angle,
full body cricket player,
centered subject,
professional sports photography.

Important:
No text.
No captions.
No logos added by the AI.
No watermark.
No distorted body.
No extra limbs.
No duplicate player.
`;


        // =========================================
        // RUN CLOUDFLARE WORKERS AI
        // =========================================
        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt,
            seed: Math.floor(Math.random() * 1000000000)
          }
        );


        // =========================================
        // CHECK AI RESPONSE
        // =========================================
        if (!result) {
          return Response.json(
            {
              success: false,
              error: "Workers AI returned an empty response."
            },
            {
              status: 500,
              headers: corsHeaders
            }
          );
        }

        if (!result.image) {
          return Response.json(
            {
              success: false,
              error: "Workers AI did not return an image.",
              responseKeys: Object.keys(result)
            },
            {
              status: 500,
              headers: corsHeaders
            }
          );
        }


        // =========================================
        // BASE64 → IMAGE BYTES
        // =========================================
        const binaryString = atob(result.image);

        const imageBytes = Uint8Array.from(
          binaryString,
          (char) => char.charCodeAt(0)
        );


        // =========================================
        // RETURN IMAGE
        // =========================================
        return new Response(imageBytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
            "Content-Length": imageBytes.length.toString()
          }
        });

      } catch (error) {

        console.error("AI GENERATION ERROR:", error);

        return Response.json(
          {
            success: false,
            error: "AI image generation failed.",
            details: error?.message || String(error)
          },
          {
            status: 500,
            headers: corsHeaders
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
              headers: corsHeaders
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
              headers: corsHeaders
            }
          );
        }


        const result = await response.json();


        return Response.json(result, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Cache-Control": "no-store"
          }
        });

      } catch (error) {

        console.error("CRICKET API ERROR:", error);

        return Response.json(
          {
            success: false,
            error: "Live score request failed.",
            details: error?.message || String(error)
          },
          {
            status: 500,
            headers: corsHeaders
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

          workersAI: !!env.AI,

          cricketApiKey: !!env.CRICKET_API_KEY,

          endpoints: {
            generate: "/api/generate",
            score: "/api/score",
            health: "/api/health"
          }
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    // =========================================
    // FRONTEND FILES
    // =========================================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }


    // =========================================
    // DEFAULT
    // =========================================
    return new Response(
      "Cricket Short Worker is running.",
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain"
        }
      }
    );
  }
};
