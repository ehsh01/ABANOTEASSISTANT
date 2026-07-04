import { useMemo } from "react";
import { Link } from "wouter";
import { FileText, Loader2, RotateCcw, ExternalLink } from "lucide-react";
import { useDiscardDrafts, useDraftQuota, useNotesList } from "@/hooks/use-aba-api";
import { useT } from "@/hooks/use-translation";
import { formatSessionDate } from "@/lib/utils";

type DraftQuotaRecoveryProps = {
  /** Called after discard succeeds so the parent can clear errors and retry. */
  onReadyToRetry?: () => void;
  /** Show even before quota fetch completes (e.g. right after a 429). */
  forceShow?: boolean;
};

export function DraftQuotaRecoveryPanel({ onReadyToRetry, forceShow = false }: DraftQuotaRecoveryProps) {
  const t = useT();
  const draftQuotaQuery = useDraftQuota();
  const notesQuery = useNotesList();
  const discardMutation = useDiscardDrafts();

  const quota = draftQuotaQuery.data?.data;
  const atCap = quota != null && quota.used >= quota.max;

  const draftNotes = useMemo(() => {
    const rows = notesQuery.data?.data ?? [];
    return rows
      .filter((n) => n.status === "draft")
      .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  }, [notesQuery.data?.data]);

  if (!forceShow && !atCap && draftNotes.length === 0) {
    return null;
  }

  const used = quota?.used ?? draftNotes.length;
  const max = quota?.max ?? 3;

  const handleDiscard = () => {
    discardMutation.mutate(undefined, {
      onSuccess: () => {
        onReadyToRetry?.();
      },
    });
  };

  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/25 px-4 py-4 text-sm">
      <div className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
        {t.wizard.draftQuotaTitle}
      </div>
      <p className="text-amber-900/90 dark:text-amber-100/90 leading-snug mb-4">
        {t.wizard.draftQuotaBody.replace("{used}", String(used)).replace("{max}", String(max))}
      </p>

      {draftNotes.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {draftNotes.slice(0, max).map((note) => (
            <li
              key={note.noteId}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/70 dark:bg-background/40 px-3 py-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{note.clientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSessionDate(note.sessionDate)} · {note.sessionHours}h · {t.notes.statusDraft}
                  </div>
                </div>
              </div>
              <Link
                href={`/notes/${note.noteId}`}
                className="inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
              >
                {t.wizard.draftQuotaReviewDraft}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mb-4">
          {t.wizard.draftQuotaNoDraftsListed}
        </p>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={discardMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {discardMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {t.wizard.draftQuotaDiscard}
        </button>
        <Link
          href="/notes"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-secondary/50 transition-colors"
        >
          {t.wizard.draftQuotaViewNotes}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-snug">{t.wizard.draftQuotaHint}</p>
    </div>
  );
}
