import { createRoot } from "react-dom/client";
import { setAccessTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { useAuthStore } from "./store/auth-store";

setAccessTokenGetter(() => useAuthStore.getState().token ?? undefined);

createRoot(document.getElementById("root")!).render(<App />);
