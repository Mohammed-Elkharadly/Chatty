export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createWelcomeEmailTemplate(
  name: string,
  clientURL: string,
): string {
  const safeName = escapeHtml(name);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Chatty</title>
      </head>

      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Welcome to Chatty!</h2>

        <p>Hi ${safeName}!</p>

        <p>
          Thanks for creating your Chatty account.
          We're happy to have you with us.
        </p>

        <p>
          You can now start chatting with your friends and enjoy Chatty.
        </p>

        <p>
          <a href="${clientURL}">
            Open Chatty
          </a>
        </p>

        <p>
          If you didn't create this account, you can safely ignore this email.
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
