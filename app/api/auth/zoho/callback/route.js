import { NextResponse } from "next/server";

export async function GET(req) {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
        return NextResponse.json({ error: "No code returned" }, { status: 400 });
    }

    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            redirect_uri: process.env.ZOHO_REDIRECT_URI,
            grant_type: "authorization_code",
        }),
    });

    const data = await res.json();

    console.log("data", data)
    return NextResponse.json(data);
}
