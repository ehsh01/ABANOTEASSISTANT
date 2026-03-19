import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Copy, CheckCircle2, ChevronLeft, Calendar, Clock, User, Edit3, Save, FileText } from "lucide-react";
import { useNotesStore } from "@/store/notes-store";
import { cn, formatSessionDate } from "@/lib/utils";

const BILLING_CODE_LABELS: Record<string, string> = {
  "97153": "Adaptive Behavior Treatment by Protocol",
  "97155": "Adaptive Behavior Treatment with Protocol Modification",
  "97156": "Adaptive Behavior Treatment with Caregiver/Training",
};

export default function NoteDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { notes, updateNote } = useNotesStore();
  const note = notes.find((n) => n.id === params.id);

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note?.content ?? "");
  const [saved, setSaved] = useState(false);

  if (!note) {
    setLocation("/notes");
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (status: "draft" | "final") => {
    updateNote(note.id, { content, status });
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const durationHours =
    (() => {
      const [sh, sm] = note.startTime.split(":").map(Number);
      const [eh, em] = note.endTime.split(":").map(Number);
      return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary sticky top-0 z-10 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/notes")}
            className="text-white/80 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/15"
          >
            <ChevronLeft className="w-5 h-5 pop-icon-white" />
          </button>
          <h1 className="text-lg font-bold text-white hidden sm:block pop-text-white">
            {note.clientName} — {formatSessionDate(note.sessionDate)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 text-white font-medium hover:bg-white/25 transition-colors"
          >
            {copied
              ? <CheckCircle2 className="w-4 h-4 text-emerald-300 pop-icon-white" />
              : <Copy className="w-4 h-4 pop-icon-white" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
          </button>
          {note.status === "draft" && (
            <button
              onClick={() => handleSave("draft")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-white/30 text-white font-medium hover:bg-white/15 transition-colors"
            >
              <Save className="w-4 h-4 pop-icon-white" />
              <span className="hidden sm:inline">Save Draft</span>
            </button>
          )}
          <button
            onClick={() => handleSave("final")}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-white text-primary font-semibold shadow-md hover:-translate-y-0.5 transition-all"
          >
            Save Final
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">

        {/* Note Document */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col"
        >
          {/* Mobile metadata */}
          <div className="lg:hidden flex flex-wrap gap-4 mb-4 p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="w-4 h-4 text-muted-foreground pop-icon" /> {note.clientName}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4 text-muted-foreground pop-icon" /> {formatSessionDate(note.sessionDate)}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-muted-foreground pop-icon" /> {durationHours} hrs
            </div>
          </div>

          <div className="relative flex-1 bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden flex flex-col">
            <div className="bg-secondary/30 border-b border-border px-6 py-3 flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Note Document</span>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
                  isEditing
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Edit3 className="w-4 h-4 pop-icon" />
                {isEditing ? "Editing" : "Edit"}
              </button>
            </div>

            <div className="flex-1 p-6 sm:p-10">
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

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full lg:w-80 shrink-0 space-y-6"
        >
          <div className="hidden lg:block bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-lg border-b border-border/50 pb-2 pop-text">Session Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                  <User className="w-4 h-4 pop-icon" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Client</div>
                  <div className="font-semibold text-foreground">{note.clientName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                  <Calendar className="w-4 h-4 pop-icon" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-semibold text-foreground">{formatSessionDate(note.sessionDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                  <Clock className="w-4 h-4 pop-icon" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="font-semibold text-foreground">{durationHours} hours</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                  <FileText className="w-4 h-4 pop-icon" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Billing Code</div>
                  <div className="font-semibold text-foreground">{note.billingCode}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{BILLING_CODE_LABELS[note.billingCode]}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className={cn(
            "rounded-2xl border p-5",
            note.status === "final"
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          )}>
            <div className={cn(
              "font-semibold mb-1 text-sm",
              note.status === "final" ? "text-emerald-700" : "text-amber-700"
            )}>
              {note.status === "final" ? "✓ Finalized Note" : "⚠ Draft — Not yet finalized"}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {note.status === "final"
                ? "This note has been marked as final. You can still edit and re-save if corrections are needed."
                : "This note is still in draft. Review and click \"Save Final\" when ready to finalize."}
            </p>
          </div>
        </motion.div>
      </main>

      {/* Save toast */}
      {saved && (
        <div className="fixed bottom-6 right-6 bg-card border border-border shadow-xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 pop-icon" />
          </div>
          <div>
            <div className="font-semibold text-sm">Note Saved</div>
            <div className="text-xs text-muted-foreground">Changes saved successfully</div>
          </div>
        </div>
      )}
    </div>
  );
}
