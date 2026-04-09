import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Mic2, History, Settings } from "lucide-react";
import { useLang } from "@/contexts/language";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, lang, setLang } = useLang();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-primary tracking-tight">{t.appName}</h1>
          <div className="mt-4 rounded-md border border-border p-2">
            <div className="mb-2 text-xs text-muted-foreground">{t.common.language}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={lang === "en" ? "default" : "outline"}
                onClick={() => setLang("en")}
                className="h-8 px-3"
              >
                EN
              </Button>
              <Button
                size="sm"
                variant={lang === "vi" ? "default" : "outline"}
                onClick={() => setLang("vi")}
                className="h-8 px-3"
              >
                VI
              </Button>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location === "/" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <LayoutDashboard size={20} />
              <span>{t.nav.dashboard}</span>
            </div>
          </Link>
          <Link href="/scenarios">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location.startsWith("/scenarios") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Mic2 size={20} />
              <span>{t.nav.scenarios}</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location.startsWith("/history") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <History size={20} />
              <span>{t.nav.history}</span>
            </div>
          </Link>
        </nav>
        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground">
            <Settings size={20} />
            <span>{t.nav.settings}</span>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden">
        {children}
      </main>
    </div>
  );
}
