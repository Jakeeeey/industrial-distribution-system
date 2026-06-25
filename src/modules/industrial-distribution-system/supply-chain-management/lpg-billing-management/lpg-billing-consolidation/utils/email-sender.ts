import nodemailer from "nodemailer";

export interface SendInvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  netAmount: number;
  periodFrom: string;
  periodTo: string;
  pdfBase64?: string;
  companyName: string;
  companyContact?: string | null;
  companyEmail?: string | null;
  companyTin?: string | null;
  companyLogoBase64?: string | null;
}

/**
 * Sends a clean, informational billing notice email with the generated PDF invoice attached.
 * Branded dynamically using company table details.
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<void> {
  const {
    to,
    customerName,
    invoiceNo,
    invoiceDate,
    dueDate,
    netAmount,
    periodFrom,
    periodTo,
    pdfBase64,
    companyName,
    companyContact,
    companyEmail,
    companyTin,
    companyLogoBase64,
  } = params;

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || smtpUser || "noreply@vosgas.com";

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP credentials (SMTP_USER, SMTP_PASSWORD) are not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  const formattedTotal = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(netAmount);

  // DEV-RULE: Comments detailing clean email layout using dynamic company credentials.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Billing Invoice Notice - ${companyName}</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; padding: 40px;">
          
          <!-- Company Header Logo & Name Layout -->
          <!-- DEV-CHANGE: Position logo and company name side-by-side using a clean, email-safe table layout -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              ${companyLogoBase64 
                ? `<td style="vertical-align: middle; padding-right: 16px; width: 1%;">
                     <!-- DEV-CHANGE: Increased logo height from 48px to 64px -->
                     <img src="cid:company_logo" alt="${companyName} Logo" style="height: 64px; max-height: 64px; width: auto; object-fit: contain; display: block;" />
                   </td>` 
                : ""
              }
              <td style="vertical-align: middle; text-align: left;">
                <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.01em; line-height: 1.3;">${companyName}</h2>
              </td>
            </tr>
          </table>
          
          <p style="font-size: 15px; line-height: 1.6; color: #0f172a; margin-top: 0;">Dear <strong>${customerName}</strong>,</p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">Your consolidated billing invoice has been successfully prepared and posted. We have attached a copy of the official PDF invoice for your review and records.</p>
          
          <!-- Billing Notice Details Summary List -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Statement Notice Summary</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Invoice Number</td>
                <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${invoiceNo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Billing Cycle</td>
                <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${periodFrom} to ${periodTo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Invoice Date</td>
                <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${invoiceDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #be123c; font-weight: 600;">Due Date</td>
                <td style="padding: 6px 0; font-size: 13px; color: #be123c; font-weight: 700; text-align: right;">${dueDate}</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0 0 0; font-size: 14px; color: #0f172a; font-weight: 700;">Total Amount Due</td>
                <td style="padding: 12px 0 0 0; font-size: 15px; color: #2563eb; font-weight: 800; text-align: right;">${formattedTotal}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">Please settle the total amount due on or before the indicated due date. For detailed itemizations of meter readings and cylinder deployments, please refer to the attached PDF invoice.</p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">Best regards,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #0f172a; font-weight: 700; margin: 4px 0 0 0;">Billing & Accounts Department</p>
          <p style="font-size: 13px; color: #64748b; margin: 0;">${companyName}</p>

          <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center;">
            <p style="margin: 0;">TIN: ${companyTin || "N/A"} | Contact: ${companyContact || companyEmail || "N/A"}</p>
            <p style="margin: 4px 0 0 0;">This is an automatically generated notification. Replies to this inbox are not monitored.</p>
          </div>

        </div>
      </body>
    </html>
  `;

  const attachments: nodemailer.SendMailOptions["attachments"] = [];

  // DEV-CHANGE: Attach generated sales invoice PDF as file attachment
  if (pdfBase64) {
    attachments.push({
      filename: `${invoiceNo}.pdf`,
      content: Buffer.from(pdfBase64, "base64"),
      contentType: "application/pdf",
    });
  }

  // DEV-CHANGE: Embed company logo as inline attachment using Content-ID (CID) to display offline safely in mail clients
  if (companyLogoBase64) {
    let cleanBase64 = companyLogoBase64;
    let contentType = "image/png";
    if (companyLogoBase64.startsWith("data:")) {
      const parts = companyLogoBase64.split(";base64,");
      if (parts.length === 2) {
        contentType = parts[0].replace("data:", "");
        cleanBase64 = parts[1];
      }
    }
    attachments.push({
      filename: "company_logo",
      content: Buffer.from(cleanBase64, "base64"),
      contentType,
      cid: "company_logo",
    });
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${companyName.toUpperCase()}" <${emailFrom}>`,
    to,
    subject: `${companyName} - Sales Invoice Notice (${invoiceNo})`,
    html: htmlContent,
    attachments,
  };

  await transporter.sendMail(mailOptions);
}
