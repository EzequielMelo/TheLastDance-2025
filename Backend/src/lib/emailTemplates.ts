const brandColor = "#d4af37";
const textColor = "#1a1a1a";
const gray = "#666";
const logoUrl = process.env['BRAND_LOGO_URL'] || "https://i.ibb.co/WP6r1xH/logo.png";

const wrapper = (title: string, body: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#111;color:#fff;padding:24px">
    <table align="center" width="100%" style="max-width:560px;background:#1b1412;border-radius:16px;padding:24px">
      <tr><td style="text-align:center;padding-bottom:16px">
        <img src="${logoUrl}" alt="Logo" style="width:64px;height:64px;border-radius:12px"/>
      </td></tr>
      <tr><td style="text-align:center;color:${textColor};background:#fff;border-radius:10px;padding:8px 12px;font-size:18px;font-weight:700">
        ${title}
      </td></tr>
      <tr><td style="padding-top:12px;color:${gray};font-size:14px;line-height:1.6">${body}</td></tr>
      <tr><td style="padding-top:20px;text-align:center;color:${gray};font-size:12px">© ${new Date().getFullYear()} Last Dance</td></tr>
    </table>
  </div>
`;

export const tplPending = (name: string) =>
  wrapper(
    "¡Recibimos tu registro!",
    `
    Hola <b>${name}</b>,<br/><br/>
    Tu cuenta fue creada y está <span style="color:${brandColor}">pendiente de aprobación</span>.
    Te avisaremos cuando sea revisada por nuestro equipo.<br/><br/>
    ¡Gracias por elegirnos!
    `
  );

export const tplApproved = (name: string) =>
  wrapper(
    "¡Tu cuenta fue aprobada!",
    `
    Hola <b>${name}</b>,<br/><br/>
    Buenas noticias: tu cuenta ha sido <span style="color:${brandColor}">aprobada</span>.
    Ya podés iniciar sesión y disfrutar de la app.<br/><br/>
    ¡Te esperamos!
    `
  );

export const tplRejected = (name: string, reason?: string) =>
  wrapper(
    "Tu registro fue rechazado",
    `
    Hola <b>${name}</b>,<br/><br/>
    Lamentablemente tu registro fue <span style="color:${brandColor}">rechazado</span>.
    ${reason ? `<br/><br/><b>Motivo:</b> ${reason}` : ""}
    <br/><br/>Si creés que se trata de un error, podés volver a intentarlo más adelante.
    `
  );
