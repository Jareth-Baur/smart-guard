import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const folderPath = path.join(
      process.cwd(),
      "public",
      "registered"
    );

    const files = fs.readdirSync(folderPath);

    const images = files.filter((file) =>
      file.toLowerCase().endsWith(".jpg")
    );

    return NextResponse.json(images);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read folder" },
      { status: 500 }
    );
  }
}
