const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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
  <div style="font-family:Arial;padding:20px;max-width:600px">
    <h2 style="color:#1a1a18">✨ New Rights Back Submission</h2>
    
    <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0">
      <h3 style="margin-top:0">👤 Contact Info</h3>
      <p><strong>Name:</strong> ${user.name || 'Not provided'}</p>
      <p><strong>Email:</strong> <a href="mailto:${user.email}">${user.email}</a></p>
      <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
      ${user.pro ? `<p><strong>PRO:</strong> ${user.pro}</p>` : ''}
    </div>
    
    <div style="background:#fffbeb;padding:15px;border-radius:8px;margin:15px 0">
      <h3 style="margin-top:0">💼 Monetization Interest</h3>
      <p>${interests}</p>
      <p><strong>Final choice:</strong> ${user.final_choice || 'Not specified'}</p>
      ${royaltyMessage}
    </div>
    
    <div style="background:#f0fdf4;padding:15px;border-radius:8px;margin:15px 0">
      <h3 style="margin-top:0">🎵 Songs (${songs.length})</h3>
      <ul>
        ${songs.map(s => `<li><strong>${s.title || 'Untitled'}</strong>${s.uscoNumber ? ` - USCO: ${s.uscoNumber}` : ''}</li>`).join('')}
      </ul>
    </div>
    
    <hr style="margin:20px 0;border:none;border-top:1px solid #e5e5e5">
    <p style="font-size:12px;color:#888">
      Submitted: ${new Date().toLocaleString('en-US')}
    </p>
  </div>
  `;
  
  return {
    from: 'Rights Back <notifications@rightsback.net>',
    to: process.env.NOTIFY_EMAIL || user.email,
    subject: `🎵 New submission — ${user.name || user.email}`,
    html,
  };
}

async function sendNotification(payload) {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] ⚠️ Email not configured (missing RESEND_API_KEY)');
    return;
  }
  
  console.log('[EMAIL] 📧 Sending notification via Resend...');
  console.log('[EMAIL] To:', process.env.NOTIFY_EMAIL || payload.user.email);
  
  try {
    const emailData = buildNotificationEmail(payload);
    
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      throw new Error(error.message);
    }
    
    console.log('[EMAIL] ✅ Notification sent successfully');
    console.log('[EMAIL] Email ID:', data.id);
    
    return data;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send notification');
    console.error('[EMAIL] Error:', error.message);
    
    // Log specific Resend errors
    if (error.message.includes('API key')) {
      console.error('[EMAIL] 🔐 Invalid API key - check RESEND_API_KEY');
      console.error('[EMAIL] Get your key at: https://resend.com/api-keys');
    }
    
    throw error;
  }
}

module.exports = { sendNotification };
