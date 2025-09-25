// import { NextResponse } from 'next/server'

// export async function GET() {
//     return NextResponse.json({ message: 'Hello from Next.js API!' })
// }

// export async function POST(req) {
//     const body = await req.json()
//     return NextResponse.json({ message: 'Data received', body })
// }

import { NextResponse } from "next/server"
import { getZohoAccessToken } from "@/lib/zoho"

const ZOHO_BASE_URL = "https://www.zohoapis.com/inventory/v1/contacts"

export async function POST(req) {
    try {
        // 1️⃣ Shopify webhook payload
        const shopifyCustomer = await req.json()

        const zohoPayload = {
            contact_name: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`,
            company_name: shopifyCustomer.default_address?.company || "",
            email: shopifyCustomer.email,
            phone: shopifyCustomer.phone,
            billing_address: {
                attention: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`,
                address: shopifyCustomer.default_address?.address1 || "",
                city: shopifyCustomer.default_address?.city || "",
                state: shopifyCustomer.default_address?.province || "",
                zip: shopifyCustomer.default_address?.zip || "",
                country: shopifyCustomer.default_address?.country || "",
            },
            contact_persons: [
                {
                    salutation: "",
                    first_name: `${shopifyCustomer.first_name}`,
                    last_name: `${shopifyCustomer.last_name}`,
                    email: `${shopifyCustomer.email}`,
                    phone: `${shopifyCustomer.phone}`,
                    is_primary_contact: true,
                }
            ],
        }

        console.log("zohoPayload", zohoPayload)

        // 2️⃣ Get fresh Zoho token
        const accessToken = await getZohoAccessToken()

        console.log("access", accessToken)

        // 3️⃣ Send customer to Zoho
        const res = await fetch(
            `${ZOHO_BASE_URL}?organization_id=${process.env.ZOHO_ORG_ID}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(zohoPayload),
            }
        )

        const zohoResponse = await res.json()

        console.log("zohoResponse", zohoResponse)

        // 4️⃣ Save Zoho contact_id into Shopify customer metafield
        if (zohoResponse.contact?.contact_id) {
            const shopifyCustomerId = shopifyCustomer.id
            const zohoContactId = zohoResponse.contact.contact_id

            await fetch(
                `https://7194k2-01.myshopify.com/admin/api/2025-01/customers/${shopifyCustomerId}/metafields.json`,
                {
                    method: "POST",
                    headers: {
                        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        metafield: {
                            namespace: "zoho",
                            key: "contact_id",
                            type: "single_line_text_field",
                            value: zohoContactId,
                        },
                    }),
                }
            )
        }


        if (!res.ok) {
            return NextResponse.json(
                { error: "Failed to create customer in Zoho", details: zohoResponse },
                { status: res.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Customer sent to Zoho",
            zohoResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
