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

        // ==========================================
        // CricketData Current Matches API
        // ==========================================

        const apiUrl =
          "https://api.cricapi.com/v1/currentMatches?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY) +
          "&offset=0";

        const apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json"
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

        // ==========================================
        // MATCH LIST
        // ==========================================

        let matches = [];

        if (Array.isArray(apiData?.data)) {
          matches = apiData.data;
        } else if (Array.isArray(apiData?.matches)) {
          matches = apiData.matches;
        } else if (Array.isArray(apiData?.result)) {
          matches = apiData.result;
        }

        // ==========================================
        // NORMALIZE MATCH DATA
        // ==========================================

        const normalizedMatches = matches.map(
          (match, index) => {
            const teams = Array.isArray(match?.teams)
              ? match.teams
              : [];

            const team1 =
              teams[0] ||
              match?.team1 ||
              "";

            const team2 =
              teams[1] ||
              match?.team2 ||
              "";

            const matchName =
              match?.name ||
              match?.matchType ||
              (
                team1 && team2
                  ? `${team1} vs ${team2}`
                  : "Cricket Match"
              );

            const status =
              match?.status ||
              "";

            const venue =
              match?.venue ||
              "";

            const dateTimeGMT =
              match?.dateTimeGMT ||
              match?.date ||
              "";

            // ======================================
            // SCORE ARRAY
            // ======================================

            let score = [];

            if (Array.isArray(match?.score)) {
              score = match.score.map(
                (item) => ({
                  r:
                    item?.r ??
                    item?.runs ??
                    0,

                  w:
                    item?.w ??
                    item?.wickets ??
                    0,

                  o:
                    item?.o ??
                    item?.overs ??
                    "",

                  team:
                    item?.team ||
                    item?.teamName ||
                    "",

                  inning:
                    item?.inning ||
                    item?.innings ||
                    ""
                })
              );
            }

            return {
              id:
                match?.id ||
                match?.matchId ||
                `match-${index}`,

              name: matchName,

              matchType:
                match?.matchType ||
                "",

              status,

              venue,

              dateTimeGMT,

              date:
                match?.date ||
                dateTimeGMT,

              teams,

              team1,

              team2,

              score,

              series_id:
                match?.series_id ||
                match?.seriesId ||
                "",

              series_name:
                match?.series_name ||
                match?.seriesName ||
                "",

              matchStarted:
                match?.matchStarted === true,

              matchEnded:
                match?.matchEnded === true
            };
          }
        );

        // ==========================================
        // SORT
        // LIVE FIRST
        // UPCOMING SECOND
        // RESULTS LAST
        // ==========================================

        function isLive(match) {
          const s =
            String(match?.status || "")
              .toLowerCase();

          return (
            match?.matchStarted === true &&
            match?.matchEnded !== true &&
            (
              s.includes("live") ||
              s.includes("in progress") ||
              s.includes("innings") ||
              s.includes("batting") ||
              s.includes("need") ||
              s.includes("lead") ||
              s.includes("trail")
            )
          );
        }

        function isResult(match) {
          const s =
            String(match?.status || "")
              .toLowerCase();

          return (
            match?.matchEnded === true ||
            s.includes("won") ||
            s.includes("draw") ||
            s.includes("abandoned") ||
            s.includes("no result") ||
            s.includes("complete") ||
            s.includes("finished")
          );
        }

        normalizedMatches.sort(
          (a, b) => {
            const aLive = isLive(a);
            const bLive = isLive(b);

            const aResult = isResult(a);
            const bResult = isResult(b);

            if (aLive && !bLive) return -1;
            if (!aLive && bLive) return 1;

            if (aResult && !bResult) return 1;
            if (!aResult && bResult) return -1;

            return 0;
          }
        );

        // ==========================================
        // NEVER RETURN API KEY
        // ==========================================

        return Response.json(
          {
            success: true,

            data: {
              data: normalizedMatches
            },

            source: "CricketData currentMatches",

            updatedAt:
              new Date().toISOString()
          },
          {
            headers: {
              "Cache-Control":
                "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
              Expires: "0"
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

        const body =
          await request.json();

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

        const aiResult =
          await env.AI.run(
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
