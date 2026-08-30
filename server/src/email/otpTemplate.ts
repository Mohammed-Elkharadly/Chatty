import { escapeHtml } from "./welcomeTemplate.js";
export function otpTemplate(
  name: string,
  otp: string,
): string {
  const safeName = escapeHtml(name);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP code</title>
      </head>

      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>OTP code</h2>

        <p>Hi ${safeName}!</p>

        <p>
          Don't share this code with anyone:
        </p>

        <p>
          <a href="#">
            OTP code : ${otp}
          </a>
        </p>

        <p>This code expires in 15 minutes.</p>

        <p>
          If you didn't create an account, you can safely ignore this email.
        </p>

        <p>
          ---
          <br>
          © ${new Date().getFullYear()} Chatty
          <br>
          This is an automated message, please do not reply.
        </p>
      </body>
    </html>
  `.trim();
}
