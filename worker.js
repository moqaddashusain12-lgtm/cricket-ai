export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // =============================
    // AI IMAGE GENERATION API
    // =============================

    if (url.pathname === "/api/generate-image") {

      // POST request जरूरी है
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

        // Check AI Binding
        if (!env.AI) {
          return Response.json(
            {
              success: false,
              error: "Workers AI binding 'AI' नहीं मिली"
            },
            {
              status: 500
            }
          );
        }


        // Read request data
        const body = await request.json();

        const player =
          body.player || "Cricket Player";

        const team =
          body.team || "India";

        const style =
          body.style || "Realistic";


        // =============================
        // AI PROMPT
        // =============================

        const prompt = `
${style} professional cricket sports photography.

A professional cricket player named ${player}.

Playing for ${team}.

Wearing a professional cricket uniform.

Holding a cricket bat.

Inside a large international cricket stadium.

Dramatic stadium lights.

Cinematic composition.

Highly detailed.

Professional sports photography.

Sharp focus.

High quality.

No watermark.

No text.
`;


        // =============================
        // GENERATE IMAGE WITH AI
        // =============================

        const image = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt,
            steps: 4
          }
        );


        // =============================
        // RETURN IMAGE
        // =============================

        return new Response(
          image,
          {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-store"
            }
          }
        );


      } catch (error) {

        console.error("AI Generation Error:", error);

        return Response.json(
          {
            success: false,
            error:
              "AI Error: " +
              (error.message || "Unknown error")
          },
          {
            status: 500
          }
        );

      }

    }


    // =============================
    // STATIC WEBSITE
    // =============================

    return env.ASSETS.fetch(request);

  }
};
