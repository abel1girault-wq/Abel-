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
      let spreadsheet;
      try {
        spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
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
          // Refresh spreadsheet metadata after creation
          spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        }
      } catch (err) {
        console.warn("[SERVER] Metadata fetch/create failed, defaulting to Sheet1", err);
        activeSheetName = "Sheet1";
      }

      // 1. Fetch current IDs and metadata from both sheets to minimize API calls
      const fetchIds = async (name: string) => {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${name}'!B:B`,
          });
          return (response.data.values || []).map(row => row[0]);
        } catch (e) { return []; }
      };

      const [activeIds, completedIds] = await Promise.all([
        fetchIds(activeSheetName),
        fetchIds(completedSheetName)
      ]);

      const activeSheetId = spreadsheet?.data.sheets?.find(s => s.properties?.title === activeSheetName)?.properties?.sheetId;
      const completedSheetId = spreadsheet?.data.sheets?.find(s => s.properties?.title === completedSheetName)?.properties?.sheetId;

      const batchRequests: any[] = [];
      const appendRequests: { sheet: string, values: any[] }[] = [
        { sheet: activeSheetName, values: [] },
        { sheet: completedSheetName, values: [] }
      ];

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

        const isCompleted = o.status === "completed";
        const targetSheet = isCompleted ? completedSheetName : activeSheetName;
        const otherSheet = isCompleted ? activeSheetName : completedSheetName;
        const otherIds = isCompleted ? activeIds : completedIds;
        const targetIds = isCompleted ? completedIds : activeIds;
        const otherSheetId = isCompleted ? activeSheetId : completedSheetId;

        // Check for moves (if in other sheet, delete it)
        const otherIdx = otherIds.indexOf(o.id);
        if (otherIdx !== -1 && otherSheetId !== undefined) {
          batchRequests.push({
            deleteDimension: {
              range: {
                sheetId: otherSheetId,
                dimension: "ROWS",
                startIndex: otherIdx,
                endIndex: otherIdx + 1
              }
            }
          });
          // Remove from local cache to prevent multiple deletions if id repeated (unlikely)
          otherIds[otherIdx] = "__DELETED__";
        }

        // Update or Append in target
        const targetIdx = targetIds.indexOf(o.id);
        if (targetIdx !== -1) {
          // Add to batch update values
          batchRequests.push({
            updateCells: {
              range: {
                sheetId: isCompleted ? completedSheetId : activeSheetId,
                startRowIndex: targetIdx,
                endRowIndex: targetIdx + 1,
                startColumnIndex: 0,
                endColumnIndex: 9
              },
              rows: [{
                values: rowValues.map(v => ({ userEnteredValue: { [typeof v === 'number' ? 'numberValue' : 'stringValue']: v } }))
              }],
              fields: "userEnteredValue"
            }
          });
        } else {
          // Accumulate for append
          appendRequests.find(r => r.sheet === targetSheet)?.values.push(rowValues);
          targetIds.push(o.id); // Prevent duplicate appends in same batch
        }
      }

      // Execute batch deletions/updates
      if (batchRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { requests: batchRequests }
        });
      }

      // Execute appends
      for (const req of appendRequests) {
        if (req.values.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `'${req.sheet}'!A:I`,
            valueInputOption: "RAW",
            requestBody: { values: req.values },
          });
        }
      }

      return res.status(200).json({ status: "ok", results: { processed: ordersToSync.length } });
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
      const sheetsFound = spreadsheet.data.sheets || [];
      console.log(`[SERVER] Searching for order ${orderId} across ${sheetsFound.length} sheets...`);

      for (const sheet of sheetsFound) {
        const sheetName = sheet.properties?.title;
        const sheetIdInternal = sheet.properties?.sheetId;
        if (!sheetName || sheetIdInternal === undefined) continue;

        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${sheetName}'!B:B`,
          });
          const ids = (response.data.values || []).map(row => String(row[0]).trim());
          const idx = ids.indexOf(String(orderId).trim());

          if (idx !== -1) {
            console.log(`[SERVER] Found match on sheet "${sheetName}" at row ${idx + 1}. Executing removal...`);
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
          }
        } catch (innerErr) {
          console.warn(`[SERVER] Failed to search/delete on sheet ${sheetName}:`, innerErr);
        }
      }

      return res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[SERVER] Delete sync error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync-stock", async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) return res.status(400).json({ error: "No products provided" });

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

      const sheetName = "Stock";
      
      // Ensure "Stock" sheet exists
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const titles = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
        if (!titles.includes(sheetName)) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: sheetName } } }]
            }
          });
        }
      } catch (err) {}

      // Prepare header and data
      const header = ["Product ID", "Product Name", "Current Stock", "Last Updated"];
      const rows = products.map((p: any) => [
        p.id || "N/A",
        p.name || "N/A",
        p.stock !== undefined ? p.stock : 0,
        new Date().toLocaleString('en-US', { timeZone: 'UTC' })
      ]);

      // Overwrite the entire Stock sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header, ...rows] },
      });

      console.log(`[SERVER] Synced ${products.length} stock records to ${sheetName}`);
      return res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[SERVER] Stock sync error:", error);
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
