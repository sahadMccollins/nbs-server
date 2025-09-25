import { NextResponse } from "next/server"
import { getZohoAccessToken } from "@/lib/zoho"

const ZOHO_BASE_URL = "https://www.zohoapis.com/inventory/v1"

export async function POST(req) {
    try {
        const shopifyOrder = await req.json()
        const accessToken = await getZohoAccessToken()

        // 1️⃣ Find Zoho Sales Order by reference_number (Shopify order ID)
        const searchRes = await fetch(
            `${ZOHO_BASE_URL}/salesorders?organization_id=${process.env.ZOHO_ORG_ID}&reference_number=${shopifyOrder.id}`,
            { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
        )
        const searchData = await searchRes.json()

        if (!searchData.salesorders || searchData.salesorders.length === 0) {
            return NextResponse.json(
                { error: "Sales order not found in Zoho for update" },
                { status: 404 }
            )
        }

        const salesOrderId = searchData.salesorders[0].salesorder_id

        // 2️⃣ Map line items again (lookup each SKU in Zoho)
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

        // 3️⃣ Build update payload
        const zohoPayload = {
            reference_number: shopifyOrder.id.toString(),
            date: new Date(shopifyOrder.updated_at).toISOString().split("T")[0],
            line_items: zohoLineItems,
        }

        // 4️⃣ Update Sales Order in Zoho
        const updateRes = await fetch(
            `${ZOHO_BASE_URL}/salesorders/${salesOrderId}?organization_id=${process.env.ZOHO_ORG_ID}`,
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
                { error: "Failed to update sales order in Zoho", details: updateResponse },
                { status: updateRes.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Order updated in Zoho",
            updateResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Order update webhook failed", details: error.message },
            { status: 500 }
        )
    }
}
