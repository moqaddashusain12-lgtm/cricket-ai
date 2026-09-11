export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle browser preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers,
      });
    }

    // AI Image Generation API
    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({
            error: "Only POST requests are allowed",
          }),
          {
            status: 405,
            headers,
          }
        );
      }

      try {
        const body = await request.json();

        const player = body.player || "Cricket Player";
        const team = body.team || "International Cricket Team";
        const style = body.style || "Realistic";

        const prompt = `
A ${style} professional cricket player named ${player},
playing for ${team}.
Wearing professional cricket uniform,
holding a cricket bat,
inside a beautiful international cricket stadium,
dramatic stadium lights,
highly detailed,
cinematic photography,
realistic face,
professional sports photography,
high quality.
        `;

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt,
            steps: 4
          }
        );

        const imageUrl =
          "data:image/jpeg;base64," + result.image;

        return new Response(
          JSON.stringify({
            success: true,
            image: imageUrl,
            player: player,
            team: team,
            style: style
          }),
          {
            status: 200,
            headers,
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          {
            status: 500,
            headers,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Cricket AI API is running!"
      }),
      {
        status: 200,
        headers,
      }
    );
  }
};
