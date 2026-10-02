import nodemailer from "nodemailer";

// Gmail de Workspace con contraseña de aplicación:
// SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=tu@escuela.es, SMTP_PASSWORD=<contraseña de aplicación>
function transport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendLoginEmail(to: string, link: string, code: string) {
  const subject = "Tu enlace para entrar en Aula26";
  const text = `Hola,\n\nPulsa este enlace para entrar en Aula26:\n${link}\n\nO escribe este código en la página donde lo pediste: ${code}\n\nCaduca en 15 minutos y solo funciona una vez. Si no lo has pedido tú, ignora este correo.`;
  const html = `<p>Hola,</p><p>Pulsa este enlace para entrar en Aula26:</p><p><a href="${link}">Entrar en Aula26</a></p><p>O escribe este código en la página donde lo pediste:</p><p style="font:600 28px/1.2 monospace;letter-spacing:4px">${code}</p><p style="color:#666">Caduca en 15 minutos y solo funciona una vez. Si no lo has pedido tú, ignora este correo.</p>`;

  const t = transport();
  if (!t) {
    // Sin SMTP configurado (desarrollo): el enlace se muestra en la consola.
    console.log(`[mail] Código de acceso para ${to} -> ${code}`);
    console.log(`[mail] Enlace de acceso para ${to}: ${link}`);
    return;
  }
  const from = process.env.MAIL_FROM ?? `Aula26 <${process.env.SMTP_USER}>`;
  await t.sendMail({ from, to, subject, text, html });
}
