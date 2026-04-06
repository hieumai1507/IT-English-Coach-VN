import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Mic2, History, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-primary tracking-tight">IT English Coach</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location === "/" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </div>
          </Link>
          <Link href="/scenarios">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location.startsWith("/scenarios") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Mic2 size={20} />
              <span>Scenarios</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location.startsWith("/history") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <History size={20} />
              <span>History</span>
            </div>
          </Link>
        </nav>
        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Settings size={20} />
            <span>Settings</span>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-[100dvh] overflow-hidden">
        {children}
      </main>
    </div>
  );
}
