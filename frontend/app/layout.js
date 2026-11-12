import '@fontsource-variable/public-sans';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import { DialogProvider } from '@/components/Dialog';
import CompleteProfile from '@/components/CompleteProfile';
import { ToastProvider } from '@/components/Toast';
import AuthGate from '@/components/AuthGate';

export const metadata = {
  title: 'JobRadar PK | Government, private and remote jobs with deadlines',
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
          <main><AuthGate>{children}</AuthGate></main>
          <footer className="mt-20 border-t border-line bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>JobRadar PK, by Sustainable Solution 360</span>
              <span>Listings come from public sources. Confirm details on the official advertisement before applying.</span>
            </div>
          </footer>
        </DialogProvider>
        </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
