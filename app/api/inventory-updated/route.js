import { NextResponse } from "next/server"
import { getZohoAccessToken } from "@/lib/zoho"

const ZOHO_ITEMS_URL = "https://www.zohoapis.com/inventory/v1/items"

export async function POST(req) {
    try {
        const payload = await req.json()
        const accessToken = await getZohoAccessToken()

        console.log("Shopify inventory webhook payload", payload)

        const { inventory_item_id, available } = payload

        if (!inventory_item_id) {
            return NextResponse.json(
                { error: "Missing inventory_item_id from Shopify payload" },
                { status: 400 }
            )
        }

        // 1️⃣ Get SKU from Shopify Inventory Item
        const shopifyItemRes = await fetch(
            `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/inventory_items/${inventory_item_id}.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        )

        const shopifyItemData = await shopifyItemRes.json()
        const sku = shopifyItemData.inventory_item?.sku

        if (!sku) {
            return NextResponse.json(
                { error: "No SKU found for this inventory_item_id" },
                { status: 400 }
            )
        }

        // 2️⃣ Find corresponding Zoho item by SKU
        const searchRes = await fetch(
            `${ZOHO_ITEMS_URL}?organization_id=${process.env.ZOHO_ORG_ID}&sku=${sku}`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            }
        )
        const searchData = await searchRes.json()

        if (!searchData.items || searchData.items.length === 0) {
            return NextResponse.json(
                { error: "Item not found in Zoho for SKU " + sku },
                { status: 404 }
            )
        }

        const zohoItem = searchData.items[0]

        // 3️⃣ Update stock in Zoho
        const updatePayload = {
            name: zohoItem.name, // required
            rate: zohoItem.rate, // required
            sku: zohoItem.sku,
            opening_stock: available, // sync from Shopify
        }

        const updateRes = await fetch(
            `${ZOHO_ITEMS_URL}/${zohoItem.item_id}?organization_id=${process.env.ZOHO_ORG_ID}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatePayload),
            }
        )

        const updateResponse = await updateRes.json()

        if (!updateRes.ok) {
            return NextResponse.json(
                { error: "Failed to update Zoho stock", details: updateResponse },
                { status: updateRes.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: `Stock updated in Zoho for SKU ${sku}`,
            zohoResponse: updateResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Inventory webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
