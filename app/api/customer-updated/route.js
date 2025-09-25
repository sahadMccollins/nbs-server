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

        // 2️⃣ Get fresh Zoho token
        const accessToken = await getZohoAccessToken()

        console.log("accessToken", accessToken)

        // 🔑 You’ll need Zoho’s `contact_id`
        // Easiest way: search by email before updating
        const searchRes = await fetch(
            `${ZOHO_BASE_URL}?organization_id=${process.env.ZOHO_ORG_ID}&email=${shopifyCustomer.email}`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            }
        )
        const searchData = await searchRes.json()

        console.log("searchData", searchData)

        if (!searchRes.ok || !searchData.contacts || searchData.contacts.length === 0) {
            return NextResponse.json(
                { error: "Customer not found in Zoho for update" },
                { status: 404 }
            )
        }

        const contactId = searchData.contacts[0].contact_id

        console.log("contactId", contactId)

        // 3️⃣ Update Zoho contact
        const updateRes = await fetch(
            `${ZOHO_BASE_URL}/${contactId}?organization_id=${process.env.ZOHO_ORG_ID}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(zohoPayload),
            }
        )

        const updateResponse = await updateRes.json()

        if (!updateRes.ok) {
            return NextResponse.json(
                { error: "Failed to update customer in Zoho", details: updateResponse },
                { status: updateRes.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Customer updated in Zoho",
            updateResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
