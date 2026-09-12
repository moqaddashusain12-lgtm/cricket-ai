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

        // AI binding check
        if (!env.AI) {
          throw new Error(
            "Workers AI binding 'AI' not found"
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


        // =========================
        // AI PROMPT
        // =========================

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


        // =========================
        // GENERATE IMAGE
        // =========================

        const aiResult = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt,
            steps: 4
          }
        );


        // =========================
        // CHECK IMAGE
        // =========================

        if (!aiResult || !aiResult.image) {
          throw new Error(
            "AI ने image data वापस नहीं दिया"
          );
        }


        // =========================
        // BASE64 → BINARY
        // =========================

        const binaryString =
          atob(aiResult.image);


        const bytes =
          new Uint8Array(
            binaryString.length
          );


        for (
          let i = 0;
          i < binaryString.length;
          i++
        ) {

          bytes[i] =
            binaryString.charCodeAt(i);

        }


        // =========================
        // RETURN JPEG IMAGE
        // =========================

        return new Response(
          bytes,
          {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-store"
            }
          }
        );


      } catch (error) {

        console.error(
          "AI Generation Error:",
          error
        );


        return Response.json(
          {
            success: false,

            error:
              "AI Error: " +
              (
                error.message ||
                "Unknown error"
              )
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
