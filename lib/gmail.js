import { google } from 'googleapis';

// ── Crear cliente OAuth con las credenciales de .env.local ─────────────────────
function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return oauth2Client;
}

// ── Decodificar el cuerpo del email (viene en base64 desde Gmail) ───────────────
function decodeBody(part) {
  if (!part) return '';

  // Preferencia: texto plano
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }

  // HTML — lo devolvemos tal cual para que Claude lo lea con toda su estructura
  if (part.mimeType === 'text/html' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }

  // Recorrer partes anidadas (emails multipart)
  if (part.parts) {
    // Primero texto plano
    for (const p of part.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data) {
        return Buffer.from(p.body.data, 'base64url').toString('utf-8');
      }
    }
    // Luego HTML
    for (const p of part.parts) {
      const text = decodeBody(p);
      if (text) return text;
    }
  }

  return '';
}

// ── Buscar adjuntos PDF en el árbol de partes del email ────────────────────────
function findPdfAttachments(part) {
  const pdfs = [];
  if (!part) return pdfs;

  if (part.mimeType === 'application/pdf' && part.body?.attachmentId) {
    pdfs.push({
      filename:     part.filename || 'attachment.pdf',
      attachmentId: part.body.attachmentId,
    });
  }
  if (part.parts) {
    for (const p of part.parts) {
      pdfs.push(...findPdfAttachments(p));
    }
  }
  return pdfs;
}

// ── Leer emails de la etiqueta "Utilities" ─────────────────────────────────────
export async function getUtilityEmails() {
  const auth   = getOAuthClient();
  const gmail  = google.gmail({ version: 'v1', auth });
  const userId = process.env.GMAIL_USER;

  // 1. Encontrar el ID interno de la etiqueta "Utilities"
  const labelsRes = await gmail.users.labels.list({ userId });
  const labels    = labelsRes.data.labels || [];
  const utLabel   = labels.find(l => l.name.toLowerCase() === 'utilities');

  if (!utLabel) {
    throw new Error('No se encontró la etiqueta "Utilities" en Gmail. Créala y añade emails de prueba.');
  }

  // 2. Listar TODOS los mensajes desde el 1 de enero (con paginación)
  const messages = [];
  let pageToken  = undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId,
      labelIds:   [utLabel.id],
      maxResults: 500,
      q:          'after:2026/01/01',
      ...(pageToken ? { pageToken } : {}),
    });
    messages.push(...(listRes.data.messages || []));
    pageToken = listRes.data.nextPageToken;
  } while (pageToken);

  if (messages.length === 0) return [];

  // 3. Obtener el contenido completo de cada email, incluyendo PDFs adjuntos
  const emails = await Promise.all(
    messages.map(async ({ id }) => {
      const msgRes = await gmail.users.messages.get({
        userId,
        id,
        format: 'full',
      });

      const msg     = msgRes.data;
      const headers = msg.payload?.headers || [];

      const subject = headers.find(h => h.name === 'Subject')?.value || '(sin asunto)';
      const from    = headers.find(h => h.name === 'From')?.value    || '(desconocido)';
      const dateStr = headers.find(h => h.name === 'Date')?.value    || '';
      const body    = decodeBody(msg.payload);

      // Buscar PDFs adjuntos
      const pdfRefs = findPdfAttachments(msg.payload);

      // Descargar el primer PDF si existe (normalmente hay uno por factura)
      let pdfBase64 = null;
      if (pdfRefs.length > 0) {
        const attRes = await gmail.users.messages.attachments.get({
          userId,
          messageId: id,
          id:        pdfRefs[0].attachmentId,
        });
        // Gmail devuelve el PDF en base64url — lo convertimos a base64 estándar
        pdfBase64 = attRes.data.data?.replace(/-/g, '+').replace(/_/g, '/') || null;
      }

      return {
        id,
        subject,
        from,
        date:      dateStr ? new Date(dateStr).toISOString() : null,
        snippet:   msg.snippet || '',
        body,
        pdfBase64, // null si no hay PDF adjunto
      };
    })
  );

  return emails;
}
