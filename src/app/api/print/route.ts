import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const defaultPrinterName = process.env.THERMAL_PRINTER_CONNECTION || "POS-58";
    return NextResponse.json({ defaultPrinterName });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { receiptText, logoUrl, printerName } = await req.json();
    const defaultPrinterName = process.env.THERMAL_PRINTER_CONNECTION || "POS-58";
    const targetPrinterName = printerName || defaultPrinterName;

    if (logoUrl) {
      console.log("[Print Route] Printing with logo URL:", logoUrl);
    }

    if (!receiptText) {
      return NextResponse.json({ error: "Missing receiptText" }, { status: 400 });
    }

    // Prepare a temporary file inside print directory
    const tempDir = path.join(process.cwd(), "src/app/api/print/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `receipt-${Date.now()}.txt`);
    fs.writeFileSync(tempFilePath, receiptText, "utf-8");

    // Fetch and save logo if provided
    let logoTempFilePath: string | null = null;
    if (logoUrl) {
      try {
        let logoBuffer: Buffer | null = null;
        if (logoUrl.startsWith("data:")) {
          const base64Data = logoUrl.split(",")[1];
          if (base64Data) {
            logoBuffer = Buffer.from(base64Data, "base64");
          }
        } else {
          // Extract id
          let id = "";
          try {
            const urlObj = new URL(logoUrl);
            id = urlObj.searchParams.get("id") || "";
          } catch {
            const match = logoUrl.match(/[?&]id=([^&]+)/);
            if (match) {
              id = match[1];
            }
          }

          let fetchUrl = logoUrl;
          const headers: Record<string, string> = {};

          if (id && process.env.NEXT_PUBLIC_API_BASE_URL) {
            const base = process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
            fetchUrl = `${base}/assets/${id}`;
            if (process.env.DIRECTUS_STATIC_TOKEN) {
              headers["Authorization"] = `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`;
            }
          }

          console.log("[Print Route] Fetching logo from:", fetchUrl);
          const logoRes = await fetch(fetchUrl, { headers });
          if (logoRes.ok) {
            const arrayBuffer = await logoRes.arrayBuffer();
            logoBuffer = Buffer.from(arrayBuffer);
          } else {
            console.error("[Print Route] Logo fetch failed with status:", logoRes.status);
          }
        }

        if (logoBuffer) {
          logoTempFilePath = path.join(tempDir, `logo-${Date.now()}.png`);
          fs.writeFileSync(logoTempFilePath, logoBuffer);
          console.log("[Print Route] Saved temp logo to:", logoTempFilePath);
        }
      } catch (err) {
        console.error("[Print Route] Error retrieving/saving logo:", err);
      }
    }

    const psScriptPath = path.join(process.cwd(), "src/app/api/print/raw-print-helper.ps1");

    // Execute PowerShell printing process
    let command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}" -FilePath "${tempFilePath}" -PrinterName "${targetPrinterName}"`;
    if (logoTempFilePath) {
      command += ` -LogoPath "${logoTempFilePath}"`;
    }

    const result = await new Promise<{ success: boolean; output?: string; error?: string }>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        // Cleanup temp files
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          if (logoTempFilePath && fs.existsSync(logoTempFilePath)) {
            fs.unlinkSync(logoTempFilePath);
          }
        } catch (unlinkErr) {
          console.error("[Print Route] Failed to delete temp file:", unlinkErr);
        }

        if (error) {
          console.error("[Print Route] Print error details:", error);
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "PowerShell printing failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: result.output });
  } catch (error: unknown) {
    console.error("[Print Route Error]:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
