import { NextResponse } from "next/server";
import { zohoBooksFetch } from "../utils/zohoBooks";

const ORG_ID = process.env.ZOHO_ORG_ID;

export async function POST(req) {
    try {
        const body = await req.json();
        const order = body;

        if (!order) {
            return NextResponse.json(
                { success: false, error: "Shopify order payload missing" },
                { status: 400 }
            );
        }

        const { note, email } = order;

        console.log("Processing order:", note, email);

        // 1️⃣ Check if note (TRN) exists and is valid
        if (!note) {
            return NextResponse.json(
                { success: true, message: "No TRN provided in order note, skipping update" }
            );
        }

        const trn = note.trim();

        if (!/^\d{15}$/.test(trn)) {
            return NextResponse.json(
                { success: false, error: "Invalid TRN number. Must be 15 digits" },
                { status: 400 }
            );
        }

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Customer email not found in order" },
                { status: 400 }
            );
        }

        // 2️⃣ Find customer in Zoho Books by email
        const customerSearch = await zohoBooksFetch(
            `https://www.zohoapis.com/books/v3/contacts?email=${encodeURIComponent(
                email
            )}&organization_id=${ORG_ID}`
        );

        if (!customerSearch?.contacts?.length) {
            return NextResponse.json(
                { success: false, error: `No Zoho Books customer found for ${email}` },
                { status: 404 }
            );
        }

        const customer = customerSearch.contacts[0];

        // 3️⃣ Update the customer's tax details
        const updatePayload = {
            // vat_reg_no: trn,
            // gcc_vat_treatment: "vat_registered",
            tax_treatment: "vat_registered",
            tax_reg_no: trn,
        };

        const updateRes = await zohoBooksFetch(
            `https://www.zohoapis.com/books/v3/contacts/${customer.contact_id}?organization_id=${ORG_ID}`,
            {
                method: "PUT",
                body: JSON.stringify(updatePayload),
            }
        );

        if (updateRes?.code !== 0) {
            return NextResponse.json(
                { success: false, error: updateRes?.message || "Failed to update customer" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `TRN updated successfully for ${email}`,
            data: { customer_id: customer.contact_id, trn },
        });
    } catch (error) {
        console.error("Error updating TRN:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
