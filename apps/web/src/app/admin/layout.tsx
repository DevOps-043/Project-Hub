"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminNavbar } from "@/components/admin/AdminNavbar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import shellStyles from "@/components/admin/AdminShell.module.css";

const MOBILE_BREAKPOINT = 1024;

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Detect mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
        setIsMobileOpen(false);
      }
    };

    // Initial check
    handleChange(mql);

    // Listen for changes
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return (
    <div className={shellStyles.shell}>
        {/* Sidebar - Fijo a la izquierda */}
        <AdminSidebar
          isCollapsed={isMobile ? false : sidebarCollapsed}
          onToggle={toggleSidebar}
          isMobile={isMobile}
          isMobileOpen={isMobileOpen}
          onMobileClose={closeMobileSidebar}
        />

        {/* Navbar - Fijo arriba, se ajusta horizontalmente */}
        <AdminNavbar
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={toggleSidebar}
          isMobile={isMobile}
        />

        {/* Main Content */}
        <main
          className={`${shellStyles.main} ${!isMobile && sidebarCollapsed ? shellStyles.mainCollapsed : ""}`}
        >
          <div className={shellStyles.content}>{children}</div>
        </main>

    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AuthGuard>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthGuard>
  );
}
