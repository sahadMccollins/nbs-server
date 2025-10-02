let cachedAccessToken = null;
let tokenExpiry = 0;

export async function getZohoAccessToken() {
    const now = Date.now();

    // Use cached token if not expired
    if (cachedAccessToken && now < tokenExpiry - 60000) { // refresh 1 min before expiry
        return cachedAccessToken;
    }

    // Request new token
    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: "refresh_token",
        }),
    });

    const data = await res.json();

    if (!data.access_token) {
        console.error("Failed to refresh Zoho token:", data);
        throw new Error("Zoho token refresh failed");
    }

    // Cache token and calculate expiry
    cachedAccessToken = data.access_token;
    tokenExpiry = now + (data.expires_in_sec || 3600) * 1000;

    return cachedAccessToken;
}

export async function zohoFetch(endpoint, options = {}) {
    const token = await getZohoAccessToken();

    const res = await fetch(endpoint, {
        ...options,
        headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(
            `Zoho API error: ${res.status} ${JSON.stringify(json)}`
        );
    }

    return json;
}
