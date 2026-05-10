import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

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

      console.log("[SERVER] Initializing Google Sheets API...");
      const authClient = new google.auth.JWT({
        email,
        key: key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      // Get the spreadsheet to find the first sheet's name
      let sheetName = "Sheet1";
      try {
        console.log("[SERVER] Fetching spreadsheet metadata...");
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: sheetId,
        });
        if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0 && spreadsheet.data.sheets[0].properties) {
          sheetName = spreadsheet.data.sheets[0].properties.title || "Sheet1";
        }
        console.log("[SERVER] Found active sheet tab:", sheetName);
      } catch (getErr) {
        console.warn("[SERVER] Could not fetch spreadsheet metadata. Check if the spreadsheet ID is correct and shared with the service account.", (getErr as any).message);
      }

      const values = ordersToSync.map((o: any) => {
        let dateStr = "N/A";
        try {
          const timestamp = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt;
          if (timestamp) {
            dateStr = new Date(timestamp).toLocaleString();
          } else {
            dateStr = new Date().toLocaleString();
          }
        } catch (e) {
          dateStr = "Date Parse Error";
        }

        const itemsString = (o.items || [])
          .map((item: any) => `${item.name} x${item.quantity}${item.selectedSize ? ` (${item.selectedSize})` : ""}`)
          .join(", ");

        return [
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
      });

      console.log(`[SERVER] Appending ${values.length} rows to '${sheetName}'...`);
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${sheetName}'!A:I`,
        valueInputOption: "RAW",
        requestBody: { values },
      });

      console.log("[SERVER] Sync successful.");
      return res.status(200).json({ status: "ok" });
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
