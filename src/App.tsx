import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  House, UserRoundPlus, ClipboardList, Settings2, ScanFace,
  ShieldCheck, Shield, BookOpen, LogOut, LogIn, KeyRound,
} from "lucide-react";

import { Home } from "./components/sections/Home";
import { Register } from "./components/sections/Register";
import { CheckIn } from "./components/sections/CheckIn";
import { AttendanceList } from "./components/sections/AttendanceList";
import { Admin } from "./components/sections/Admin";
import { LoginScreen } from "./components/LoginScreen";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

const queryClient = new QueryClient();

function AppLayout() {
  const { isAdmin, isLead, isOperation, isTeacher, adminToken, adminUsername, adminLogout, teacherDisplayName } = useAuth();
  const { t, locale, setLocale } = useLanguage();

  const [activeTab, setActiveTab] = useState("home");
  const [changePwOpen, setChangePwOpen] = useState(false);

  useEffect(() => {
    if (isOperation && !isLead) setActiveTab("register");
    else if (isTeacher) setActiveTab("home");
    else if (!isAdmin && !isTeacher) setActiveTab("home");
  }, [isOperation, isLead, isTeacher, isAdmin]);

  if (!adminToken) return <LoginScreen />;

  const effectiveTab = activeTab;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-brand shadow-sm">
              <ScanFace className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground hidden sm:block">
              {t("appTitle")}
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Locale toggle */}
            <button
              onClick={() => setLocale(locale === "th" ? "en" : "th")}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
              title={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
              {locale === "th" ? "EN" : "ไทย"}
            </button>

            {/* Role badge */}
            {isLead && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1.5 max-w-[180px] truncate">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Lead</span>
              </div>
            )}
            {isOperation && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 max-w-[180px] truncate">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Operation</span>
              </div>
            )}
            {isTeacher && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 max-w-[200px] truncate">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{teacherDisplayName ?? adminUsername}</span>
              </div>
            )}

            {/* Change password (teacher only) */}
            {isTeacher && (
              <button
                onClick={() => setChangePwOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-full px-3 py-1.5 transition-colors shrink-0"
                title={t("settingsMyPwTitle")}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("settingsMyPwTitle")}</span>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={adminLogout}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground/50 rounded-full px-3 py-1.5 transition-colors shrink-0"
              title={t("logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </button>
          </div>
        </div>
      </header>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Tabs
          value={effectiveTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          {/* Tab bar */}
          <div className="flex justify-center mb-8">
            <TabsList className="flex h-auto bg-muted/60 border border-border/60 p-1 gap-0.5 rounded-2xl shadow-sm flex-wrap">
              {/* Home — Lead AND teacher only (not operation) */}
              {(isLead || isTeacher) && (
                <TabsTrigger
                  value="home"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <House className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabHome")}
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger
                  value="register"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <UserRoundPlus className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabRegister")}
                </TabsTrigger>
              )}
              {/* CheckIn — Lead AND teacher only (not operation) */}
              {(isLead || isTeacher) && (
                <TabsTrigger
                  value="checkin"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <LogIn className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabCheckin")}
                  {isTeacher && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 ml-0.5" />
                  )}
                </TabsTrigger>
              )}
              {/* CheckOut — Lead AND teacher only (not operation) */}
              {(isLead || isTeacher) && (
                <TabsTrigger
                  value="checkout"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabCheckout")}
                  {isTeacher && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 ml-0.5" />
                  )}
                </TabsTrigger>
              )}
              {/* Records — Lead AND teacher only (not operation) */}
              {(isLead || isTeacher) && (
                <TabsTrigger
                  value="list"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <ClipboardList className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabList")}
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger
                  value="admin"
                  className="flex items-center gap-1.5 py-2 px-3.5 text-sm rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=active]:font-semibold whitespace-nowrap transition-all"
                >
                  <Settings2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {t("tabAdmin")}
                  <span className={`h-2 w-2 rounded-full ml-0.5 ${isLead ? "bg-purple-500" : "bg-green-500"}`} />
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="home" className="mt-0">
            <Home />
          </TabsContent>
          <TabsContent value="register" className="mt-0">
            <Register />
          </TabsContent>
          <TabsContent value="checkin" className="mt-0">
            <CheckIn mode="check_in" />
          </TabsContent>
          <TabsContent value="checkout" className="mt-0">
            <CheckIn mode="check_out" />
          </TabsContent>
          <TabsContent value="list" className="mt-0">
            <AttendanceList />
          </TabsContent>
          <TabsContent value="admin" className="mt-0">
            <Admin />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppLayout />
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
