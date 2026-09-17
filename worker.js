export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // LIVE CRICKET SCORE
    // =========================
    if (url.pathname === "/api/live-score") {
      if (request.method !== "GET") {
        return Response.json(
          {
            success: false,
            error: "Only GET requests are allowed"
          },
          { status: 405 }
        );
      }

      try {
        if (!env.CRICKET_API_KEY) {
          return Response.json(
            {
              success: false,
              error: "CRICKET_API_KEY secret not found in Cloudflare"
            },
            { status: 500 }
          );
        }

        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY) +
          "&offset=0";

        const apiResponse = await fetch(apiUrl);
        const responseText = await apiResponse.text();

        if (!apiResponse.ok) {
          return Response.json(
            {
              success: false,
              error: "Cricket API HTTP Error " + apiResponse.status
            },
            { status: 502 }
          );
        }

        let data;

        try {
          data = JSON.parse(responseText);
        } catch {
          return Response.json(
            {
              success: false,
              error: "Cricket API returned invalid JSON"
            },
            { status: 502 }
          );
        }

        // API key को browser response में वापस मत भेजो
        if (data && typeof data === "object" && "apikey" in data) {
          const { apikey, ...safeData } = data;
          data = safeData;
        }

        return Response.json(
          {
            success: true,
            data
          },
          {
            headers: {
              "Cache-Control": "no-store"
            }
          }
        );
      } catch (error) {
        console.error("Live Score Error:", error);

        return Response.json(
          {
            success: false,
            error: error?.message || "Live score API failed"
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // AI CRICKET IMAGE
    // =========================
    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return Response.json(
          {
            success: false,
            error: "Only POST requests are allowed"
          },
          { status: 405 }
        );
      }

      try {
        if (!env.AI) {
          throw new Error("Workers AI binding 'AI' not found");
        }

        const body = await request.json();

        const player = body.player || "Cricket Player";
        const team = body.team || "India";
        const style = body.style || "Realistic";
        const pose = body.pose || "Batting";
        const jersey = body.jersey || "18";
        const stadium = body.stadium || "Modern Cricket Stadium";
        const matchTime = body.matchTime || "Day Match";
        const tournament = body.tournament || "T20 Match";

        const prompt = `
Create a high quality ${style} professional cricket image.

A professional cricket player.

Player name: ${player}.

The player represents ${team}.

Player pose: ${pose}.

Jersey number: ${jersey}.

Tournament: ${tournament}.

Match time: ${matchTime}.

Stadium: ${stadium}.

Professional ${team} cricket uniform.

Professional cricket equipment.

Exciting cricket atmosphere.

Cinematic sports photography.

Dramatic stadium lighting.

Dynamic composition.

Highly detailed.

Sharp focus.

High quality.

No watermark.

No text.
`;

        const aiResult = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt,
            steps: 4
          }
        );

        if (!aiResult || !aiResult.image) {
          throw new Error("AI did not return image data");
        }

        const binaryString = atob(aiResult.image);

        const bytes = Uint8Array.from(
          binaryString,
          char => char.charCodeAt(0)
        );

        return new Response(bytes, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store"
          }
        });
      } catch (error) {
        console.error("AI Generation Error:", error);

        return Response.json(
          {
            success: false,
            error:
              "AI Error: " +
              (error.message || "Unknown error")
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // WEBSITE FILES
    // =========================
    return env.ASSETS.fetch(request);
  }
};
