import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Backstop error handler: any unhandled exception from a route returns a JSON
// payload (matching the shape used elsewhere) instead of Express's default
// HTML "Internal Server Error" page. The HTML page breaks the React UI which
// expects `{ success, error, messages }`. Specific routes still return their
// own JSON 4xx/5xx responses; this catches anything they miss.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  console.error("[express:unhandled]", err);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    messages: [message.length > 400 ? `${message.slice(0, 400)}…` : message],
  });
});

export default app;
