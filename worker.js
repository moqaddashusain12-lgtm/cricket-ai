export default {

  async fetch(request, env) {

    const url = new URL(request.url);


    // =====================================
    // AI IMAGE GENERATION API
    // =====================================

    if (url.pathname === "/api/generate-image") {


      // Only POST requests allowed
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


        // =====================================
        // CHECK WORKERS AI BINDING
        // =====================================

        if (!env.AI) {

          throw new Error(
            "Workers AI binding 'AI' not found"
          );

        }


        // =====================================
        // GET FORM DATA
        // =====================================

        const body = await request.json();


        const player =
          body.player || "Cricket Player";


        const team =
          body.team || "India";


        const style =
          body.style || "Realistic";


        const pose =
          body.pose || "Batting";


        const jersey =
          body.jersey || "18";


        const stadium =
          body.stadium || "Modern International Cricket Stadium";


        const matchTime =
          body.matchTime || "Day Match";


        const tournament =
          body.tournament || "T20 Cricket Match";


        // =====================================
        // AI PROMPT
        // =====================================

        const prompt = `
${style} professional cricket sports photography.

Create an exciting high-quality image of a professional cricket player.

Player name: ${player}.

The player represents: ${team}.

Player pose and action: ${pose}.

Jersey number: ${jersey}.

Tournament: ${tournament}.

Match time: ${matchTime}.

Stadium type: ${stadium}.

The player is wearing a professional ${team} cricket uniform.

Professional cricket equipment.

The player is performing the action: ${pose}.

A large professional cricket stadium.

Exciting international cricket atmosphere.

Dramatic stadium lighting.

Cinematic sports composition.

Highly detailed.

Sharp focus.

Professional sports photography.

High quality.

No watermark.

No logo.

No text.

`;


        // =====================================
        // GENERATE IMAGE WITH WORKERS AI
        // =====================================

        const aiResult = await env.AI.run(

          "@cf/black-forest-labs/flux-1-schnell",

          {

            prompt: prompt,

            steps: 4

          }

        );


        // =====================================
        // CHECK AI RESPONSE
        // =====================================

        if (!aiResult || !aiResult.image) {

          throw new Error(
            "AI did not return image data"
          );

        }


        // =====================================
        // RETURN GENERATED IMAGE
        // IMPORTANT:
        // Keeping the old working format
        // =====================================

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


    // =====================================
    // STATIC WEBSITE
    // =====================================

    return env.ASSETS.fetch(request);


  }

};
