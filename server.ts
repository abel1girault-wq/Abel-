import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Health check for Render
  app.get("/api/health", (req, res) => {
    res.json({ status: "alive" });
  });

  // API route for syncing with Google Sheets
  app.post("/api/sync-order", async (req, res) => {
    console.log("[SERVER] Incoming sync request...");
    try {
      const { order, orders } = req.body;
      const ordersToSync = orders || (order ? [order] : []);

      if (ordersToSync.length === 0) {
        console.warn("[SERVER] Sync failed: No orders provided");
        return res.status(400).json({ error: "No orders provided" });
      }
      
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const key = process.env.GOOGLE_PRIVATE_KEY;
      let rawSheetId = process.env.GOOGLE_SHEET_ID;

      if (!email || !key || !rawSheetId) {
        console.warn("[SERVER] Google Sheets credentials missing in environment");
        return res.status(200).json({ status: "skipped", message: "Credentials not configured" });
      }

      let sheetId = rawSheetId;
      // Extract sheet ID if a full URL was provided
      if (sheetId.includes("spreadsheets/d/")) {
        const match = sheetId.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          sheetId = match[1];
          console.log("[SERVER] Extracted sheet ID from URL:", sheetId.slice(0, 5) + "...");
        }
      } else if (sheetId.includes("/")) {
        sheetId = sheetId.split("/")[0];
      }

      console.log(`[SERVER] Processing sync for ${ordersToSync.length} orders...`);
      
      const authClient = new google.auth.JWT({
        email,
        key: key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      let sheetName = "Sheet1";
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0 && spreadsheet.data.sheets[0].properties) {
          sheetName = spreadsheet.data.sheets[0].properties.title || "Sheet1";
        }
      } catch (err) {
        console.warn("[SERVER] Metadata fetch failed, defaulting to Sheet1");
      }

      // Fetch existing IDs from Column B to prevent duplicates
      let existingIds: string[] = [];
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${sheetName}'!B:B`,
        });
        existingIds = (response.data.values || []).map(row => row[0]);
      } catch (err) {
        console.warn("[SERVER] Could not fetch existing IDs, will treat all as new.");
      }

      const results = { updated: 0, appended: 0 };
      
      for (const o of ordersToSync) {
        let dateStr = "N/A";
        try {
          const timestamp = o.createdAt?.seconds 
            ? o.createdAt.seconds * 1000 
            : (typeof o.createdAt === 'string' ? new Date(o.createdAt).getTime() : o.createdAt);
            
          if (timestamp && !isNaN(timestamp)) {
            dateStr = new Date(timestamp).toLocaleString('en-US', { timeZone: 'UTC' });
          } else {
            dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
          }
        } catch (e) {
          dateStr = new Date().toLocaleString();
        }

        const itemsString = (o.items || [])
          .map((item: any) => `${item.name} x${item.quantity}${item.selectedSize ? ` (${item.selectedSize})` : ""}`)
          .join(", ");

        const rowValues = [
          dateStr,
          o.id || "N/A",
          o.customerName || "N/A",
          o.customerEmail || "N/A",
          o.customerPhone || "N/A",
          itemsString || "No items",
          o.total || 0,
          o.status || "pending",
          o.location || "N/A"
        ];

        const existingIdx = existingIds.indexOf(o.id);
        if (existingIdx !== -1) {
          // Update existing row
          const rowNum = existingIdx + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'${sheetName}'!A${rowNum}:I${rowNum}`,
            valueInputOption: "RAW",
            requestBody: { values: [rowValues] },
          });
          results.updated++;
        } else {
          // Append new row
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `'${sheetName}'!A:I`,
            valueInputOption: "RAW",
            requestBody: { values: [rowValues] },
          });
          existingIds.push(o.id);
          results.appended++;
        }
      }

      console.log(`[SERVER] Sync outcome: ${results.updated} updated, ${results.appended} appended.`);
      return res.status(200).json({ status: "ok", results });
    } catch (error: any) {
      console.error("[SERVER] Critical Sync Error:", error.message || error);
      return res.status(500).json({ 
        error: "Failed to sync to Google Sheets", 
        details: error.message || String(error),
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Listening on port ${PORT}`);
  });
}

startServer();
