import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Google Sheets Integration
  app.post("/api/sync-sheets", async (req, res) => {
    try {
      const { orders } = req.body;
      
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
        return res.status(400).json({ 
          error: "Google Sheets environment variables are not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEET_ID." 
        });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth: auth as any });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;

      // Prepare data for the sheet
      // Headers: Order ID, Date, Customer Name, Email, Phone, Status, Total, Items
      const headerRow = ["Order ID", "Date", "Customer", "Email", "Phone", "Status", "Total (SAR)", "Items"];
      const dataRows = orders.map((order: any) => [
        order.id,
        order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A",
        order.customerName,
        order.customerEmail,
        order.customerPhone || "N/A",
        order.status.toUpperCase(),
        order.total.toFixed(2),
        order.items.map((item: any) => `${item.quantity}x ${item.name} (${item.selectedSize || 'N/A'}, ${item.selectedColor || 'N/A'})`).join(" | ")
      ]);

      const values = [headerRow, ...dataRows];

      // Update the sheet (overwrite from A1)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: { values },
      });

      res.json({ success: true, message: `Successfully synced ${orders.length} orders to Google Sheets.` });
    } catch (error: any) {
      console.error("Sheets Sync Error:", error);
      res.status(500).json({ error: error.message || "Failed to sync with Google Sheets." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "alive" });
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
