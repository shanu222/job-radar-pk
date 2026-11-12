import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import { DialogProvider } from '@/components/Dialog';
import CompleteProfile from '@/components/CompleteProfile';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'JobRadar PK — Every job in Pakistan & remote, with deadlines',
  description: 'Government, private, NGO, international remote and Reddit jobs in one place. Upload your CV to see matching jobs and get reminders before deadlines close.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <ToastProvider>
        <AuthProvider>
          <DialogProvider>
          <Navbar />
          <CompleteProfile />
          <main>{children}</main>
          <footer className="mt-24 border-t border-line py-10 text-center text-sm text-ink-soft">
            JobRadar PK aggregates public listings. Always confirm details and deadlines on the original posting before applying.
          </footer>
        </DialogProvider>
        </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
