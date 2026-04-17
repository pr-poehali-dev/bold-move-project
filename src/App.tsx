
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Index      = lazy(() => import("./pages/Index"));
const AiHub      = lazy(() => import("./pages/AiHub"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const NotFound   = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="bg-[#0b0b11]" style={{ height: "100dvh" }} />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/hub" element={<AiHub />} />
            <Route path="/admin-yura" element={<AdminPanel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;