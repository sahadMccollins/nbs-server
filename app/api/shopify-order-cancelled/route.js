import { NextResponse } from "next/server";
import { zohoFetch } from "../utils/zoho"

const ORG_ID = process.env.ZOHO_ORG_ID;

export async function POST(req) {
    try {
        const body = await req.json();

        const { order_number } = body;

        // 1. Find Sales Order
        const salesOrderRes = await zohoFetch(
            `https://www.zohoapis.com/inventory/v1/salesorders?reference_number=${order_number}&organization_id=${ORG_ID}`
        );

        if (!salesOrderRes?.salesorders?.length) {
            return NextResponse.json({ success: false, error: "Sales Order not found" }, { status: 404 });
        }

        const salesOrder = salesOrderRes.salesorders[0];

        const salesOrderFullRes = await zohoFetch(
            `https://www.zohoapis.com/inventory/v1/salesorders/${salesOrder.salesorder_id}?organization_id=${ORG_ID}`
        );


        if (!salesOrderFullRes?.salesorder) {
            return NextResponse.json({ success: false, error: "Sales Order not found" }, { status: 404 });
        }

        const fullSalesOrderData = salesOrderFullRes?.salesorder;

        // 2. Get Invoice for this Sales Order
        const invoicesRes = await zohoFetch(
            `https://www.zohoapis.com/inventory/v1/invoices/${fullSalesOrderData.invoices[0].invoice_id}?organization_id=${ORG_ID}`
        );

        if (!invoicesRes?.invoice) {
            return NextResponse.json({ success: false, error: "No invoices found" }, { status: 404 });
        }

        const invoice = invoicesRes?.invoice;

        // 3. Create Credit Note
        const payload = {
            customer_id: invoice.customer_id,
            reference_number: `Credit-${order_number}`,
            date: new Date().toISOString().split("T")[0],
            invoice_id: invoice.invoice_id,
            place_of_supply: invoice.place_of_supply,
            line_items: invoice.line_items.map((item) => ({
                item_id: item.item_id,
                rate: item.rate,
                quantity: item.quantity,
            })),
        };

        const creditNoteRes = await zohoFetch(
            `https://www.zohoapis.com/inventory/v1/creditnotes?organization_id=${ORG_ID}`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        );

        return NextResponse.json({ success: true, data: creditNoteRes });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
