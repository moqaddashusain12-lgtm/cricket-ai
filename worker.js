export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    /*
    ==========================================
    AI IMAGE GENERATOR
    ==========================================
    */

    if (
      url.pathname === "/api/generate-image" &&
      request.method === "POST"
    ) {

      try {

        const data = await request.json();

        let prompt = "";

        // PLAYER IMAGE
        if (!data.poster && !data.card) {

          prompt = `
Photorealistic professional cricket player portrait,
player name ${data.playerName},
representing ${data.team},
${data.playerType},
${data.hand},
performing ${data.pose},
wearing ${data.jersey} cricket jersey,
jersey number ${data.number},
playing at a ${data.stadium},
${data.weather},
${data.matchTime},
${data.camera},
tournament ${data.tournament},
professional cricket photography,
dramatic stadium lighting,
high detail,
realistic face,
athletic body,
cinematic sports photography,
sharp focus,
premium cricket sports poster,
vertical composition,
no text,
no watermark
`;

        }

        // POSTER
        else if (data.poster) {

          prompt = `
Professional cricket match poster,
${data.playerName} representing ${data.team},
${data.match},
${data.tournament},
${data.stadium},
packed cricket stadium,
dramatic floodlights,
flying cricket ball,
intense sports atmosphere,
photorealistic cricket photography,
cinematic lighting,
high contrast,
ultra detailed,
vertical 9:16,
large clean empty space at top for headline,
no text,
no watermark
`;

        }

        // PLAYER CARD
        else if (data.card) {

          prompt = `
Professional cricket player trading card,
player ${data.playerName},
team ${data.team},
role ${data.role},
jersey number ${data.number},
${data.hand},
${data.level} cricket player,
${data.jersey} cricket jersey,
premium sports card design,
dramatic cricket stadium background,
professional cricket photography,
cinematic lighting,
ultra detailed,
portrait composition,
vertical 2:3,
clean professional card layout,
no readable text,
no watermark
`;

        }

        const aiResult = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );

        if (!aiResult || !aiResult.image) {

          return jsonResponse({
            error: "AI image was not returned"
          }, 500);

        }

        /*
        Cloudflare Workers AI normally returns
        the generated image as base64.
        */

        const imageUrl =
          "data:image/jpeg;base64," +
          aiResult.image;

        return jsonResponse({
          success: true,
          image: imageUrl
        });

      } catch (error) {

        return jsonResponse({
          error: error.message || "Image generation failed"
        }, 500);

      }

    }


    /*
    ==========================================
    LIVE SCORE
    ==========================================

    फिलहाल sample structure रखा गया है।
    यहां आपका real cricket API लगाया जा सकता है।
    ==========================================
    */

    if (url.pathname === "/api/live-score") {

      const matches = [
        {
          title: "India vs Australia",
          status: "LIVE",
          description: "Live Cricket Match",
          teams: [
            {
              name: "India",
              score: "120/3",
              overs: "15.2"
            },
            {
              name: "Australia",
              score: "-",
              overs: "-"
            }
          ],
          venue: "International Cricket Stadium",
          date: new Date().toLocaleDateString("en-IN")
        },

        {
          title: "England vs South Africa",
          status: "LIVE",
          description: "International Cricket",
          teams: [
            {
              name: "England",
              score: "145/5",
              overs: "18.1"
            },
            {
              name: "South Africa",
              score: "-",
              overs: "-"
            }
          ],
          venue: "International Cricket Ground",
          date: new Date().toLocaleDateString("en-IN")
        }
      ];

      return jsonResponse({
        success: true,
        matches: matches
      });

    }


    /*
    ==========================================
    STATIC WEBSITE
    ==========================================
    */

    return env.ASSETS.fetch(request);

  }
};


/*
==========================================
JSON RESPONSE HELPER
==========================================
*/

function jsonResponse(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );

}
