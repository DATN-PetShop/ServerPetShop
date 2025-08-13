const nodemailer = require('nodemailer');

let cachedTransporter;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.SMTP_USER;
  const pass =  process.env.SMTP_PASS;
  const service = 'gmail';

  cachedTransporter = nodemailer.createTransport({
    service,
    auth: { user, pass },
  });

  return cachedTransporter;
};

const buildOtpEmailHtml = (otp) => {
  const appName = process.env.APP_NAME || 'PetShop';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName} - Password Recovery</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; line-height: 1.6; color: #222; }
    .container { max-width: 600px; margin: 40px auto; padding: 24px; border: 1px solid #eee; border-radius: 8px; }
    .brand { color: #00466a; font-weight: 700; font-size: 20px; text-decoration: none; }
    .otp { background: #00466a; color: #fff; display: inline-block; padding: 8px 16px; border-radius: 6px; letter-spacing: 2px; }
    .muted { color: #888; font-size: 12px; }
  </style>
  </head>
<body>
  <div class="container">
    <div style="border-bottom:1px solid #eee; padding-bottom: 12px; margin-bottom: 16px;">
      <span class="brand">${appName}</span>
    </div>
    <p>Hello,</p>
    <p>Use the following OTP to reset your password. This code will expire in 5 minutes.</p>
    <h2 class="otp">${otp}</h2>
    <p>If you did not request this, please ignore this email.</p>
    <p>Regards,<br/>${appName} Team</p>
    <hr />
    <p class="muted">This is an automated message, please do not reply.</p>
  </div>
</body>
</html>`;
};

async function sendOtpEmail(recipientEmail, otp) {
  const transporter = getTransporter();
  const appName = process.env.APP_NAME || 'PetShop';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.Email_User || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'PETSHOP';

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: recipientEmail,
    subject: `${appName} Password Recovery OTP`,
    html: buildOtpEmailHtml(otp),
    text: `Your ${appName} OTP is: ${otp}. It expires in 5 minutes.`,
  });

  return info;
}

module.exports = {
  sendOtpEmail,
};


