import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
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
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import AdminPage from "@/pages/admin";
import { useAuthStore } from "@/store/auth-store";
import {
  AuthenticatedSessionBar,
  AUTH_SESSION_BAR_OFFSET_CLASS,
} from "@/components/authenticated-session-bar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function AuthenticatedRoutes() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <>
      <AuthenticatedSessionBar />
      <div className={AUTH_SESSION_BAR_OFFSET_CLASS}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/wizard" component={Wizard} />
          <Route path="/result" component={Result} />
          <Route path="/clients/edit/:clientId" component={EditClientPage} />
          <Route path="/clients/new" component={NewClient} />
          <Route path="/clients" component={Clients} />
          {/* Wizard links here; keep in sync with /clients/new */}
          <Route path="/new-client" component={NewClient} />
          <Route path="/notes" component={Notes} />
          <Route path="/notes/:id" component={NoteDetail} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </>
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
