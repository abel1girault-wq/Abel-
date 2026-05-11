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
      if (sheetId.includes("spreadsheets/d/")) {
        const match = sheetId.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) sheetId = match[1];
      } else if (sheetId.includes("/")) {
        sheetId = sheetId.split("/")[0];
      }

      const authClient = new google.auth.JWT({
        email,
        key: key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      // Determine sheet names
      let activeSheetName = "Orders";
      let completedSheetName = "Completed";

      // Try to find if these sheets exist, if not create them
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetTitles = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
        
        const sheetsToCreate = [];
        if (!sheetTitles.includes(activeSheetName)) sheetsToCreate.push(activeSheetName);
        if (!sheetTitles.includes(completedSheetName)) sheetsToCreate.push(completedSheetName);

        if (sheetsToCreate.length > 0) {
          console.log(`[SERVER] Creating missing sheets: ${sheetsToCreate.join(", ")}`);
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: sheetsToCreate.map(title => ({
                addSheet: { properties: { title } }
              }))
            }
          });
        }
      } catch (err) {
        console.warn("[SERVER] Metadata fetch/create failed, defaulting to Sheet1", err);
        activeSheetName = "Sheet1";
      }

      const results = { updated: 0, appended: 0, moved: 0 };
      
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

        const targetSheet = o.status === "completed" ? completedSheetName : activeSheetName;
        const otherSheet = o.status === "completed" ? activeSheetName : completedSheetName;

        // 1. Check if it exists in the OTHER sheet (to move it)
        let foundInOther = false;
        try {
          const otherResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${otherSheet}'!B:B`,
          });
          const otherIds = (otherResponse.data.values || []).map(row => row[0]);
          const idx = otherIds.indexOf(o.id);
          if (idx !== -1) {
            // Delete from other sheet
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
            const otherSheetId = sheetMeta.data.sheets?.find(s => s.properties?.title === otherSheet)?.properties?.sheetId;
            
            if (otherSheetId !== undefined) {
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: {
                  requests: [{
                    deleteDimension: {
                      range: {
                        sheetId: otherSheetId,
                        dimension: "ROWS",
                        startIndex: idx,
                        endIndex: idx + 1
                      }
                    }
                  }]
                }
              });
              foundInOther = true;
            }
          }
        } catch (err) {
          console.warn(`[SERVER] Could not check/delete from ${otherSheet}`);
        }

        // 2. Sync to target sheet (Update or Append)
        let existingIdsInTarget: string[] = [];
        try {
          const targetResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${targetSheet}'!B:B`,
          });
          existingIdsInTarget = (targetResponse.data.values || []).map(row => row[0]);
        } catch (err) {}

        const targetIdx = existingIdsInTarget.indexOf(o.id);
        if (targetIdx !== -1) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'${targetSheet}'!A${targetIdx + 1}:I${targetIdx + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: [rowValues] },
          });
          results.updated++;
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `'${targetSheet}'!A:I`,
            valueInputOption: "RAW",
            requestBody: { values: [rowValues] },
          });
          results.appended++;
          if (foundInOther) results.moved++;
        }
      }

      return res.status(200).json({ status: "ok", results });
    } catch (error: any) {
      console.error("[SERVER] Critical Sync Error:", error.message || error);
      return res.status(500).json({ error: "Failed to sync to Google Sheets", details: error.message });
    }
  });

  app.post("/api/delete-order", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "No order ID provided" });

      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const key = process.env.GOOGLE_PRIVATE_KEY;
      let sheetId = process.env.GOOGLE_SHEET_ID;

      if (!email || !key || !sheetId) return res.status(200).json({ status: "skipped" });

      if (sheetId.includes("spreadsheets/d/")) {
        const match = sheetId.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) sheetId = match[1];
      }

      const authClient = new google.auth.JWT({
        email,
        key: key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth: authClient });
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      
      for (const sheet of spreadsheet.data.sheets || []) {
        const sheetName = sheet.properties?.title;
        const sheetIdInternal = sheet.properties?.sheetId;
        if (!sheetName || sheetIdInternal === undefined) continue;

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${sheetName}'!B:B`,
        });
        const ids = (response.data.values || []).map(row => row[0]);
        const idx = ids.indexOf(orderId);

        if (idx !== -1) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetIdInternal,
                    dimension: "ROWS",
                    startIndex: idx,
                    endIndex: idx + 1
                  }
                }
              }]
            }
          });
          console.log(`[SERVER] Deleted order ${orderId} from sheet ${sheetName}`);
        }
      }

      return res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[SERVER] Delete sync error:", error);
      return res.status(500).json({ error: error.message });
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
