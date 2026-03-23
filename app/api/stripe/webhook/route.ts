import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe billing has been removed from the self-hosted build." },
    { status: 410 }
  );
}
