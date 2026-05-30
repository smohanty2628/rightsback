require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function fmtDate(str) {
  if (!str) return 'Not provided';
  try {
    return new Date(str).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
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
  const { user, songs, analysis_id } = payload;

  const interests = [
    user.mon_sale    && '💰 Sale of rights',
    user.mon_license && '📄 Licensing / royalty monetization',
    user.mon_catalog && '📁 Catalog review',
  ].filter(Boolean).join(', ') || 'None selected';

  const royaltyMessage = user.final_monetization_thoughts
    ? `<p style="margin-top:10px;font-size:13px;">
         <strong>Royalty discussion message:</strong><br>
         ${user.final_monetization_thoughts}
       </p>`
    : '';

  const songsHTML = songs.map(s => {
    const r = s.result || {};
    const t = r.timing || {};
    return `
      <div style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:12px;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:bold;">
          🎵 ${s.title || 'Untitled'}
        </p>
        ${s.artistName  ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>Artist:</strong> ${s.artistName}</p>` : ''}
        ${s.recordLabel ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>Label:</strong> ${s.recordLabel}</p>` : ''}
        ${s.uscoNumber  ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>USCO #:</strong> ${s.uscoNumber}</p>` : ''}
        ${s.publisherName ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>Publisher:</strong> ${s.publisherName}</p>` : ''}
        ${s.grantDate   ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>Grant Date:</strong> ${fmtDate(s.grantDate)}</p>` : ''}
        ${s.pubDate     ? `<p style="margin:2px 0;font-size:13px;color:#555;"><strong>Release Date:</strong> ${fmtDate(s.pubDate)}</p>` : ''}
        ${r.routing ? `
          <div style="margin-top:10px;padding:10px;background:#f9fafb;border-radius:6px;">
            <p style="margin:2px 0;font-size:13px;"><strong>Section:</strong> §${r.routing === '203' ? '203' : '304'}</p>
            ${t.statusFlag ? `<p style="margin:2px 0;font-size:13px;"><strong>Status:</strong> ${statusEmoji(t.statusFlag)} ${t.statusFlag}</p>` : ''}
            ${t.termStart  ? `<p style="margin:2px 0;font-size:13px;"><strong>Window Opens:</strong> ${fmtDate(t.termStart)}</p>` : ''}
            ${t.termEnd    ? `<p style="margin:2px 0;font-size:13px;"><strong>Window Closes:</strong> ${fmtDate(t.termEnd)}</p>` : ''}
            ${t.noticeOpen ? `<p style="margin:2px 0;font-size:13px;"><strong>Earliest Notice Date:</strong> ${fmtDate(t.noticeOpen)}</p>` : ''}
            ${t.noticeClose? `<p style="margin:2px 0;font-size:13px;"><strong>Latest Notice Date:</strong> ${fmtDate(t.noticeClose)}</p>` : ''}
          </div>
        ` : ''}
      </div>`;
  }).join('');

  const html = `
  <div style="font-family:Arial,sans-serif;padding:28px;max-width:620px;color:#1a1a18;">

    <h2 style="margin:0 0 4px;color:#1a1a18;">🎵 New RightsBack Submission</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#888;">
      Submitted: ${new Date().toLocaleString('en-US')}
      ${analysis_id ? ` &nbsp;·&nbsp; ID: ${analysis_id.slice(0,8)}` : ''}
    </p>

    <!-- Contact -->
    <div style="background:#f5f0e8;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h3 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">
        Contact Information
      </h3>
      <p style="margin:4px 0;"><strong>Name:</strong> ${user.name || 'Not provided'}</p>
      <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${user.email}" style="color:#1d4ed8;">${user.email}</a></p>
      ${user.phone   ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${user.phone}</p>` : ''}
      ${user.country ? `<p style="margin:4px 0;"><strong>Country:</strong> ${user.country}</p>` : ''}
      ${user.pro     ? `<p style="margin:4px 0;"><strong>PRO:</strong> ${user.pro}</p>` : ''}
      ${user.ipi     ? `<p style="margin:4px 0;"><strong>IPI:</strong> ${user.ipi}</p>` : ''}
      <p style="margin:4px 0;"><strong>Contact preference:</strong> ${user.contact_pref || 'Not specified'}</p>
    </div>

    <!-- Monetization -->
    <div style="background:#fffbeb;border:1px solid #fbbf24;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h3 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;color:#b45309;">
        Monetization Interest
      </h3>
      <p style="margin:4px 0;"><strong>Interests:</strong> ${interests}</p>
      <p style="margin:4px 0;"><strong>Final choice:</strong> ${user.final_choice || 'Not specified'}</p>
      ${user.mon_royalties ? `<p style="margin:4px 0;"><strong>Annual royalties:</strong> ${user.mon_royalties}</p>` : ''}
      ${royaltyMessage}
    </div>

    <!-- Songs -->
    <div style="margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">
        Songs (${songs.length})
      </h3>
      ${songsHTML}
    </div>

    <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
    <p style="font-size:11px;color:#aaa;margin:0;">
      Rights Back Calculator &nbsp;·&nbsp; rightsback.net &nbsp;·&nbsp; Powered by Adage Music
    </p>
  </div>`;

  // Send to BOTH Herb and Subham
  const recipients = [];
  if (process.env.NOTIFY_EMAIL)  recipients.push(process.env.NOTIFY_EMAIL);
  if (process.env.HERB_EMAIL)    recipients.push(process.env.HERB_EMAIL);
  // fallback if neither set
  if (recipients.length === 0)   recipients.push(user.email);

  return {
    // ✅ FIX: Use Resend's verified sender domain until rightsback.net is verified
    from: 'Rights Back <onboarding@resend.dev>',
    to: recipients,
    reply_to: 'jordan@adagegroup.net',
    subject: `🎵 New RightsBack submission — ${user.name || user.email} (${songs.length} song${songs.length !== 1 ? 's' : ''})`,
    html,
  };
}

async function sendNotification(payload) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] ⚠️ RESEND_API_KEY not set — skipping email');
    return;
  }

  console.log('[EMAIL] 📧 Sending notification via Resend...');

  try {
    const emailData = buildNotificationEmail(payload);
    console.log('[EMAIL] To:', emailData.to);

    const { data, error } = await resend.emails.send(emailData);

    if (error) throw new Error(error.message);

    console.log('[EMAIL] ✅ Notification sent | ID:', data.id);
    return data;

  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send notification');
    console.error('[EMAIL] Error:', error.message);
    throw error;
  }
}

module.exports = { sendNotification };