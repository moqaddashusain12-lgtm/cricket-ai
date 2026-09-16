        if (!env.AI) {export default {

  async fetch(request, env) {

    const url = new URL(request.url);


    // =====================================
    // AI IMAGE GENERATION API
    // =====================================

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


        // =====================================
        // CHECK AI BINDING
        // =====================================



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
          body.stadium ||
          "Modern Cricket Stadium";


        const matchTime =
          body.matchTime ||
          "Day Match";


        const tournament =
          body.tournament ||
          "T20 Match";


        // =====================================
        // AI PROMPT
        // =====================================

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


        // =====================================
        // GENERATE IMAGE
        // =====================================

        const aiResult = await env.AI.run(

          "@cf/black-forest-labs/flux-1-schnell",

          {

            prompt: prompt,

            steps: 4

          }

        );


        // =====================================
        // CHECK IMAGE
        // =====================================

        if (!aiResult || !aiResult.image) {

          throw new Error(
            "AI did not return image data"
          );

        }


        // =====================================
        // BASE64 → BINARY
        // =====================================

        const binaryString =
          atob(aiResult.image);


        const bytes =
          Uint8Array.from(
            binaryString,
            char => char.charCodeAt(0)
          );


        // =====================================
        // RETURN VALID JPEG IMAGE
        // =====================================

        return new Response(

          bytes,

          {

            headers: {

              "Content-Type":
                "image/jpeg",

              "Cache-Control":
                "no-store"

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
