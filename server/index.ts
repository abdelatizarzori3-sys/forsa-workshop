import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  /**
   * عقد مؤقت فاشل مغلق: لا توجد في هذا المشروع حسابات أو خدمة اشتراك موثقة
   * بعد. لا يجوز للعميل فتح Pro من التخزين أو من متغير واجهة. عند تجهيز الدفع
   * يستبدل هذا المعالج بتحقق خادمي من جلسة الحساب والاشتراك غير المنتهي فقط.
   */
  app.get("/api/me/entitlements/workshop-report", (_req, res) => {
    res.status(503).set("Cache-Control", "no-store").json({
      status: "purchase_setup_required",
      code: "WORKSHOP_REPORT_ENTITLEMENT_UNCONFIGURED",
    });
  });

  app.use("/api", (_req, res) => {
    res
      .status(404)
      .set("Cache-Control", "no-store")
      .json({ status: "not_found" });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
