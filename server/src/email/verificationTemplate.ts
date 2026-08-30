import { escapeHtml } from "./welcomeTemplate.js";
export function verifyEmailTemplate(
  name: string,
  verificationToken: string,
  serverUrl: string,
): string {
  const verificationUrl = `${serverUrl}/api/auth/verify-email/${verificationToken}`;
  const safeName = escapeHtml(name);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>

      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Verify Your Email</h2>

        <p>Hi ${safeName}!</p>

        <p>
          Thanks for signing up! Click the link below to verify your email address:
        </p>

        <p>
          <a href="${verificationUrl}">
            Verify Your Email
          </a>
        </p>

        <p>This link expires in 15 minutes.</p>

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
