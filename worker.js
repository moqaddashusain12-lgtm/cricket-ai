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


        // =========================
        // CHECK AI BINDING
        // =========================

        if (!env.AI) {

          throw new Error(
            "Workers AI binding 'AI' not found"
          );

        }


        // =========================
        // GET DATA
        // =========================

        const body =
          await request.json();


        const player =
          body.player ||
          "Cricket Player";


        const team =
          body.team ||
          "India";


        const pose =
          body.pose ||
          "Batting";


        const style =
          body.style ||
          "Realistic";


        // =========================
        // AI PROMPT
        // =========================

        const prompt = `

Create a high quality ${style} cricket image.

A professional cricket player.

Player name: ${player}.

The player represents ${team}.

Player action and pose:

${pose}.

Professional cricket uniform.

Professional cricket equipment.

Large international cricket stadium.

Dramatic stadium lighting.

Exciting professional cricket atmosphere.

Dynamic sports composition.

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

        const aiResult =

          await env.AI.run(

            "@cf/black-forest-labs/flux-1-schnell",

            {

              prompt:
              prompt,

              steps:
              4

            }

          );


        // =========================
        // CHECK AI RESPONSE
        // =========================

        if (

          !aiResult ||

          !aiResult.image

        ) {

          throw new Error(

            "AI did not return image data"

          );

        }


        // =========================
        // BASE64 TO BINARY
        // =========================

        const binaryString =

          atob(
            aiResult.image
          );


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
        // RETURN IMAGE
        // =========================

        return new Response(

          bytes,

          {

            headers:

            {

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

            success:
            false,


            error:

              "AI Error: " +

              (

                error.message ||

                "Unknown error"

              )

          },


          {

            status:
            500

          }

        );


      }


    }


    // =========================
    // STATIC WEBSITE
    // =========================

    return env.ASSETS.fetch(
      request
    );


  }

};
