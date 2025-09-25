import { NextResponse } from "next/server"
import { getZohoAccessToken } from "@/lib/zoho"

const ZOHO_ITEMS_URL = "https://www.zohoapis.com/inventory/v1/items"

export async function POST(req) {
    try {
        const shopifyProduct = await req.json()

        const zohoPayload = {
            name: shopifyProduct.title,
            rate: shopifyProduct.variants?.[0]?.price || "0",
            description: shopifyProduct.body_html || "",
            sku: shopifyProduct.variants?.[0]?.sku || "",
            product_type: "goods",
            vendor_name: shopifyProduct?.vendor || "",
            status: shopifyProduct?.status || ""
        }

        const accessToken = await getZohoAccessToken()

        // 🔑 Search Zoho by SKU first
        // const searchRes = await fetch(
        //     `${ZOHO_ITEMS_URL}?organization_id=${process.env.ZOHO_ORG_ID}&sku=${shopifyProduct.variants?.[0]?.sku}`,
        //     {
        //         headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        //     }
        // )
        // const searchRes = await fetch(
        //     `${ZOHO_ITEMS_URL}/search?organization_id=${process.env.ZOHO_ORG_ID}&cf_shopify_variant_id=${shopifyProduct.variants?.[0]?.id}`,
        //     {
        //         headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        //     }
        // )

        const searchRes = await fetch(
            `https://inventory.zoho.com/api/v1/items/search?organization_id=${process.env.ZOHO_ORG_ID}&name=${encodeURIComponent(shopifyProduct.title)}`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            }
        )


        const searchData = await searchRes.json()

        console.log("searchData", searchData)

        if (!searchRes.ok || !searchData.items || searchData.items.length === 0) {
            return NextResponse.json(
                { error: "Product not found in Zoho for update" },
                { status: 404 }
            )
        }

        const itemId = searchData.items[0].item_id

        const updateRes = await fetch(
            `${ZOHO_ITEMS_URL}/${itemId}?organization_id=${process.env.ZOHO_ORG_ID}`,
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
                { error: "Failed to update product in Zoho", details: updateResponse },
                { status: updateRes.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Product updated in Zoho",
            updateResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
