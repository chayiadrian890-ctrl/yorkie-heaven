import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let resendClient: Resend | null = null;

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/send-approval-email", async (req, res) => {
    const { email, fullName, companyName, subject } = req.body;
    console.log(`Attempting to send approval email to ${email} for ${fullName}`);

    const resend = getResend();

    if (!resend) {
      console.error("RESEND_API_KEY is missing in environment variables.");
      return res.status(500).json({ error: "Email service not configured. Please check RESEND_API_KEY secret." });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [email],
        subject: subject || "Your Puppy Application has been Approved!",
        html: `
          <h1>Congratulations ${fullName}!</h1>
          <p>We are excited to inform you that your application for a puppy from ${companyName} has been approved.</p>
          <p>We will be in touch shortly with the next steps in the adoption process.</p>
          <p>Best regards,<br>${companyName} Team</p>
        `,
      });

      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json({ message: "Email sent successfully", data });
    } catch (err) {
      console.error("Unexpected error sending email:", err);
      res.status(500).json({ error: "Failed to send email" });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
