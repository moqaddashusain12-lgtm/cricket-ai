export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // AI Image Generation API
    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Only POST requests are allowed"
          }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      try {
        const body = await request.json();

        const player =
          body.player || "Cricket Player";

        const team =
          body.team || "International Cricket Team";

        const style =
          body.style || "Realistic";


        const prompt = `
${style} professional sports photography.

A cricket player inspired by the description:
Player name: ${player}
Team: ${team}

The player is wearing a professional cricket uniform,
holding a cricket bat,
standing inside a large international cricket stadium.

Dramatic stadium lights,
cinematic composition,
highly detailed,
professional sports photography.
`;


        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );


        return new Response(
          result,
          {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-store"
            }
          }
        );

      } catch (error) {

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

      }
    }


    // Cricket News API
    if (url.pathname === "/api/news") {

      try {

        const rssUrl =
          "https://news.google.com/rss/search?q=cricket&hl=en-IN&gl=IN&ceid=IN:en";


        const response =
          await fetch(rssUrl);


        if (!response.ok) {
          throw new Error(
            "News server error"
          );
        }


        const xml =
          await response.text();


        const items =
          [...xml.matchAll(
            /<item>([\s\S]*?)<\/item>/gi
          )];


        const news =
          items
            .slice(0, 8)
            .map((item) => {

              const content =
                item[1];


              const titleMatch =
                content.match(
                  /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i
                ) ||
                content.match(
                  /<title>([\s\S]*?)<\/title>/i
                );


              const linkMatch =
                content.match(
                  /<link>([\s\S]*?)<\/link>/i
                );


              const title =
                titleMatch
                  ? titleMatch[1]
                  : "Cricket News";


              const link =
                linkMatch
                  ? linkMatch[1]
                  : "#";


              return {
                title:
                  cleanText(title),

                link:
                  cleanText(link)
              };

            });


        return new Response(
          JSON.stringify({
            success: true,
            news: news
          }),
          {
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      } catch (error) {

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      }

    }


    // बाकी requests static files को serve करेंगे
    return env.ASSETS.fetch(request);

  }
};


// RSS text साफ करने के लिए
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
