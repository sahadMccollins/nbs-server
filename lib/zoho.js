let cachedAccessToken = null
let tokenExpiry = 0 // timestamp in ms

export async function getZohoAccessToken() {
    const now = Date.now()

    // if we have a valid token in cache, reuse it
    if (cachedAccessToken && now < tokenExpiry) {
        return cachedAccessToken
    }

    // otherwise, refresh token from Zoho
    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: "refresh_token",
        }),
    })

    if (!res.ok) {
        throw new Error(`Failed to refresh Zoho token: ${res.status}`)
    }

    const data = await res.json()
    cachedAccessToken = data.access_token
    tokenExpiry = now + (data.expires_in - 60) * 1000 // minus 1 min safety buffer

    return cachedAccessToken
}
