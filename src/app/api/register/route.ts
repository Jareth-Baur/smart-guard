import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // parse JSON body
    const { label, image, index } = body;

    if (!label || !image || !index) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Remove data URL prefix
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");

    // Save to /public/registered
    const dir = path.join(process.cwd(), "public", "registered");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${label}_${index}.jpg`);
    fs.writeFileSync(filePath, base64Data, "base64");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }
}
