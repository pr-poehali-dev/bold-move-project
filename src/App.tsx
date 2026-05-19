import { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, error.stack, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error;
      return (
        <div style={{ padding: 24, fontFamily: "monospace", background: "#0b0b11", color: "#ef4444", minHeight: "100dvh" }}>
          <div style={{ marginBottom: 8, fontWeight: "bold" }}>Ошибка: {e.message}</div>
          <pre style={{ fontSize: 11, color: "#f87171", whiteSpace: "pre-wrap" }}>{e.stack}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { BrandProvider } from "@/context/BrandContext";

const Index       = lazy(() => import("./pages/Index"));
const AdminPanel  = lazy(() => import("./pages/AdminPanel"));
const MasterAdmin = lazy(() => import("./pages/MasterAdmin"));
const MyOrders    = lazy(() => import("./pages/MyOrders"));
const Pricing     = lazy(() => import("./pages/Pricing"));
const WhiteLabel  = lazy(() => import("./pages/WhiteLabel"));
const NotFound    = lazy(() => import("./pages/NotFound"));
const PlanPage      = lazy(() => import("./pages/plan/PlanPage"));
const NewsPage      = lazy(() => import("./pages/NewsPage"));
const PlanSharePage = lazy(() => import("./pages/PlanSharePage"));
const CrmPage       = lazy(() => import("./pages/CrmPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BrandProvider>
            <ErrorBoundary>
            <Suspense fallback={<div className="bg-[#0b0b11]" style={{ height: "100dvh" }} />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/company"    element={<AdminPanel />} />
                <Route path="/master"    element={<MasterAdmin />} />
                <Route path="/my-orders" element={<MyOrders />} />
                <Route path="/pricing"   element={<Pricing />} />
                <Route path="/whitelabel" element={<WhiteLabel />} />
                <Route path="/plan"      element={<PlanPage />} />
                <Route path="/news"      element={<NewsPage />} />
                <Route path="/plan-share/:token" element={<PlanSharePage />} />
                <Route path="/crm"       element={<CrmPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrandProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;