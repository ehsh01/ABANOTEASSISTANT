import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/home";
import Wizard from "./pages/wizard";
import Result from "./pages/result";
import Clients from "./pages/clients";
import NewClient from "./pages/new-client";
import Notes from "./pages/notes";
import NoteDetail from "./pages/note-detail";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import AdminPage from "@/pages/admin";
import { useAuthStore } from "@/store/auth-store";

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
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wizard" component={Wizard} />
      <Route path="/result" component={Result} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/new" component={NewClient} />
      <Route path="/notes" component={Notes} />
      <Route path="/notes/:id" component={NoteDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/admin" component={AdminPage} />
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
