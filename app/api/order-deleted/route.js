import { NextResponse } from "next/server"

const SHOPIFY_BASE_URL = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01`;

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
        const payload = await req.json();
        console.log("payload", payload);

        // 🔹 Get Shopify order reference number from Zoho webhook
        const referenceNumber = payload?.salesorder?.reference_number;
        if (!referenceNumber) {
            return NextResponse.json(
                { error: "Missing reference number in Zoho webhook" },
                { status: 400 }
            );
        }

        console.log("referenceNumber", referenceNumber);

        // 🔹 Step 1: Find Shopify order by name (#1013 style)
        const orderQuery = `
            query getOrder($query: String!) {
                orders(first: 1, query: $query) {
                    edges {
                        node {
                            id
                            name
                            displayFinancialStatus
                        }
                    }
                }
            }
        `;

        const orderRes = await fetch(`${SHOPIFY_BASE_URL}/graphql.json`, {
            method: "POST",
            headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: orderQuery,
                variables: { query: `name:#${referenceNumber}` },
            }),
        });

        const orderData = await orderRes.json();
        console.log("Shopify order lookup:", JSON.stringify(orderData, null, 2));

        const shopifyOrder =
            orderData?.data?.orders?.edges?.[0]?.node || null;
        if (!shopifyOrder) {
            return NextResponse.json(
                { error: "Order not found in Shopify" },
                { status: 404 }
            );
        }

        const orderId = shopifyOrder.id; // already gid://shopify/Order/12345
        console.log("Shopify orderId:", orderId);

        // 🔹 Step 2: Cancel order using GraphQL mutation
        const cancelMutation = `
                mutation OrderCancel(
                    $orderId: ID!,
                    $notifyCustomer: Boolean,
                    $restock: Boolean!,
                    $refund: Boolean!,
                    $reason: OrderCancelReason!,
                    $staffNote: String
                ) {
                    orderCancel(
                    orderId: $orderId,
                    notifyCustomer: $notifyCustomer,
                    restock: $restock,
                    refund: $refund,
                    reason: $reason,
                    staffNote: $staffNote
                ) {
                    job {
                    id
                    done
                }
                orderCancelUserErrors {
                    field
                    message
                    code
                }
                userErrors {
                    field
                    message
                }
            }
        }
        `;

        const cancelRes = await fetch(`${SHOPIFY_BASE_URL}/graphql.json`, {
            method: "POST",
            headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: cancelMutation,
                variables: {
                    orderId,
                    notifyCustomer: true,
                    restock: true,
                    refund: false,
                    reason: "CUSTOMER",
                    staffNote: "Zoho webhook requested cancellation",
                },
            }),
        });

        const cancelData = await cancelRes.json();
        console.log("cancelData", JSON.stringify(cancelData, null, 2));

        if (cancelData?.data?.orderCancel?.orderCancelUserErrors?.length) {
            return NextResponse.json(
                {
                    error: "Failed to cancel Shopify order",
                    details: cancelData.data.orderCancel.orderCancelUserErrors,
                },
                { status: 400 }
            );
        }

        // 🔹 Step 3: Delete order after cancel
        const deleteMutation = `
                mutation OrderDelete($orderId: ID!) {
                    orderDelete(orderId: $orderId) {
                        deletedId
                        userErrors {
                        field
                        message
                        code
                    }
                }
            }
        `;

        const deleteRes = await fetch(`${SHOPIFY_BASE_URL}/graphql.json`, {
            method: "POST",
            headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: deleteMutation,
                variables: { orderId },
            }),
        });

        const deleteData = await deleteRes.json();
        console.log("deleteData", JSON.stringify(deleteData, null, 2));

        if (deleteData?.data?.orderDelete?.userErrors?.length) {
            return NextResponse.json(
                {
                    error: "Failed to delete Shopify order",
                    details: deleteData.data.orderDelete.userErrors,
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Order ${referenceNumber} canceled in Shopify`,
            cancelData,
        });
    } catch (error) {
        console.error("Cancel API error:", error);
        return NextResponse.json(
            { error: "Zoho delete webhook handler failed", details: error.message },
            { status: 500 }
        );
    }
}
