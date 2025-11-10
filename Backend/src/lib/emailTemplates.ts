const brandColor = "#d4af37";
const darkBg = "#1a1a1a";
const brownBg = "#2d1810";
const textColor = "#ffffff";
const grayText = "#9ca3af";
const logoUrl = process.env['BRAND_LOGO_URL'] || "https://eahhbvsassnukebtvate.supabase.co/storage/v1/object/public/Icon/icono.png";

const wrapper = (title: string, body: string) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;
              background:linear-gradient(135deg, ${darkBg} 0%, ${brownBg} 50%, ${darkBg} 100%);
              min-height:100vh;
              padding:40px 20px;
              box-sizing:border-box;">
    
    <table align="center" width="100%" style="
      max-width:600px;
      background:${darkBg};
      border-radius:20px;
      padding:40px;
      box-shadow:0 20px 40px rgba(0,0,0,0.5);
      border:1px solid rgba(212,175,55,0.2);
      box-sizing:border-box;
    ">

      <!-- Espacio superior interno -->
      <tr><td style="height:10px"></td></tr>

      <!-- Logo y Header -->
      <tr>
        <td style="text-align:center;padding-bottom:32px">
          <img src="${logoUrl}" alt="Last Dance Logo" style="width:80px;height:80px;border-radius:16px;box-shadow:0 8px 16px rgba(212,175,55,0.3)"/>
        </td>
      </tr>

      <!-- Título -->
      <tr>
        <td style="text-align:center;padding-bottom:24px">
          <div style="background:linear-gradient(90deg, ${brandColor} 0%, #b8941f 50%, ${brandColor} 100%);
                      color:${darkBg};
                      border-radius:12px;
                      padding:20px 28px;
                      font-size:20px;
                      font-weight:700;
                      letter-spacing:0.5px;
                      text-transform:uppercase;">
            ${title}
          </div>
        </td>
      </tr>

      <!-- Contenido con padding adicional -->
      <tr>
        <td style="padding:20px 8px;color:${textColor};font-size:16px;line-height:1.7;text-align:left">
          ${body}
        </td>
      </tr>

      <!-- Separador -->
      <tr>
        <td style="padding:24px 0;text-align:center">
          <div style="height:2px;background:linear-gradient(90deg, transparent 0%, ${brandColor} 50%, transparent 100%);
                      width:60%;
                      margin:0 auto;
                      border-radius:1px;"></div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding-top:24px;text-align:center;color:${grayText};font-size:14px">
          <div style="margin-bottom:16px">
            <span style="color:${brandColor};font-weight:600">Last Dance Restaurant</span>
          </div>
          <div style="font-size:12px;opacity:0.8">
            © ${new Date().getFullYear()} Todos los derechos reservados
          </div>
        </td>
      </tr>

      <!-- Espacio inferior interno -->
      <tr><td style="height:10px"></td></tr>

    </table>
  </div>
`;

export const tplPending = (name: string) =>
  wrapper(
    "¡Recibimos tu registro!",
    `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:18px;margin-bottom:8px">¡Hola <strong style="color:${brandColor}">${name}</strong>!</div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px">
      Tu cuenta ha sido creada exitosamente y está <strong style="color:${brandColor};background:rgba(212,175,55,0.1);padding:2px 8px;border-radius:4px">pendiente de aprobación</strong>.
    </p>
    
    <p style="margin-bottom:20px">
      Nuestro equipo revisará tu solicitud en las próximas horas. Te notificaremos por email una vez que sea procesada.
    </p>
    
    <div style="text-align:center;margin-top:32px">
      <div style="color:${brandColor};font-weight:600;font-size:16px">¡Gracias por elegirnos!</div>
      <div style="color:${grayText};font-size:14px;margin-top:8px">El equipo de Last Dance</div>
    </div>
    `
  );

export const tplApproved = (name: string) =>
  wrapper(
    "¡Tu cuenta fue aprobada!",
    `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:18px;margin-bottom:8px">¡Excelentes noticias, <strong style="color:${brandColor}">${name}</strong>!</div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px">
      Tu cuenta ha sido <strong style="color:${brandColor};background:rgba(212,175,55,0.1);padding:2px 8px;border-radius:4px">✅ APROBADA</strong> exitosamente.
    </p>
    
    <p style="color:${textColor};margin-bottom:24px">
      Ya podés iniciar sesión en la aplicación y disfrutar de toda la experiencia que Last Dance tiene para ofrecerte.
    </p>
    
    <div style="text-align:center;background:rgba(212,175,55,0.1);border-radius:12px;padding:20px;margin:24px 0">
      <div style="color:${brandColor};font-weight:600;font-size:16px;margin-bottom:8px">🎉 ¡Bienvenido a Last Dance!</div>
      <div style="color:${textColor};font-size:14px">Tu aventura culinaria comienza ahora</div>
    </div>
    
    <div style="text-align:center;margin-top:32px">
      <div style="color:${grayText};font-size:14px">¡Te esperamos!</div>
      <div style="color:${brandColor};font-weight:600;margin-top:4px">El equipo de Last Dance</div>
    </div>
    `
  );

export const tplRejected = (name: string, reason?: string) =>
  wrapper(
    "Actualización de tu registro",
    `
    <div style="color:${textColor};text-align:center;margin-bottom:24px">
      <div style="font-size:18px;margin-bottom:8px">Hola <strong style="color:${brandColor}">${name}</strong>,</div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px">
      Lamentablemente, tu solicitud de registro fue <strong style="color:#ef4444;background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:4px;">❌ rechazada</strong> en esta oportunidad.
    </p>
    
    ${reason ? `
    <div style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
      <div style="color:${textColor};font-weight:600;margin-bottom:8px">Motivo:</div>
      <div style="color:${grayText};font-size:14px;line-height:1.5">${reason}</div>
    </div>
    ` : ""}
    
    <p style="color:${textColor};margin-bottom:24px">
      Si creés que se trata de un error o deseas intentarlo nuevamente, podés volver a registrarte más adelante.
    </p>
    
    <div style="text-align:center;background:rgba(212,175,55,0.1);border-radius:12px;padding:20px;margin:24px 0">
      <div style="color:${brandColor};font-weight:600;font-size:16px;margin-bottom:8px">¿Necesitas ayuda?</div>
      <div style="color:${textColor};font-size:14px">Nuestro equipo está disponible para asistirte</div>
    </div>
    
    <div style="text-align:center;margin-top:32px">
      <div style="color:${grayText};font-size:14px">Gracias por tu interés en</div>
      <div style="color:${brandColor};font-weight:600;margin-top:4px">Last Dance Restaurant</div>
    </div>
    `
  );

// ============================================
// Templates para Reservas
// ============================================

export const tplReservationApproved = (
  name: string,
  date: string,
  time: string,
  partySize: number,
  tableNumber: string
) =>
  wrapper(
    "¡Tu reserva fue aprobada!",
    `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:18px;margin-bottom:8px">¡Excelentes noticias, <strong style="color:${brandColor}">${name}</strong>!</div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px">
      Tu reserva ha sido <strong style="color:${brandColor};background:rgba(212,175,55,0.1);padding:2px 8px;border-radius:4px">✅ APROBADA</strong> exitosamente.
    </p>
    
    <div style="background:rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin:24px 0;border:1px solid rgba(212,175,55,0.3)">
      <div style="color:${brandColor};font-weight:700;font-size:18px;margin-bottom:16px;text-align:center">
        📅 Detalles de tu Reserva
      </div>
      
      <div style="margin-bottom:12px">
        <span style="color:${brandColor};font-weight:600">📆 Fecha:</span>
        <span style="color:${textColor};margin-left:8px">${date}</span>
      </div>
      
      <div style="margin-bottom:12px">
        <span style="color:${brandColor};font-weight:600">🕐 Hora:</span>
        <span style="color:${textColor};margin-left:8px">${time}</span>
      </div>
      
      <div style="margin-bottom:12px">
        <span style="color:${brandColor};font-weight:600">👥 Personas:</span>
        <span style="color:${textColor};margin-left:8px">${partySize}</span>
      </div>
      
      <div>
        <span style="color:${brandColor};font-weight:600">🪑 Mesa:</span>
        <span style="color:${textColor};margin-left:8px">${tableNumber}</span>
      </div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px;text-align:center">
      Por favor, llegá <strong style="color:${brandColor}">15 minutos antes</strong> de tu hora reservada.
    </p>
    
    <div style="text-align:center;background:rgba(212,175,55,0.1);border-radius:12px;padding:20px;margin:24px 0">
      <div style="color:${brandColor};font-weight:600;font-size:16px;margin-bottom:8px">¡Te esperamos en Last Dance!</div>
      <div style="color:${textColor};font-size:14px">Preparamos todo para tu visita</div>
    </div>
    
    <div style="text-align:center;margin-top:32px">
      <div style="color:${grayText};font-size:14px">¡Nos vemos pronto!</div>
      <div style="color:${brandColor};font-weight:600;margin-top:4px">El equipo de Last Dance</div>
    </div>
    `
  );

export const tplReservationRejected = (
  name: string,
  date: string,
  time: string,
  partySize: number,
  reason?: string
) =>
  wrapper(
    "Actualización de tu reserva",
    `
    <div style="color:${textColor};text-align:center;margin-bottom:24px">
      <div style="font-size:18px;margin-bottom:8px">Hola <strong style="color:${brandColor}">${name}</strong>,</div>
    </div>
    
    <p style="color:${textColor};margin-bottom:20px">
      Lamentablemente, tu solicitud de reserva fue <strong style="color:#ef4444;background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:4px;">❌ rechazada</strong> en esta oportunidad.
    </p>
    
    <div style="background:rgba(239,68,68,0.05);border-radius:12px;padding:20px;margin:20px 0;border:1px solid rgba(239,68,68,0.2)">
      <div style="color:${textColor};font-weight:600;font-size:16px;margin-bottom:12px">Reserva solicitada:</div>
      
      <div style="margin-bottom:8px">
        <span style="color:${grayText}">📆 Fecha:</span>
        <span style="color:${textColor};margin-left:8px">${date}</span>
      </div>
      
      <div style="margin-bottom:8px">
        <span style="color:${grayText}">🕐 Hora:</span>
        <span style="color:${textColor};margin-left:8px">${time}</span>
      </div>
      
      <div>
        <span style="color:${grayText}">👥 Personas:</span>
        <span style="color:${textColor};margin-left:8px">${partySize}</span>
      </div>
    </div>
    
    ${reason ? `
    <div style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
      <div style="color:${textColor};font-weight:600;margin-bottom:8px">Motivo del rechazo:</div>
      <div style="color:${grayText};font-size:14px;line-height:1.5">${reason}</div>
    </div>
    ` : ""}
    
    <p style="color:${textColor};margin-bottom:24px">
      Te invitamos a intentar con otra fecha u horario. Nuestro equipo está disponible para ayudarte a encontrar la mejor opción.
    </p>
    
    <div style="text-align:center;background:rgba(212,175,55,0.1);border-radius:12px;padding:20px;margin:24px 0">
      <div style="color:${brandColor};font-weight:600;font-size:16px;margin-bottom:8px">¿Querés intentar con otra fecha?</div>
      <div style="color:${textColor};font-size:14px">Podés hacer una nueva reserva en cualquier momento</div>
    </div>
    
    <div style="text-align:center;margin-top:32px">
      <div style="color:${grayText};font-size:14px">Gracias por tu interés en</div>
      <div style="color:${brandColor};font-weight:600;margin-top:4px">Last Dance Restaurant</div>
    </div>
    `
  );
