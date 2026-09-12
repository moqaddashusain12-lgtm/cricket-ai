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

        if (!env.AI) {

          throw new Error(
            "Workers AI binding 'AI' not found"
          );

        }


        const body = await request.json();


        const player =
          body.player || "Cricket Player";


        const team =
          body.team || "India";


        const pose =
          body.pose || "Batting";


        const style =
          body.style || "Realistic";


        const jersey =
          body.jersey || "18";


        const stadium =
          body.stadium ||
          "Large International Cricket Stadium";


        const matchTime =
          body.matchTime ||
          "Day Match";


        const tournament =
          body.tournament ||
          "International Cricket Match";


        // =========================
        // AI PROMPT
        // =========================

        const prompt = `
${style} professional cricket sports photography.

A professional cricket player.

Player description: ${player}.

Playing for ${team}.

Jersey number ${jersey}.

Player pose: ${pose}.

Tournament: ${tournament}.

Match time: ${matchTime}.

Stadium: ${stadium}.

Wearing a professional ${team} cricket uniform.

Professional cricket equipment.

Inside a large international cricket stadium.

Exciting cricket atmosphere.

Dramatic stadium lights.

Cinematic composition.

Highly detailed.

Professional sports photography.

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
        // RETURN IMAGE
        // =========================

        return new Response(
          aiResult.image,
          {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-store"
            }
          }
        );


      }

      catch (error) {

        console.error(error);

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
