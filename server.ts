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
  app.post("/api/send-application-status-email", async (req, res) => {
    const { email, fullName, companyName, status, subject } = req.body;
    console.log(`Attempting to send ${status} email to ${email} for ${fullName}`);

    const resend = getResend();

    if (!resend) {
      console.error("RESEND_API_KEY is missing in environment variables.");
      return res.status(500).json({ error: "Email service not configured. Please check RESEND_API_KEY secret." });
    }

    let emailSubject = subject;
    let emailHtml = "";

    if (status === 'Approved') {
      emailSubject = emailSubject || "Your Application Has Been Approved";
      emailHtml = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
          <h1 style="color: #4a4a4a;">Congratulations ${fullName}!</h1>
          <p>We are excited to inform you that your application for a puppy from <strong>${companyName}</strong> has been approved.</p>
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>We will be in touch shortly with the next steps in the adoption process.</li>
            <li>Please prepare your home for your new furry friend!</li>
            <li>If you have any questions, feel free to reply to this email.</li>
          </ul>
          <p>Best regards,<br>${companyName} Team</p>
        </div>
      `;
    } else if (status === 'Rejected') {
      emailSubject = emailSubject || "Update on Your Application";
      emailHtml = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
          <h1 style="color: #4a4a4a;">Hello ${fullName},</h1>
          <p>Thank you for your interest in adopting a puppy from <strong>${companyName}</strong>.</p>
          <p>After careful consideration, we have decided not to move forward with your application at this time.</p>
          <p>We receive many wonderful applications and have to make difficult decisions based on the best fit for our puppies. We encourage you to apply again in the future if your circumstances change or for future litters.</p>
          <p>We wish you the best of luck in finding the perfect addition to your family.</p>
          <p>Best regards,<br>${companyName} Team</p>
        </div>
      `;
    } else {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [email],
        subject: emailSubject,
        html: emailHtml,
      });

      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json({ message: `Application ${status.toLowerCase()} and email sent successfully`, data });
    } catch (err) {
      console.error("Unexpected error sending email:", err);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/send-approval-email", async (req, res) => {
    // Keeping this for backward compatibility if needed, but redirecting to the new logic
    const { email, fullName, companyName, subject } = req.body;
    req.body.status = 'Approved';
    // Re-routing to the new handler logic internally or just duplicating for now to be safe
    // Actually, I'll just replace it in App.tsx and eventually remove this.
    // For now, let's just implement the new one.
    res.redirect(307, "/api/send-application-status-email");
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
