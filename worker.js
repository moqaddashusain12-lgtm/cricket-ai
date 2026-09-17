export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // LIVE CRICKET SCORE
    // =========================
    if (url.pathname === "/api/live-score") {
      if (request.method !== "GET") {
        return Response.json(
          {
            success: false,
            error: "Only GET requests are allowed"
          },
          { status: 405 }
        );
      }

      try {
        if (!env.CRICKET_API_KEY) {
          return Response.json(
            {
              success: false,
              error: "CRICKET_API_KEY secret not found in Cloudflare"
            },
            { status: 500 }
          );
        }

        /*
         * CricketData eCricScore API
         *
         * यह API:
         * - current live matches
         * - recent matches
         * - upcoming matches
         *
         * देती है।
         *
         * API key केवल Worker में रहेगी।
         * Browser को API key वापस नहीं भेजी जाएगी।
         */

        const apiUrl =
          "https://api.cricapi.com/v1/cricScore?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY);

        const apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          cf: {
            cacheTtl: 0,
            cacheEverything: false
          }
        });

        const responseText = await apiResponse.text();

        if (!apiResponse.ok) {
          return Response.json(
            {
              success: false,
              error:
                "Cricket API HTTP Error " +
                apiResponse.status
            },
            { status: 502 }
          );
        }

        let apiData;

        try {
          apiData = JSON.parse(responseText);
        } catch {
          return Response.json(
            {
              success: false,
              error: "Cricket API returned invalid JSON"
            },
            { status: 502 }
          );
        }

        /*
         * API response से matches निकालना।
         *
         * अलग-अलग API versions में data अलग property
         * में आ सकता है, इसलिए multiple formats support किए हैं।
         */

        let matches = [];

        if (Array.isArray(apiData?.data)) {
          matches = apiData.data;
        } else if (Array.isArray(apiData?.matches)) {
          matches = apiData.matches;
        } else if (Array.isArray(apiData?.result)) {
          matches = apiData.result;
        } else if (Array.isArray(apiData)) {
          matches = apiData;
        }

        /*
         * cricScore के आसान text score को
         * आपके पुराने frontend के लिए score array में बदलना।
         *
         * Example:
         * "India 180/4 (20) vs Afghanistan 150/8 (20)"
         */

        function convertScoreText(match) {
          if (Array.isArray(match?.score)) {
            return match.score;
          }

          const text =
            match?.score ||
            match?.scoreText ||
            match?.scores ||
            "";

          if (typeof text !== "string" || !text.trim()) {
            return [];
          }

          const scoreArray = [];

          /*
           * अलग-अलग team score formats:
           *
           * Team 180/4 (20)
           * Team 180/4
           * Team 180 (20)
           */

          const regex =
            /([A-Za-z0-9 .&'_-]+?)\s+(\d+)(?:\/(\d+))?(?:\s*\(([\d.]+)\))?/g;

          let found;

          while ((found = regex.exec(text)) !== null) {
            const teamName = found[1].trim();

            if (!teamName) continue;

            const runs = Number(found[2] || 0);
            const wickets =
              found[3] !== undefined
                ? Number(found[3])
                : 0;

            const overs =
              found[4] !== undefined
                ? found[4]
                : "";

            scoreArray.push({
              r: runs,
              w: wickets,
              o: overs,
              inning: teamName + " Inning",
              team: teamName
            });
          }

          return scoreArray;
        }

        /*
         * हर match को पुराने currentMatches जैसे
         * predictable format में normalize करें।
         */

        const normalizedMatches = matches.map(
          (match, index) => {
            const teams = Array.isArray(match?.teams)
              ? match.teams
              : [];

            const team1 =
              match?.team1 ||
              match?.teamA ||
              match?.homeTeam ||
              teams[0] ||
              "";

            const team2 =
              match?.team2 ||
              match?.teamB ||
              match?.awayTeam ||
              teams[1] ||
              "";

            const name =
              match?.name ||
              match?.match ||
              match?.title ||
              (team1 && team2
                ? `${team1} vs ${team2}`
                : "Cricket Match");

            const status =
              match?.status ||
              match?.state ||
              match?.matchStatus ||
              "";

            const venue =
              match?.venue ||
              match?.ground ||
              match?.stadium ||
              "";

            const dateTimeGMT =
              match?.dateTimeGMT ||
              match?.date ||
              match?.startDate ||
              match?.startTime ||
              "";

            const score =
              convertScoreText(match);

            return {
              ...match,

              id:
                match?.id ||
                match?.matchId ||
                match?.match_id ||
                `cricscore-${index}`,

              name,

              status,

              venue,

              dateTimeGMT,

              date: dateTimeGMT,

              teams:
                teams.length > 0
                  ? teams
                  : [team1, team2].filter(Boolean),

              team1,

              team2,

              score
            };
          }
        );

        /*
         * API key अगर किसी response में accidentally आए
         * तो उसे browser तक नहीं भेजना।
         */

        if (
          apiData &&
          typeof apiData === "object" &&
          "apikey" in apiData
        ) {
          delete apiData.apikey;
        }

        return Response.json(
          {
            success: true,

            data: {
              data: normalizedMatches
            },

            source: "CricketData eCricScore",

            updatedAt: new Date().toISOString()
          },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0"
            }
          }
        );
      } catch (error) {
        console.error(
          "Live Score Error:",
          error
        );

        return Response.json(
          {
            success: false,
            error:
              error?.message ||
              "Live score API failed"
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // AI CRICKET IMAGE
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
        if (!env.AI) {
          throw new Error(
            "Workers AI binding 'AI' not found"
          );
        }

        const body = await request.json();

        const player =
          body.player ||
          "Cricket Player";

        const team =
          body.team ||
          "India";

        const style =
          body.style ||
          "Realistic";

        const pose =
          body.pose ||
          "Batting";

        const jersey =
          body.jersey ||
          "18";

        const stadium =
          body.stadium ||
          "Modern Cricket Stadium";

        const matchTime =
          body.matchTime ||
          "Day Match";

        const tournament =
          body.tournament ||
          "T20 Match";

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

        const aiResult = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt,
            steps: 4
          }
        );

        if (
          !aiResult ||
          !aiResult.image
        ) {
          throw new Error(
            "AI did not return image data"
          );
        }

        const binaryString =
          atob(aiResult.image);

        const bytes =
          Uint8Array.from(
            binaryString,
            char =>
              char.charCodeAt(0)
          );

        return new Response(bytes, {
          headers: {
            "Content-Type":
              "image/jpeg",

            "Cache-Control":
              "no-store"
          }
        });
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
                error?.message ||
                "Unknown error"
              )
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // WEBSITE FILES
    // =========================
    return env.ASSETS.fetch(request);
  }
};
