export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // =========================
    // AI IMAGE GENERATION API
    // =========================

    if (url.pathname === "/api/generate-image") {

      if (request.method !== "POST") {

        return Response.json(
          {
            success: false,
            error: "Only POST requests are allowed"
          },
          {
            status: 405
          }
        );

      }

      try {

        const body = await request.json();

        const player =
          body.player || "Cricket Player";

        const team =
          body.team || "India";

        const style =
          body.style || "Realistic";


        const prompt = `
${style} professional cricket sports photography.

A professional cricket player.

Player description: ${player}.

Playing for ${team}.

Wearing a professional cricket uniform.

Holding a cricket bat.

Inside a large international cricket stadium.

Dramatic stadium lights.

Cinematic composition.

Highly detailed.

Professional sports photography.

High quality.
`;


        const aiResult = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt,
            steps: 4
          }
        );


        // =========================
        // RETURN AI IMAGE
        // =========================

        return new Response(
          aiResult.image,
          {
            headers: {
              "Content-Type": "image/jpeg"
            }
          }
        );


      } catch (error) {

        return Response.json(
          {
            success: false,
            error: "AI Error: " + error.message
          },
          {
            status: 500
          }
        );

      }

    }


    // =========================
    // STATIC WEBSITE
    // =========================

    return env.ASSETS.fetch(request);

  }

};
