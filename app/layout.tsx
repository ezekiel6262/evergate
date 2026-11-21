import '@fontsource/young-serif/400.css';
import '@fontsource-variable/onest';
import './globals.css';
import type { Metadata } from 'next';
import { VaultProvider } from '@/lib/store';
import { WalletProvider } from '@/lib/wallet';

export const metadata: Metadata = {
  title: 'Evergate: crypto inheritance that outlives us',
  description: 'Set a rule once. Check in now and then. If you stop, your guardians are alerted, and after a waiting period your heirs receive their shares. The rule is a TapeOut circuit on X Layer.',
  icons: { icon: 'icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider><VaultProvider>{children}</VaultProvider></WalletProvider>
      </body>
    </html>
  );
}
