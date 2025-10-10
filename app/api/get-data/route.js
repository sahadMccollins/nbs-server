import { NextResponse } from "next/server";
import { zohoFetch } from "../utils/zoho";

const ORG_ID = process.env.ZOHO_ORG_ID;

export async function GET(req) {
    try {
        // 1️⃣ Get search params — example: /api/get-credit-note?credit_note_id=CN-00008
        const { searchParams } = new URL(req.url);
        const credit_note_id = searchParams.get("credit_note_id");

        console.log("Fetching credit note with ID:", credit_note_id);

        if (!credit_note_id) {
            return NextResponse.json(
                { success: false, error: "Missing credit_note_id in query" },
                { status: 400 }
            );
        }

        // 2️⃣ Fetch full credit note details from Zoho Inventory
        const creditNoteRes = await zohoFetch(
            `https://www.zohoapis.com/inventory/v1/creditnotes/${credit_note_id}?organization_id=${ORG_ID}`
        );

        console.log("Credit Note Fetch Result:", creditNoteRes);

        if (!creditNoteRes?.creditnote) {
            return NextResponse.json(
                { success: false, error: "Credit Note not found" },
                { status: 404 }
            );
        }

        // ✅ Return full credit note data
        return NextResponse.json({
            success: true,
            credit_note: creditNoteRes.creditnote,
        });

    } catch (error) {
        console.error("Error fetching credit note:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
