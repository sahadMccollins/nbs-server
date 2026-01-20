import { NextResponse } from "next/server"

const ZOHO_FLOW_BULK_ORDER_FORM = "https://flow.zoho.com/898405621/flow/webhook/incoming?zapikey=1001.c84bddda4bddf66e04028a2dd1511ef4.839036d35416229a05c4262768e3298a&isdebug=false"

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
    try {

        const apiKey = req.headers.get("x-api-key")
        if (apiKey !== 'nbs_super_secret_key_123') {
            return NextResponse.json(
                { success: false, error: "Unauthorized request" },
                { status: 401 }
            )
        }

        // Parse incoming request JSON
        const body = await req.json()
        console.log("body", body)
        let { name, email, phone, company, subject, trnNumber, message, formType } = body;

        // Build payload for Zoho Flow
        const payload = {
            Name: name || "Shopify Lead",
            Email: email || "",
            Phone: phone || "",
            Subject: subject || "",
            Message: message || "",
            FormType: formType || "",
            Company: company || "",
            trnNumber: trnNumber || "",
        }

        console.log("formData", payload);

        if (!name && !email) {
            return NextResponse.json(
                { success: false, error: "Name, Email or Phone is required" },
                { status: 400 }
            )
        }

        // Send to Zoho Flow webhook
        const response = await fetch(ZOHO_FLOW_BULK_ORDER_FORM, {
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
