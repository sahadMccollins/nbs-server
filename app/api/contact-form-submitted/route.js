import { NextResponse } from "next/server"

const ZOHO_FLOW_WEBHOOK = "https://flow.zoho.com/898405621/flow/webhook/incoming?zapikey=1001.b38a0c21ea1de515f09b65043e400905.ef94575389933bef275077d49f3ea287&isdebug=false"

export async function OPTIONS() {
    // Preflight response
    return NextResponse.json({}, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    })
}

export async function POST(req) {
    console.log("hey")
    try {
        // Parse incoming request JSON
        const body = await req.json()
        console.log("body", body)
        const { name, email, phone, subject, message, formType } = body

        // Build payload for Zoho Flow
        const payload = {
            Name: name || "Shopify Lead",
            Email: email || "",
            Phone: phone || "",
            Subject: subject || "",
            Message: message || "",
            FormType: formType || "",
        }

        // console.log("formData", payload);

        // Send to Zoho Flow webhook
        const response = await fetch(ZOHO_FLOW_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        // console.log("response", response)

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
                { success: false, error: errorText },
                { status: response.status }
            )
        }

        const result = await response.text()
        return NextResponse.json({ success: true, result })
    } catch (error) {
        console.error("Zoho Sync Error:", error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
