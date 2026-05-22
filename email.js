const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function fmtDate(str) {
  if (!str) return 'Not provided';
  try {
    return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return str; }
}

function statusEmoji(flag) {
  if (!flag) return '';
  if (flag.toLowerCase().includes('open')) return '🟢';
  if (flag.toLowerCase().includes('upcoming')) return '🟡';
  if (flag.toLowerCase().includes('passed')) return '🔴';
  return '⚪';
}

function buildNotificationEmail(payload) {
  const { user, songs } = payload;

  const interests = [
    user.mon_sale && '💰 Sale of rights',
    user.mon_license && '📄 Licensing / royalty monetization',
    user.mon_catalog && '📁 Catalog review',
  ].filter(Boolean).join(', ') || 'None selected';

  const royaltyMessage = user.final_monetization_thoughts
    ? `<p style="margin-top:10px;font-size:13px;"><strong>Royalty discussion message:</strong><br>${user.final_monetization_thoughts}</p>`
    : '';

  const html = `
  <div style="font-family:Arial;padding:20px">
    <h2>New Submission</h2>

    <p><strong>Name:</strong> ${user.name}</p>
    <p><strong>Email:</strong> ${user.email}</p>

    <h3>Monetization Interest</h3>
    <p>${interests}</p>

    <p><strong>Final choice:</strong> ${user.final_choice}</p>

    ${royaltyMessage}
  </div>
  `;

  return {
    from: `"Rights Back" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `New submission — ${user.name}`,
    html,
  };
}

async function sendNotification(payload) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const transport = createTransport();
  const mail = buildNotificationEmail(payload);
  await transport.sendMail(mail);
}

module.exports = { sendNotification };