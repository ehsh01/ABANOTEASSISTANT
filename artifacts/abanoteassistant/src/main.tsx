import { createRoot } from "react-dom/client";
import { setAccessTokenGetter, setApiBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { useAuthStore } from "./store/auth-store";

const viteApiBase = import.meta.env.VITE_API_BASE_URL;
if (typeof viteApiBase === "string" && viteApiBase.trim().length > 0) {
  setApiBaseUrl(viteApiBase.trim());
}

setAccessTokenGetter(() => useAuthStore.getState().token ?? undefined);

createRoot(document.getElementById("root")!).render(<App />);
