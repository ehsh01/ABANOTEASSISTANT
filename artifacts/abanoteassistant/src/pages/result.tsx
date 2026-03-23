import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Copy, Save, Edit3, RotateCcw, CheckCircle2, ChevronLeft, Calendar, Clock, User, Wand2, Languages } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { useSaveSessionNote } from "@/hooks/use-aba-api";
import { useT } from "@/hooks/use-translation";
import { translateNote } from "@/lib/translate-note";
import { cn, formatSessionDate } from "@/lib/utils";

export default function Result() {
  const [, setLocation] = useLocation();
  const { generatedNote, generateWarnings, reset } = useWizardStore();
  const saveMutation = useSaveSessionNote();
  const t = useT();

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<"success" | "error" | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!generatedNote) {
      setLocation("/");
    } else {
      setContent(generatedNote.content);
    }
  }, [generatedNote, setLocation]);

  if (!generatedNote) return null;

  const isTranslated = translatedContent !== null;
  const displayContent = isTranslated ? translatedContent : content;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (status: "draft" | "final") => {
    setSaveBanner(null);
    setSaveMessage("");
    saveMutation.mutate(
      {
        noteId: generatedNote.noteId,
        data: { status, content },
      },
      {
        onSuccess: () => {
          setSaveBanner("success");
          window.setTimeout(() => {
            setSaveBanner(null);
            saveMutation.reset();
          }, 3500);
        },
        onError: (err) => {
          setSaveBanner("error");
          setSaveMessage(err instanceof Error ? err.message : "Save failed. Please try again.");
        },
      },
    );
  };

  const handleStartOver = () => {
    reset();
    setLocation("/");
  };

  const handleTranslate = async () => {
    if (isTranslated) {
      setTranslatedContent(null);
      return;
    }
    setIsTranslating(true);
    setTranslateError(null);
    try {
      const result = await translateNote(content, "es");
      setTranslatedContent(result);
    } catch {
      setTranslateError("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const displayDate = formatSessionDate(generatedNote.sessionDate);
  const usedOpenAI = generatedNote.generationSource === "openai";
  const modelLabel = generatedNote.generationModel?.trim() || "—";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary sticky top-0 z-10 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/")} className="text-white/80 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/15">
            <ChevronLeft className="w-5 h-5 pop-icon-white" />
          </button>
          <h1 className="text-lg font-bold text-white font-display hidden sm:block pop-text-white">{t.result.pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 text-white font-medium hover:bg-white/25 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300 pop-icon-white" /> : <Copy className="w-4 h-4 pop-icon-white" />}
            <span className="hidden sm:inline">{copied ? t.result.copied : t.result.copy}</span>
          </button>
          <button
            onClick={() => handleSave("draft")}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-white/30 text-white font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 pop-icon-white" />
            <span className="hidden sm:inline">{t.result.saveDraft}</span>
          </button>
          <button
            onClick={() => handleSave("final")}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold ring-2 ring-white/50 shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {saveMutation.isPending ? t.result.saving : t.result.saveFinal}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">

        {/* Main Document Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col"
        >
          {/* Metadata Banner (Mobile) */}
          <div className="lg:hidden flex flex-wrap gap-4 mb-4 p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4 text-muted-foreground pop-icon" /> {generatedNote.clientName}</div>
            <div className="flex items-center gap-2 text-sm font-medium"><Calendar className="w-4 h-4 text-muted-foreground pop-icon" /> {displayDate}</div>
            <div className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4 text-muted-foreground pop-icon" /> {generatedNote.sessionHours} {t.result.hours}</div>
          </div>

          <div className="relative flex-1 bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden flex flex-col">
            <div className="bg-secondary/30 border-b border-border px-6 py-3 flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isTranslated ? t.result.translatedLabel : t.result.documentLabel}
              </span>
              {!isTranslated && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={cn("text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors", isEditing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
                >
                  <Edit3 className="w-4 h-4 pop-icon" />
                  {isEditing ? t.result.editing : t.result.edit}
                </button>
              )}
            </div>

            <div className="flex-1 p-6 sm:p-10 relative">
              {isEditing && !isTranslated ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full min-h-[500px] resize-none border-none focus:outline-none focus:ring-0 bg-transparent text-foreground leading-relaxed text-[15px]"
                  autoFocus
                />
              ) : (
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed text-[15px] whitespace-pre-wrap">
                  {displayContent}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full lg:w-80 shrink-0 space-y-6"
        >
          {/* Metadata Card */}
          <div className="hidden lg:block bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <h3 className="font-display font-bold text-lg border-b border-border/50 pb-2">{t.result.sessionDetails}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><User className="w-4 h-4 pop-icon" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">{t.result.client}</div>
                  <div className="font-semibold text-foreground">{generatedNote.clientName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><Calendar className="w-4 h-4 pop-icon" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">{t.result.date}</div>
                  <div className="font-semibold text-foreground">{displayDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><Clock className="w-4 h-4 pop-icon" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">{t.result.duration}</div>
                  <div className="font-semibold text-foreground">{generatedNote.sessionHours} {t.result.hours}</div>
                </div>
              </div>
            </div>
          </div>

          {/* How the clinical body was produced */}
          <div
            className={cn(
              "rounded-2xl border p-5",
              usedOpenAI ? "bg-emerald-50/80 border-emerald-200" : "bg-amber-50/90 border-amber-200",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 font-semibold mb-2 text-sm",
                usedOpenAI ? "text-emerald-800" : "text-amber-900",
              )}
            >
              <Wand2 className="w-4 h-4 shrink-0 pop-icon" />
              {usedOpenAI ? t.result.sourceOpenaiTitle : t.result.sourceTemplateTitle}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {usedOpenAI
                ? t.result.sourceOpenaiBody.replace("{model}", modelLabel)
                : t.result.sourceTemplateBody}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">{t.result.aiNotice}</p>
          </div>

          {generateWarnings && generateWarnings.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t.result.serverNotices}</div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                {generateWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Translate Note Button */}
          <div className="space-y-2">
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary font-semibold hover:bg-primary/10 hover:border-primary/50 transition-all hover-elevate disabled:opacity-60 disabled:cursor-wait"
            >
              <Languages className="w-4 h-4" />
              {isTranslating
                ? t.result.translating
                : isTranslated
                ? t.result.translateToEnglish
                : t.result.translateToSpanish}
            </button>
            {translateError && (
              <p className="text-xs text-red-500 text-center">{translateError}</p>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setLocation("/wizard")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:border-primary/50 hover:bg-secondary/30 transition-all hover-elevate"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground pop-icon" />
              {t.result.regenerate}
            </button>
            <button
              onClick={handleStartOver}
              className="w-full text-sm font-semibold text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              {t.result.startOver}
            </button>
          </div>
        </motion.div>

      </main>

      {/* Save feedback */}
      {saveBanner === "success" && (
        <div className="fixed bottom-6 right-6 bg-card border border-border shadow-xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 pop-icon" />
          </div>
          <div>
            <div className="font-semibold text-sm">{t.result.noteSaved}</div>
            <div className="text-xs text-muted-foreground">{t.result.savedAs} {saveMutation.data?.data.status}</div>
          </div>
        </div>
      )}
      {saveBanner === "error" && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-card border border-destructive/30 shadow-xl rounded-xl p-4 z-50">
          <div className="font-semibold text-sm text-destructive">Could not save</div>
          <p className="text-xs text-muted-foreground mt-1">{saveMessage}</p>
        </div>
      )}
    </div>
  );
}
