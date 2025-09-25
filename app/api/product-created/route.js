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
            status: shopifyProduct?.status || "",
            custom_fields: [
                { customfield_id: "6594601000000319031", value: shopifyProduct.id },
                { customfield_id: "6594601000000319037", value: shopifyProduct.variants?.[0]?.id },
            ]
        }

        const accessToken = await getZohoAccessToken()

        console.log("lataccesstoken", accessToken);

        const res = await fetch(
            `${ZOHO_ITEMS_URL}?organization_id=${process.env.ZOHO_ORG_ID}`,
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

        if (!res.ok) {
            return NextResponse.json(
                { error: "Failed to create product in Zoho", details: zohoResponse },
                { status: res.status }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Product created in Zoho",
            zohoResponse,
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Webhook processing failed", details: error.message },
            { status: 500 }
        )
    }
}
