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

        // अलग-अलग Google News RSS sources
        const rssSources = [

          "https://news.google.com/rss/search?q=cricket&hl=en-IN&gl=IN&ceid=IN:en",

          "https://news.google.com/rss/search?q=India+cricket&hl=en-IN&gl=IN&ceid=IN:en",

          "https://news.google.com/rss/search?q=ICC+cricket&hl=en-IN&gl=IN&ceid=IN:en"

        ];


        let xml = null;
        let lastError = "";


        // पहला working source खोजें
        for (const rssUrl of rssSources) {

          try {

            const response =
              await fetch(rssUrl);

            if (response.ok) {

              const text =
                await response.text();

              if (text.includes("<item>")) {

                xml = text;
                break;

              }

            } else {

              lastError =
                "News source error: " +
                response.status;

            }

          } catch (error) {

            lastError =
              error.message;

          }

        }


        if (!xml) {

          throw new Error(
            lastError ||
            "News अभी उपलब्ध नहीं है"
          );

        }


        const news =
          parseRSS(xml);


        if (news.length === 0) {

          throw new Error(
            "कोई Cricket News नहीं मिली"
          );

        }


        return Response.json({
          success: true,
          news: news
        });


      } catch (error) {

        return Response.json(
          {
            success: false,
            error:
              "News load नहीं हो सकी: " +
              error.message
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
// RSS PARSER
// =========================

function parseRSS(xml) {

  const news = [];

  const itemRegex =
    /<item>([\s\S]*?)<\/item>/gi;

  let match;


  while (
    (match = itemRegex.exec(xml)) !== null
    &&
    news.length < 8
  ) {

    const item = match[1];


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
        cleanText(titleMatch[1]);


      const link =
        cleanText(linkMatch[1]);


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


  return news;

}


// =========================
// CLEAN RSS TEXT
// =========================

function cleanText(text) {

  return String(text)

    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

}
