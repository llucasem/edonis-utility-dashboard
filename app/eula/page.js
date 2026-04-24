export const metadata = {
  title: 'End-User License Agreement — Edonis Utility Dashboard',
};

export default function EulaPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px', fontFamily: 'Georgia, serif', color: '#2c2c2c', lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>End-User License Agreement</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>Last updated: April 22, 2026</p>

      <p>
        This End-User License Agreement ("Agreement") is a legal agreement between you and
        The Dream Management LLC ("Company") for the use of the Edonis Utility Dashboard ("the App"),
        accessible at <a href="https://edonis-utility-dashboard.vercel.app" style={{ color: '#8B6343' }}>https://edonis-utility-dashboard.vercel.app</a>.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>1. License Grant</h2>
      <p>
        The Company grants you a limited, non-exclusive, non-transferable license to access and use
        the App solely for internal business purposes within The Dream Management LLC.
        This App is not available to the general public.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>2. Permitted Use</h2>
      <p>You may use the App to:</p>
      <ul>
        <li>View and manage utility bills across properties managed by The Dream Management LLC.</li>
        <li>Connect to and read data from QuickBooks Online and Gmail accounts authorised by the Company.</li>
        <li>Track payment status and export billing data for accounting purposes.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>3. Restrictions</h2>
      <p>You may not:</p>
      <ul>
        <li>Share access credentials with unauthorised individuals.</li>
        <li>Use the App for any purpose other than internal business operations.</li>
        <li>Attempt to reverse-engineer, copy, or redistribute any part of the App.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>4. Third-Party Services</h2>
      <p>
        The App integrates with QuickBooks Online (Intuit Inc.) and Gmail (Google LLC).
        Use of these services is governed by their respective terms of service. The Company is not
        responsible for any changes to third-party APIs that may affect App functionality.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>5. Data and Privacy</h2>
      <p>
        Your use of the App is also governed by our{' '}
        <a href="/privacy" style={{ color: '#8B6343' }}>Privacy Policy</a>.
        By using the App, you consent to the data practices described therein.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>6. Disclaimer of Warranties</h2>
      <p>
        The App is provided "as is" without warranties of any kind. The Company does not guarantee
        uninterrupted or error-free operation of the App.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, the Company shall not be liable for any indirect,
        incidental, or consequential damages arising from your use of the App.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>8. Termination</h2>
      <p>
        This Agreement is effective until terminated. The Company may terminate your access at any
        time without notice if you breach any terms of this Agreement.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40, marginBottom: 12 }}>9. Contact</h2>
      <p>
        For questions regarding this Agreement, contact:<br />
        <a href="mailto:lluis@agendayatrae.com" style={{ color: '#8B6343' }}>lluis@agendayatrae.com</a>
      </p>
    </main>
  );
}
