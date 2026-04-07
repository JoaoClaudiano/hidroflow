// Vercel Serverless Function — envia relatório PDF por e-mail via Resend.
// Variável de ambiente obrigatória: RESEND_API_KEY
// Endpoint: POST /api/send-report
// Body (JSON): { email: string, pdfBase64: string, municipio?: string }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { email, pdfBase64, municipio } = req.body || {};

  if (!email || !pdfBase64) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: email e pdfBase64.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Endereço de e-mail inválido.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'HidroFlow <relatorio@hidroflow.app>';
  if (!apiKey) {
    console.error('RESEND_API_KEY não configurada.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // Remove o prefixo data URI se presente (ex: "data:application/pdf;base64,...")
  const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;

  const nomeMunicipio = municipio || 'Município';
  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const payload = {
    from: fromEmail,
    to: [email],
    subject: `Relatório HidroFlow — ${nomeMunicipio} — ${dataFormatada}`,
    html: `
      <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a18;">
        <h2 style="color:#1a4fd6;margin-bottom:8px;">HidroFlow — Relatório de Dimensionamento</h2>
        <p style="color:#5a5a54;font-size:14px;line-height:1.6;">
          Segue em anexo o memorial de cálculo gerado para <strong>${nomeMunicipio}</strong>
          em ${dataFormatada}.
        </p>
        <hr style="border:none;border-top:1px solid #e8e8e4;margin:20px 0;">
        <p style="font-size:12px;color:#909088;">
          Gerado automaticamente pelo HidroFlow v5.0 — Suporte à Análise e Dimensionamento
          de Sistemas de Abastecimento de Água.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `hidroflow_${nomeMunicipio.replace(/\s+/g, '_')}.pdf`,
        content: base64Data,
      },
    ],
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Resend:', data);
      return res.status(response.status).json({
        error: data.message || 'Falha ao enviar e-mail.',
      });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Erro interno:', err);
    return res.status(500).json({ error: 'Erro interno ao enviar e-mail.' });
  }
}
