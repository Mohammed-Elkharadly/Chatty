// takes a raw string, replaces HTML special chars with their entity equivalents
// prevents XSS: if a user registers with name "<script>alert('x')</script>",
// without this it would execute as JavaScript when the email is rendered
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;") // & must go first (otherwise we'd double-encode the others)
    .replace(/</g, "&lt;") // < → &lt; (prevents opening a new HTML tag)
    .replace(/>/g, "&gt;") // > → &gt; (prevents closing a tag early)
    .replace(/"/g, "&quot;") // " → &quot; (prevents breaking out of an attribute)
    .replace(/'/g, "&#039;"); // ' → &#039; (prevents breaking out of a JS string)
}

export function createWelcomeEmailTemplate(
  name: string,
  clientURL: string,
): string {
  // sanitize the user's name before inserting it into the HTML
  // if name = '"><img src=x onerror=alert(1)>' → becomes harmless text in the email
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
