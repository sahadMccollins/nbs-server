import { NextResponse } from "next/server"
import { getZohoAccessToken } from "@/lib/zoho"

const ZOHO_BASE_URL = "https://www.zohoapis.com/inventory/v1"

export async function POST(req) {
    try {
        const shopifyOrder = await req.json()
        const accessToken = await getZohoAccessToken()

        // 1️⃣ Get Zoho customer (by email)
        const customerRes = await fetch(
            `${ZOHO_BASE_URL}/contacts?organization_id=${process.env.ZOHO_ORG_ID}&email=${shopifyOrder.customer.email}`,
            { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
        )
        const customerData = await customerRes.json()

        console.log("customerRes", customerRes);
        
        if (!customerData.contacts || customerData.contacts.length === 0) {
            return NextResponse.json(
                { error: "Customer not found in Zoho" },
                { status: 404 }
            )
        }
        const contactId = customerData.contacts[0].contact_id

        // 2️⃣ Map line items (lookup items by SKU in Zoho)
        const zohoLineItems = []
        for (const item of shopifyOrder.line_items) {
            const itemRes = await fetch(
                `${ZOHO_BASE_URL}/items?organization_id=${process.env.ZOHO_ORG_ID}&sku=${item.sku}`,
                { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
            )
            const itemData = await itemRes.json()
            if (itemData.items && itemData.items.length > 0) {
                zohoLineItems.push({
                    item_id: itemData.items[0].item_id,
                    quantity: item.quantity,
                    rate: item.price,
                })
            }
        }

        // 3️⃣ Build Zoho sales order payload
        const zohoPayload = {
            customer_id: contactId,
            reference_number: shopifyOrder.id.toString(),
            date: new Date(shopifyOrder.created_at).toISOString().split("T")[0],
            line_items: zohoLineItems,
        }

        // 4️⃣ Create sales order in Zoho
        const orderRes = await fetch(
            `${ZOHO_BASE_URL}/salesorders?organization_id=${process.env.ZOHO_ORG_ID}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(zohoPayload),
            }
        )

        const orderResponse = await orderRes.json()

        if (!orderRes.ok) {
            return NextResponse.json(
                { error: "Failed to create order in Zoho", details: orderResponse },
                { status: orderRes.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Order created in Zoho",
            orderResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Order webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
