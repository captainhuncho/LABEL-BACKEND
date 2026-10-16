// Privacy Policy, Terms of Use, Confidentiality and Copyright pages, plus the
// footer that links them. Shown only to people signed in to the platform.
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';

const CONTACT = 'Legal@imullar.com';
const EFFECTIVE = '16 October 2026';
const YEAR = new Date().getFullYear();

const Mail = () => <a href={'mailto:' + CONTACT} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>{CONTACT}</a>;

export const LEGAL_PAGES = {
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>This policy explains how IMSS Records (“we”, “us”) handles personal data on the IMSS Records platform at ops.imssrecords.com (the “Platform”). It is written to meet the Data Protection Act, 2012 (Act 843) of Ghana.</p>
        <h2>Who the Platform is for</h2>
        <p>The Platform is a private tool for IMSS Records staff and the artists signed to or distributed by IMSS Records. It is not open to the public.</p>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name and email address, used to sign you in with an email link. We do not store passwords.</li>
          <li><b>Artist profile:</b> details on your roster entry, such as your artist name, photo, genre, contract dates, royalty rate, deal type and your Product Manager.</li>
          <li><b>Royalty and payment information:</b> streams, sales and earnings reported by our distribution partners, the money we receive for them, statements, payouts and payout thresholds.</li>
          <li><b>What you send us:</b> release submissions, split sheets, lyrics, artwork, marketing plans, invoices, receipts, requests and messages, including replies you send by email.</li>
          <li><b>Technical data:</b> basic logs kept by our hosting providers, such as IP address and time of access, used for security.</li>
          <li><b>Blocked sign-in attempts:</b> the Platform is invite only. If someone who hasn’t been invited tries to sign in, we keep that email address, the sign-in method and the time for up to 30 days so an Admin can correct a mistaken block, then delete it. We don’t email them.</li>
        </ul>
        <h2>Why we use it</h2>
        <ul>
          <li>To account for and pay royalties, and to show you your earnings and statements.</li>
          <li>To review releases, invoices and requests, and to reply to you.</li>
          <li>To send you service emails, such as sign-in links, statements, earnings updates and replies.</li>
          <li>To keep the Platform secure and to meet our legal, tax and accounting obligations.</li>
        </ul>
        <p>We process this data to perform our agreements with you, to meet legal obligations, and for our legitimate interest in running the label. We do not sell personal data and we do not use it for advertising.</p>
        <h2>Who can see it</h2>
        <p>Artists see only their own information, and only what IMSS Records has published or sent to them. IMSS Records staff see what their role allows. We share data with our distribution partners where needed to administer your releases and royalties, and with professional advisers or authorities where the law requires.</p>
        <h2>Service providers</h2>
        <p>We use trusted providers to run the Platform: Supabase (database, sign-in and file storage, hosted in the European Union), Vercel (website hosting) and Resend (email). They process data only on our instructions. Some of this processing happens outside Ghana; we use providers that apply appropriate security and contractual safeguards.</p>
        <h2>Cookies and storage</h2>
        <p>The Platform does not use advertising or tracking cookies. Your browser stores a sign-in session so you stay signed in; signing out removes it.</p>
        <h2>How long we keep it</h2>
        <p>We keep your data while you work with IMSS Records and afterwards for as long as needed to account for royalties and to meet legal, tax and accounting requirements. Original statement files are kept as accounting records.</p>
        <h2>Your rights</h2>
        <p>Under Act 843 you can ask to see the personal data we hold about you, to have it corrected, and to object to or ask us to stop certain processing. Write to <Mail />. If you are not satisfied with our answer, you can complain to the Data Protection Commission of Ghana.</p>
        <h2>Security</h2>
        <p>Access is limited by sign-in and by role, enforced in our database. Data is encrypted in transit. No system is perfectly secure; if we learn of a breach affecting you, we will tell you and the authorities as the law requires.</p>
        <h2>Changes</h2>
        <p>We may update this policy. The date below shows the latest version.</p>
        <p>Contact: <Mail /></p>
      </>
    ),
  },
  terms: {
    title: 'Terms of Use',
    body: (
      <>
        <p>These terms apply to your use of the IMSS Records platform at ops.imssrecords.com (the “Platform”). By signing in you agree to them. They sit alongside, and do not replace, your recording, distribution or employment agreement with IMSS Records. If they conflict, your agreement wins.</p>
        <h2>Access</h2>
        <p>The Platform is for IMSS Records staff and its artists only. Your sign-in is personal: do not share sign-in links or let anyone else use your account. Tell us at once if you think someone else has accessed it.</p>
        <h2>Earnings and statements</h2>
        <p>Figures shown to artists are those IMSS Records has published, based on reports from our distribution partners and the money we actually receive, less the Inbound Banking Charge and as set out in your agreement. Figures can be corrected if a partner revises its report or an error is found; corrected figures replace earlier ones. Payments follow your agreement, your reporting period and your payout threshold. If you have a question about a figure, contact us within the time your agreement allows.</p>
        <h2>What you upload</h2>
        <p>You confirm that anything you upload or submit, including music, artwork, lyrics, split sheets, invoices and receipts, is accurate, is yours to share, and does not infringe anyone else’s rights. You keep ownership of your content; you allow IMSS Records to use it to run the Platform and to perform your agreement.</p>
        <h2>Acceptable use</h2>
        <p>Do not try to access data that is not yours, disrupt or probe the Platform, upload malicious files, or use the Platform for anything unlawful. We may suspend access to protect the Platform, other users or IMSS Records.</p>
        <h2>Availability</h2>
        <p>We work to keep the Platform available and accurate but provide it as is. To the extent the law allows, IMSS Records is not liable for indirect losses from using the Platform. Nothing in these terms limits liability that cannot be limited by law.</p>
        <h2>Changes and law</h2>
        <p>We may update these terms; continuing to use the Platform means you accept the update. These terms are governed by the laws of the Republic of Ghana, and the courts of Ghana have jurisdiction.</p>
        <p>Contact: <Mail /></p>
      </>
    ),
  },
  confidentiality: {
    title: 'Confidentiality',
    body: (
      <>
        <p>The Platform holds information that is confidential to IMSS Records, its artists and its partners. Everyone who uses it agrees to keep that information confidential.</p>
        <h2>What is confidential</h2>
        <ul>
          <li>Royalty statements, earnings, payouts, invoices and all other financial information.</li>
          <li>Contract terms, royalty rates, deal types, budgets and advances.</li>
          <li>Unreleased music, artwork, lyrics, release plans and marketing plans.</li>
          <li>Reports and statements from our distribution partners, including Label Partner Copies.</li>
          <li>Information about other artists, staff and partners.</li>
        </ul>
        <h2>Your obligations</h2>
        <p>Use confidential information only for working with IMSS Records. Do not share, publish or forward it to anyone else without our written permission, except your own professional advisers (such as your lawyer or accountant) who are bound to keep it confidential, or where the law requires. Artists may share their own statements with their advisers on that basis.</p>
        <p>Staff must handle artist information only as their role requires and follow IMSS Records’ data protection practices.</p>
        <h2>How long this lasts</h2>
        <p>These obligations continue after your access to the Platform ends.</p>
        <p>If you think confidential information has been shared by mistake, tell us straight away at <Mail />.</p>
      </>
    ),
  },
  copyright: {
    title: 'Copyright',
    body: (
      <>
        <p>© {YEAR} IMSS Records. All rights reserved.</p>
        <p>The Platform, including its design, text, software and the IMSS Records name and logo, belongs to IMSS Records and may not be copied or reused without permission.</p>
        <p>Recordings, compositions, artwork and other works shown on or uploaded to the Platform belong to their respective owners, which may be the artist, IMSS Records or others, as set out in the relevant agreements. Seeing a work on the Platform does not give you any right to use it.</p>
        <p>Names and logos of streaming services and distribution partners belong to their owners and are used only to identify where earnings come from.</p>
        <p>If you believe something on the Platform infringes your rights, write to <Mail /> with details of the work and where it appears.</p>
      </>
    ),
  },
};

export const LEGAL_PATHS = Object.keys(LEGAL_PAGES).map(k => '/' + k);

export function LegalPage({ page }) {
  const p = LEGAL_PAGES[page];
  return (
    <div style={{ height: '100dvh', background: CANVAS_GRADIENT, color: C.text, fontFamily: HEADING_FONT, overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main className="imss-legal" style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 24px' }}>
        <a href="/" aria-label="IMSS Records, back to the dashboard" style={{ display: 'inline-block' }}><img src={LOGO_DATA_URI} alt="" style={{ height: 32, width: 'auto', display: 'block', filter: 'var(--logo-filter)' }} /></a>
        <h1 style={{ fontFamily: HEADING_FONT, fontSize: 28, fontWeight: 700, margin: '16px 0 4px' }}>{p.title}</h1>
        <p style={{ color: C.textDim, fontSize: 13, marginBottom: 24 }}>Effective {EFFECTIVE}</p>
        <div className="imss-legal-body">{p.body}</div>
        <LegalFooter />
      </main>
    </div>
  );
}

export function LegalFooter() {
  const link = { color: C.textDim, textDecoration: 'underline', textUnderlineOffset: 3 };
  return (
    <footer className="imss-print-hide" style={{ borderTop: '1px solid ' + C.border, marginTop: 40, paddingTop: 16, paddingBottom: 8, fontSize: 12, color: C.textDim, display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'space-between' }}>
      <span>© {YEAR} IMSS Records. All rights reserved.</span>
      <nav aria-label="Legal" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
        {Object.entries(LEGAL_PAGES).map(([k, p]) => <a key={k} href={'/' + k} style={link}>{p.title}</a>)}
      </nav>
    </footer>
  );
}
