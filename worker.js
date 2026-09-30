export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // =========================
      // HEALTH CHECK
      // =========================
      if (url.pathname === "/api/health") {
        return json({
          success: true,
          worker: "Cricket Short Worker",
          ai: !!env.AI,
          cricketApiKey: !!env.CRICKET_API_KEY,
          assets: !!env.ASSETS,
          time: new Date().toISOString()
        });
      }

      // =========================
      // DIAGNOSTIC LIVE SCORE
      // =========================
      if (url.pathname === "/api/live-score") {
        if (!env.CRICKET_API_KEY) {
          return json({
            success: false,
            error: "CRICKET_API_KEY is missing"
          }, 500);
        }

        const apiUrl =
          "https://api.cricapi.com/v1/cricScore?apikey=" +
          encodeURIComponent(env.CRICKET_API_KEY);

        const apiResponse = await fetch(apiUrl);

        const rawText = await apiResponse.text();

        // Try parsing JSON
        let apiData;

        try {
          apiData = JSON.parse(rawText);
        } catch (e) {
          return json({
            success: false,
            error: "Cricket API returned non-JSON response",
            httpStatus: apiResponse.status,
            contentType: apiResponse.headers.get("content-type"),
            rawPreview: rawText.slice(0, 2000)
          }, 502);
        }

        // =========================
        // IMPORTANT:
        // Return RAW API structure
        // =========================
        return json({
          success: true,
          diagnostic: true,
          httpStatus: apiResponse.status,
          apiSuccess: apiData?.status ?? apiData?.success ?? null,

          topLevelKeys: Object.keys(apiData || {}),

          dataType: Array.isArray(apiData?.data)
            ? "array"
            : typeof apiData?.data,

          matchCount: Array.isArray(apiData?.data)
            ? apiData.data.length
            : 0,

          firstMatch: Array.isArray(apiData?.data)
            ? apiData.data[0] || null
            : null,

          firstMatchKeys:
            Array.isArray(apiData?.data) &&
            apiData.data[0]
              ? Object.keys(apiData.data[0])
              : [],

          // First 3 matches only so response stays small
          sampleMatches:
            Array.isArray(apiData?.data)
              ? apiData.data.slice(0, 3)
              : [],

          time: new Date().toISOString()
        });
      }

      // =========================
      // AI IMAGE TEST
      // =========================
      if (url.pathname === "/api/generate-image") {
        if (!env.AI) {
          return json({
            success: false,
            error: "Workers AI binding is missing"
          }, 500);
        }

        let body = {};

        try {
          body = await request.json();
        } catch {
          return json({
            success: false,
            error: "Invalid JSON request"
          }, 400);
        }

        const prompt =
          body.prompt ||
          "Professional photorealistic cricket player in a stadium";

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: prompt
          }
        );

        const imageBytes =
          result?.image;

        if (!imageBytes) {
          return json({
            success: false,
            error: "AI returned no image"
          }, 502);
        }

        const base64 = arrayBufferToBase64(imageBytes);

        return json({
          success: true,
          image:
            "data:image/jpeg;base64," + base64
        });
      }

      // =========================
      // STATIC WEBSITE
      // =========================
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response(
        "Cricket Short Worker is running.",
        {
          status: 200,
          headers: {
            "content-type": "text/plain;charset=UTF-8"
          }
        }
      );

    } catch (error) {
      return json({
        success: false,
        error: error?.message || String(error),
        stack: error?.stack || null
      }, 500);
    }
  }
};


// ======================================
// JSON RESPONSE HELPER
// ======================================
function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "cache-control": "no-store"
      }
    }
  );
}


// ======================================
// ARRAY BUFFER → BASE64
// ======================================
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      )
    );
  }

  return btoa(binary);
}
