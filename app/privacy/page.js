export const metadata = {
  title: 'Privacy Policy — Edonis Utility Dashboard',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px', fontFamily: 'Georgia, serif', color: '#2c2c2c', lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>Last updated: April 22, 2026</p>

      <p>
        This Privacy Policy describes how the Edonis Utility Dashboard ("the App") collects, uses, and
        protects information obtained through its connection to QuickBooks Online and Gmail.
        The App is operated by The Dream Management LLC for internal business use only.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>1. Information We Access</h2>
      <p>The App accesses the following data solely to provide its core functionality:</p>
      <ul>
        <li><strong>QuickBooks Online:</strong> Bills, payments, vendors, and account information from the connected company.</li>
        <li><strong>Gmail:</strong> Emails in the designated "Utilities" folder, including subject lines, sender addresses, and email body content.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>2. How We Use the Information</h2>
      <p>Data accessed by the App is used exclusively to:</p>
      <ul>
        <li>Display and organise utility bills in the internal dashboard.</li>
        <li>Match utility invoices to the corresponding QuickBooks entries.</li>
        <li>Allow authorised staff to track payment status across properties.</li>
      </ul>
      <p>We do not use this data for marketing, advertising, or any purpose beyond the above.</p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>3. Data Storage</h2>
      <p>
        Extracted bill information (amounts, due dates, utility type, property address) is stored in a
        secure PostgreSQL database hosted on Neon (AWS us-east-1). Raw email content and QuickBooks
        credentials are never stored permanently — only the structured data extracted from them.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>4. Data Sharing</h2>
      <p>
        We do not sell, rent, or share any data with third parties. Data is only accessible to
        authorised employees of The Dream Management LLC.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>5. QuickBooks Data</h2>
      <p>
        This App connects to QuickBooks Online via Intuit's official OAuth 2.0 API. We access only the
        data necessary to display and reconcile utility bills. We do not access payroll, employee records,
        or any financial data beyond bills and payments. Access tokens are stored securely and never
        exposed to end users.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>6. Security</h2>
      <p>
        All data is transmitted over HTTPS. OAuth tokens are stored in environment variables on the
        server and are never included in client-side code. Access to the App is restricted to
        authorised personnel only.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>7. Data Retention</h2>
      <p>
        Bill data is retained for as long as it is needed for business operations. Users may request
        deletion of their data at any time by contacting us at the address below.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>8. Contact</h2>
      <p>
        For any questions regarding this Privacy Policy, please contact:<br />
        <a href="mailto:lluis@agendayatrae.com" style={{ color: '#8B6343' }}>lluis@agendayatrae.com</a>
      </p>
    </main>
  );
}
