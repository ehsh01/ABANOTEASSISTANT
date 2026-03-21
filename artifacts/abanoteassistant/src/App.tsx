import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/home";
import Wizard from "./pages/wizard";
import Result from "./pages/result";
import Clients from "./pages/clients";
import NewClient, { EditClientPage } from "./pages/new-client";
import Notes from "./pages/notes";
import NoteDetail from "./pages/note-detail";
import ClientDetail from "./pages/client-detail";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import AdminPage from "@/pages/admin";
import { useAuthStore } from "@/store/auth-store";
import { AppSidebar, SIDEBAR_WIDTH } from "@/components/app-sidebar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const NO_SIDEBAR_ROUTES = ["/"];

function AuthenticatedRoutes() {
  const token = useAuthStore((s) => s.token);
  const [location] = useLocation();

  if (!token) {
    return <Redirect to="/login" />;
  }

  const showSidebar = !NO_SIDEBAR_ROUTES.includes(location);

  return (
    <div className="flex min-h-screen">
      {showSidebar && <AppSidebar />}
      <main
        className={`flex-1 min-h-screen overflow-auto ${showSidebar ? "md:ml-[220px] pb-16 md:pb-0" : ""}`}
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/wizard" component={Wizard} />
          <Route path="/result" component={Result} />
          <Route path="/clients/edit/:clientId" component={EditClientPage} />
          <Route path="/clients/new" component={NewClient} />
          <Route path="/clients/:clientId" component={ClientDetail} />
          <Route path="/clients" component={Clients} />
          <Route path="/new-client" component={NewClient} />
          <Route path="/notes" component={Notes} />
          <Route path="/notes/:id" component={NoteDetail} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route component={AuthenticatedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
