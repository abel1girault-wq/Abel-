import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for syncing with Google Sheets
app.post("/api/sync-order", async (req, res) => {
  try {
    const { order } = req.body;
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
      console.warn("Google Sheets credentials missing in environment");
      return res.status(200).json({ status: "skipped", message: "Credentials not configured" });
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    
    // Format items string
    const itemsString = order.items
      .map((item: any) => `${item.name} x${item.quantity}${item.selectedSize ? ` (${item.selectedSize})` : ""}`)
      .join(", ");

    const values = [
      [
        new Date(order.createdAt?.seconds * 1000 || Date.now()).toLocaleString(),
        order.id,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        itemsString,
        order.total,
        order.status,
        order.location || "N/A"
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:I",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log(`Order ${order.id} synced to Google Sheets`);
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Error syncing to Google Sheets:", error);
    res.status(500).json({ error: "Failed to sync to Google Sheets" });
  }
});

async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
