import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen gradient-bg text-[var(--color-text-primary)]">
      {/* Mobile: top navbar */}
      <Navbar />

      {/* PC: left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="md:ml-56 min-h-screen pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Mobile: bottom tab navigation */}
      <BottomNav />
    </div>
  );
}
