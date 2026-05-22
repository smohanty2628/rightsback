const nodemailer = require('nodemailer');

function createTransport() {
  // Try secure connection (port 465) - might work better on Railway
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Add timeouts to prevent hanging
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
}

function fmtDate(str) {
  if (!str) return 'Not provided';
  try {
    return new Date(str).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch { 
    return str; 
  }
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
    <h2>✨ New Rights Back Submission</h2>
    
    <h3>👤 Contact Info</h3>
    <p><strong>Name:</strong> ${user.name || 'Not provided'}</p>
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
    
    <h3>💼 Monetization Interest</h3>
    <p>${interests}</p>
    <p><strong>Final choice:</strong> ${user.final_choice || 'Not specified'}</p>
    ${royaltyMessage}
    
    <h3>🎵 Songs (${songs.length})</h3>
    <ul>
      ${songs.map(s => `<li>${s.title || 'Untitled'}</li>`).join('')}
    </ul>
    
    <hr style="margin:20px 0">
    <p style="font-size:12px;color:#666">
      Submitted: ${new Date().toLocaleString('en-US')}
    </p>
  </div>
  `;
  
  return {
    from: `"Rights Back" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `🎵 New submission — ${user.name || user.email}`,
    html,
  };
}

async function sendNotification(payload) {
  // Check if email is configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[EMAIL] ⚠️ Email not configured (missing GMAIL_USER or GMAIL_APP_PASSWORD)');
    return;
  }
  
  if (!process.env.NOTIFY_EMAIL) {
    console.log('[EMAIL] ⚠️ Email not configured (missing NOTIFY_EMAIL)');
    return;
  }
  
  console.log('[EMAIL] 📧 Sending notification...');
  console.log('[EMAIL] From:', process.env.GMAIL_USER);
  console.log('[EMAIL] To:', process.env.NOTIFY_EMAIL);
  
  try {
    const transport = createTransport();
    const mail = buildNotificationEmail(payload);
    
    const info = await transport.sendMail(mail);
    
    console.log('[EMAIL] ✅ Notification sent successfully');
    console.log('[EMAIL] Message ID:', info.messageId);
    
    return info;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send notification');
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Error message:', error.message);
    
    // Log specific Gmail errors
    if (error.code === 'EAUTH') {
      console.error('[EMAIL] 🔐 Authentication failed - check GMAIL_APP_PASSWORD');
      console.error('[EMAIL] Make sure you created an App Password (not regular password)');
      console.error('[EMAIL] https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.error('[EMAIL] 🌐 Connection timeout - Railway may be blocking SMTP');
      console.error('[EMAIL] Try using a transactional email service like SendGrid or Resend');
    }
    
    throw error;
  }
}

module.exports = { sendNotification };
