import nodemailer from "nodemailer";

const GMAIL_USER = "genieflavour@gmail.com";

function createTransporter() {
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!appPassword) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: appPassword },
  });
}

export async function sendContributionEmail(
  recipientEmail: string,
  recipientName: string,
  recipeTitle: string,
  source: "community" | "challenge" | "chatbot"
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[Email] GMAIL_APP_PASSWORD not configured — skipping contribution email");
    return;
  }

  const sourceLabel =
    source === "chatbot"
      ? "Smart Chef AI"
      : source === "challenge"
      ? "the Weekly Challenge"
      : "the Community Recipe form";

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:40px 20px;">
      <div style="background:linear-gradient(135deg,#2d6a4f,#1b4332);padding:30px;border-radius:16px 16px 0 0;text-align:center;">
        <h1 style="color:#d4af37;font-size:28px;margin:0;letter-spacing:1px;">Palate Lit</h1>
        <p style="color:#a7f3d0;font-size:13px;margin:6px 0 0;">Illuminating Flavor. Elevating Mood.</p>
      </div>
      <div style="background:#ffffff;padding:36px 32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">
        <p style="font-size:17px;color:#1b4332;font-weight:bold;margin-top:0;">
          Dear ${recipientName || "Chef"},
        </p>
        <p style="color:#374151;line-height:1.8;font-size:15px;">
          We're absolutely delighted to let you know that your recipe
          <strong style="color:#2d6a4f;">&ldquo;${recipeTitle}&rdquo;</strong>
          has been published to the Palate Lit community cookbook
          through <strong>${sourceLabel}</strong>!
        </p>
        <p style="color:#374151;line-height:1.8;font-size:15px;">
          Your contribution helps inspire home cooks across India to explore the rich and diverse world of 
          vegetarian cuisine. Every recipe you share is a meaningful gift to our growing community of food lovers.
        </p>
        <div style="background:#f0fdf4;border-left:4px solid #2d6a4f;padding:16px 20px;margin:28px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;color:#1b4332;font-style:italic;font-size:14px;line-height:1.6;">
            &ldquo;Food is our common ground, a universal experience.&rdquo; — James Beard
          </p>
        </div>
        <p style="color:#374151;line-height:1.8;font-size:15px;">
          You can find your recipe in the <strong>Community</strong> tab on Palate Lit,
          where fellow cooks can discover it, save it to their favourites, and even chat with you about it!
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:36px;padding-top:20px;border-top:1px solid #f3f4f6;">
          With warmth and appreciation,<br/>
          <strong style="color:#2d6a4f;">The Palate Lit Team</strong><br/>
          <a href="mailto:genieflavour@gmail.com" style="color:#2d6a4f;text-decoration:none;">genieflavour@gmail.com</a>
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Palate Lit" <${GMAIL_USER}>`,
      to: recipientEmail,
      subject: `Your recipe "${recipeTitle}" is now live on Palate Lit! 🍲`,
      html,
    });
    console.log(`[Email] Sent contribution email → ${recipientEmail} ("${recipeTitle}")`);
  } catch (err) {
    console.error("[Email] Failed to send contribution email:", err);
  }
}

export async function sendFeedbackResponseEmail(
  recipientEmail: string,
  recipientName: string,
  originalMessage: string,
  adminResponse: string,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[Email] GMAIL_APP_PASSWORD not configured — skipping feedback response email");
    return;
  }

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:40px 20px;">
      <div style="background:linear-gradient(135deg,#2d6a4f,#1b4332);padding:30px;border-radius:16px 16px 0 0;text-align:center;">
        <h1 style="color:#d4af37;font-size:28px;margin:0;letter-spacing:1px;">Palate Lit</h1>
        <p style="color:#a7f3d0;font-size:13px;margin:6px 0 0;">Illuminating Flavor. Elevating Mood.</p>
      </div>
      <div style="background:#ffffff;padding:36px 32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">
        <p style="font-size:17px;color:#1b4332;font-weight:bold;margin-top:0;">
          Dear ${recipientName || "Valued User"},
        </p>
        <p style="color:#374151;line-height:1.8;font-size:15px;">
          Thank you for taking the time to share your feedback with us. Here's what you wrote:
        </p>
        <div style="background:#f0fdf4;border-left:4px solid #6b7280;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;color:#374151;font-style:italic;font-size:14px;line-height:1.6;">&ldquo;${originalMessage}&rdquo;</p>
        </div>
        <p style="color:#374151;line-height:1.8;font-size:15px;font-weight:bold;margin-top:28px;">Our response:</p>
        <div style="background:#f0fdf4;border-left:4px solid #2d6a4f;padding:16px 20px;margin:12px 0 28px;border-radius:0 8px 8px 0;">
          <p style="margin:0;color:#1b4332;font-size:15px;line-height:1.8;">${adminResponse}</p>
        </div>
        <p style="color:#374151;line-height:1.8;font-size:15px;">
          We value every piece of feedback — it helps us make Palate Lit a better experience for everyone.
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:36px;padding-top:20px;border-top:1px solid #f3f4f6;">
          With warmth,<br/>
          <strong style="color:#2d6a4f;">The Palate Lit Team</strong><br/>
          <a href="mailto:genieflavour@gmail.com" style="color:#2d6a4f;text-decoration:none;">genieflavour@gmail.com</a>
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Palate Lit" <${GMAIL_USER}>`,
      to: recipientEmail,
      subject: `We've responded to your Palate Lit feedback`,
      html,
    });
    console.log(`[Email] Sent feedback response → ${recipientEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send feedback response email:", err);
  }
}
