import { escapeHtml } from "./welcomeTemplate.js";
export function forgotPasswordTemplate(
  name: string,
  resetToken: string,
  url: string,
): string {
  const resetPasswordUrl = `${url}/reset-password/${resetToken}`;
  const safeName = escapeHtml(name);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your Password</title>
      </head>

      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Verify Your Email</h2>

        <p>Hi ${safeName}!</p>
          ${resetToken}
        <p>
          Click the link below to reset your password:
        </p>

        <p>
          <a href="${resetPasswordUrl}">
            Reset your password
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
