export default {

  async fetch(request, env) {

    const url = new URL(request.url);


    // =========================
    // AI IMAGE GENERATION API
    // =========================

    if (url.pathname === "/api/generate-image") {


      // केवल POST request की अनुमति
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


        // =========================
        // CHECK AI BINDING
        // =========================

        if (!env.AI) {

          throw new Error(
            "Workers AI binding 'AI' not found"
          );

        }


        // =========================
        // GET REQUEST DATA
        // =========================

        const body = await request.json();


        const player =
          body.player || "Cricket Player";


        const team =
          body.team || "India";


        const pose =
          body.pose || "Batting";


        const style =
          body.style || "Realistic";


        // =========================
        // NEW ADVANCED OPTIONS
        // =========================

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
        // AI IMAGE PROMPT
        // =========================

        const prompt = `

Create a high quality ${style} image of a professional cricket player.

Player name: ${player}.

The player represents the ${team} cricket team.

Jersey number: ${jersey}.

Player action and pose:

${pose}.

Tournament:

${tournament}.

Match time:

${matchTime}.

Location:

${stadium}.

The player is wearing a professional ${team} cricket uniform.

The jersey clearly displays the number ${jersey}.

Professional cricket equipment.

Realistic cricket environment.

Exciting professional cricket atmosphere.

Dynamic sports composition.

Cinematic stadium lighting.

High detail.

Sharp focus.

Professional quality.

No watermark.

No logo.

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
        // CHECK AI RESPONSE
        // =========================

        if (!aiResult) {

          throw new Error(
            "AI did not return a response"
          );

        }


        /*
          Workers AI image models may return
          the image directly as binary data.

          इसलिए पुराने base64 conversion
          को force नहीं करेंगे।
        */


        // =========================
        // RETURN IMAGE
        // =========================

        return new Response(

          aiResult,

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


    // =========================
    // STATIC WEBSITE
    // =========================

    return env.ASSETS.fetch(request);


  }

};
