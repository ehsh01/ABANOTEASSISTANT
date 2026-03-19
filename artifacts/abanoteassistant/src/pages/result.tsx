import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Copy, Save, Edit3, RotateCcw, AlertTriangle, CheckCircle2, ChevronLeft, Calendar, Clock, User, Wand2 } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { useSaveSessionNote } from "@/hooks/use-aba-api";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export default function Result() {
  const [, setLocation] = useLocation();
  const { generatedNote, reset } = useWizardStore();
  const saveMutation = useSaveSessionNote();
  
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!generatedNote) {
      setLocation("/");
    } else {
      setContent(generatedNote.content);
    }
  }, [generatedNote, setLocation]);

  if (!generatedNote) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (status: "draft" | "final") => {
    saveMutation.mutate({
      noteId: generatedNote.noteId,
      data: { status, content }
    });
  };

  const handleStartOver = () => {
    reset();
    setLocation("/");
  };

  // Format date nicely if it's a valid ISO string
  let displayDate = generatedNote.sessionDate;
  try {
    displayDate = format(parseISO(generatedNote.sessionDate), "MMMM d, yyyy");
  } catch (e) {
    // keep original string if parse fails
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-10 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-lg hover:bg-secondary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground font-display hidden sm:block">Session Note Generated</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
          </button>
          <button 
            onClick={() => handleSave("draft")}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-border font-medium hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>
          <button 
            onClick={() => handleSave("final")}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {saveMutation.isPending ? "Saving..." : "Save Final"}
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
             <div className="flex items-center gap-2 text-sm font-medium"><User className="w-4 h-4 text-muted-foreground"/> {generatedNote.clientName}</div>
             <div className="flex items-center gap-2 text-sm font-medium"><Calendar className="w-4 h-4 text-muted-foreground"/> {displayDate}</div>
             <div className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4 text-muted-foreground"/> {generatedNote.sessionHours} hrs</div>
          </div>

          <div className="relative flex-1 bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden flex flex-col">
            <div className="bg-secondary/30 border-b border-border px-6 py-3 flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Note Document</span>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={cn("text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors", isEditing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
              >
                <Edit3 className="w-4 h-4" />
                {isEditing ? "Editing" : "Edit"}
              </button>
            </div>
            
            <div className="flex-1 p-6 sm:p-10 relative">
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full min-h-[500px] resize-none border-none focus:outline-none focus:ring-0 bg-transparent text-foreground leading-relaxed text-[15px]"
                  autoFocus
                />
              ) : (
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed text-[15px] whitespace-pre-wrap">
                  {content}
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
            <h3 className="font-display font-bold text-lg border-b border-border/50 pb-2">Session Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><User className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">Client</div>
                  <div className="font-semibold text-foreground">{generatedNote.clientName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><Calendar className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-semibold text-foreground">{displayDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><Clock className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="font-semibold text-foreground">{generatedNote.sessionHours} hours</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Notice */}
          <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5">
            <div className="flex items-center gap-2 text-primary font-semibold mb-2">
              <Wand2 className="w-4 h-4" /> AI Generated
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This note was generated based on your inputs. Please review carefully and edit as needed to ensure complete clinical accuracy before saving as final.
            </p>
          </div>

          {/* Secondary Actions */}
          <div className="space-y-3">
            <button 
              onClick={() => setLocation("/wizard")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:border-primary/50 hover:bg-secondary/30 transition-all hover-elevate"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              Regenerate Note
            </button>
            <button 
              onClick={handleStartOver}
              className="w-full text-sm font-semibold text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              Start Over (New Note)
            </button>
          </div>
        </motion.div>

      </main>

      {/* Success Toast for Save (mock implementation) */}
      {saveMutation.isSuccess && (
        <div className="fixed bottom-6 right-6 bg-card border border-border shadow-xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-semibold text-sm">Note Saved</div>
            <div className="text-xs text-muted-foreground">Saved as {saveMutation.data?.data.status}</div>
          </div>
        </div>
      )}
    </div>
  );
}
