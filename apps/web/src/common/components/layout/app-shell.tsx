import { Outlet } from 'react-router-dom';
import { useState, type ReactElement } from 'react';
import { Sheet, SheetContent } from '@/common/components/ui/sheet';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useMediaQuery } from '@/common/hooks/use-media-query';

export function AppShell(): ReactElement {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      )}

      {/* Mobile sidebar (Sheet overlay) */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar collapsed={false} onToggleCollapse={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overscroll-y-contain bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
