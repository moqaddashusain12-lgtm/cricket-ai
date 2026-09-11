export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // AI IMAGE GENERATOR
    // =========================

    if (url.pathname === "/api/generate-image") {

      if (request.method !== "POST") {
        return Response.json(
          {
            success: false,
            error: "Only POST requests are allowed"
          },
          { status: 405 }
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

Player description: ${player}

Playing for: ${team}

The player is wearing a professional cricket uniform.

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


        // FLUX returns Base64 image
        const imageUrl =
          "data:image/jpeg;base64," +
          aiResult.image;


        return Response.json({
          success: true,
          image: imageUrl
        });


      } catch (error) {

        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );

      }

    }


    // =========================
    // CRICKET NEWS API
    // =========================

    if (url.pathname === "/api/news") {

      try {

        const rssUrl =
          "https://news.google.com/rss/search?q=latest+cricket&hl=en-IN&gl=IN&ceid=IN:en";


        const response =
          await fetch(rssUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0"
            }
          });


        if (!response.ok) {

          throw new Error(
            "News server error: " +
            response.status
          );

        }


        const xml =
          await response.text();


        const news = [];

        const itemRegex =
          /<item>([\s\S]*?)<\/item>/gi;


        let match;


        while (
          (match =
            itemRegex.exec(xml)) !== null
          &&
          news.length < 8
        ) {

          const item =
            match[1];


          const titleMatch =
            item.match(
              /<title>([\s\S]*?)<\/title>/i
            );


          const linkMatch =
            item.match(
              /<link>([\s\S]*?)<\/link>/i
            );


          if (
            titleMatch &&
            linkMatch
          ) {

            const title =
              cleanText(
                titleMatch[1]
              );


            const link =
              cleanText(
                linkMatch[1]
              );


            if (
              title &&
              link
            ) {

              news.push({
                title: title,
                link: link
              });

            }

          }

        }


        return Response.json({
          success: true,
          news: news
        });


      } catch (error) {

        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );

      }

    }


    // =========================
    // STATIC WEBSITE
    // =========================

    return env.ASSETS.fetch(request);

  }

};


// =========================
// CLEAN RSS TEXT
// =========================

function cleanText(text) {

  return String(text)

    .replace(
      /<!\[CDATA\[/g,
      ""
    )

    .replace(
      /\]\]>/g,
      ""
    )

    .replace(
      /&amp;/g,
      "&"
    )

    .replace(
      /&quot;/g,
      '"'
    )

    .replace(
      /&#39;/g,
      "'"
    )

    .replace(
      /&lt;/g,
      "<"
    )

    .replace(
      /&gt;/g,
      ">"
    )

    .trim();

}
