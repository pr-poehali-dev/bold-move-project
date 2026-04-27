import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";

const Index       = lazy(() => import("./pages/Index"));
const AiHub       = lazy(() => import("./pages/AiHub"));
const AdminPanel  = lazy(() => import("./pages/AdminPanel"));
const MasterAdmin = lazy(() => import("./pages/MasterAdmin"));
const MyOrders    = lazy(() => import("./pages/MyOrders"));
const NotFound    = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="bg-[#0b0b11]" style={{ height: "100dvh" }} />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/hub" element={<AiHub />} />
              <Route path="/company"    element={<AdminPanel />} />
              <Route path="/master"    element={<MasterAdmin />} />
              <Route path="/my-orders" element={<MyOrders />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;