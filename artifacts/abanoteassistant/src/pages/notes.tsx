import { Fragment, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Pencil,
  Trash2,
  FileText,
  Plus,
} from "lucide-react";
import type { SessionNote } from "@/store/notes-store";
import { formatSessionDate, sessionTimeRangeFromHours } from "@/lib/utils";
import { useT } from "@/hooks/use-translation";
import { useDeleteSessionNote, useNotesList } from "@/hooks/use-aba-api";
import type { NoteSummary } from "@workspace/api-client-react";

const BILLING_CODE_LABELS: Record<string, string> = {
  "97153": "Adaptive behavior treatment",
  "97155": "Protocol modification",
  "97156": "Family adaptive behavior",
};

const DEFAULT_TYPE = "RBT" as const;
const DEFAULT_BILLING = "97153" as const;

function summaryToSessionNote(s: NoteSummary): SessionNote {
  const { startTime, endTime } = sessionTimeRangeFromHours(s.sessionHours);
  return {
    id: String(s.noteId),
    clientName: s.clientName,
    type: DEFAULT_TYPE,
    billingCode: DEFAULT_BILLING,
    sessionDate: s.sessionDate,
    startTime,
    endTime,
    status: s.status,
    createdAt: s.createdAt,
    content: "",
  };
}

function StatusBadge({ status }: { status: SessionNote["status"] }) {
  const t = useT();
  return status === "final" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold pop-text">
      {t.notes.statusFinal}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold pop-text">
      {t.notes.statusDraft}
    </span>
  );
}

function TypeBadge({ type }: { type: SessionNote["type"] }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FDFAF7] text-[#2D2523] border border-[#F0E4E1] text-xs font-bold tracking-wide pop-text">
      {type}
    </span>
  );
}

export default function Notes() {
  const { data, isLoading, isError, error, refetch } = useNotesList();
  const deleteMutation = useDeleteSessionNote();
  const t = useT();

  const notes = useMemo(() => (data?.data ?? []).map(summaryToSessionNote), [data?.data]);

  const handleDelete = (id: string) => {
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) return;
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    deleteMutation.mutate(noteId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                  style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)" }}
                />
                <Sparkles className="w-4 h-4 text-white relative z-10 pop-icon-white" />
              </div>
              <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase pop-text">ABANOTEASSISTANT</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#877870]">
            <Link href="/"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">{t.nav.dashboard}</span></Link>
            <Link href="/notes"><span className="text-[#C27A8A] cursor-pointer">{t.nav.notes}</span></Link>
            <Link href="/clients"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">{t.nav.clients}</span></Link>
          </div>

          <Link href="/wizard">
            <button className="bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:shadow-[0_12px_28px_rgba(194,122,138,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
              {t.nav.newNote} <ChevronRight className="w-4 h-4 pop-icon-white" />
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#2D2523] tracking-tight">{t.notes.title}</h1>
            <p className="text-[#877870] mt-1">{isLoading ? "…" : `${notes.length} total`}</p>
          </div>
          <Link href="/wizard">
            <button className="flex items-center gap-2 bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:-translate-y-0.5">
              <Plus className="w-5 h-5 pop-icon-white" />
              {t.notes.newNote}
            </button>
          </Link>
        </div>

        {isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 mb-6 text-sm">
            <p className="font-semibold">Could not load notes</p>
            <p className="text-rose-700/90 mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-sm font-semibold underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Table ── */}
        {isLoading ? (
          <div className="flex justify-center py-24 text-[#877870] text-sm font-medium">Loading notes…</div>
        ) : notes.length === 0 && !isError ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FDFAF7] border border-[#F0E4E1] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[#C27A8A]/50 pop-icon" />
            </div>
            <h3 className="text-lg font-bold text-[#2D2523] mb-1">{t.notes.noNotes}</h3>
            <p className="text-[#877870] text-sm mb-6 max-w-sm">
              {t.notes.noNotesHint}
            </p>
            <Link href="/wizard">
              <button className="flex items-center gap-2 bg-[#C27A8A] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-[#b06a79]">
                <Plus className="w-4 h-4 pop-icon-white" />
                {t.notes.generateNote}
              </button>
            </Link>
          </motion.div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid #E8D8D3",
              boxShadow: "0 4px 20px -4px rgba(44,37,35,0.12), 0 1px 3px rgba(44,37,35,0.06)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FDFAF7] border-b border-[#F0E4E1]">
                    {[t.admin.name.toUpperCase(), "TYPE", t.notes.billingCode.toUpperCase(), "SESSION DATE", "START TIME", "END TIME", t.admin.actions.toUpperCase()].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-6 py-4 text-left text-xs font-bold text-[#877870] tracking-widest uppercase whitespace-nowrap pop-text"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#F0E4E1]">
                  <AnimatePresence>
                    {notes.map((note) => (
                      <Fragment key={note.id}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="hover:bg-[#FDFAF7] transition-colors"
                        >
                          {/* CLIENT NAME */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Link href={`/notes/${note.id}`}>
                                <span className="font-semibold text-[#C27A8A] hover:text-[#b06a79] hover:underline transition-colors cursor-pointer">
                                  {note.clientName}
                                </span>
                              </Link>
                              <StatusBadge status={note.status} />
                            </div>
                          </td>

                          {/* TYPE */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <TypeBadge type={note.type} />
                          </td>

                          {/* BILLING CODE */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <span className="font-bold text-[#2D2523]">{note.billingCode}</span>
                              <p className="text-[#877870] text-xs mt-0.5 hidden lg:block">
                                {BILLING_CODE_LABELS[note.billingCode]}
                              </p>
                            </div>
                          </td>

                          {/* SESSION DATE */}
                          <td className="px-6 py-4 whitespace-nowrap text-[#2D2523] font-medium">
                            {formatSessionDate(note.sessionDate)}
                          </td>

                          {/* START TIME */}
                          <td className="px-6 py-4 whitespace-nowrap text-[#2D2523]">
                            {note.startTime}
                          </td>

                          {/* END TIME */}
                          <td className="px-6 py-4 whitespace-nowrap text-[#2D2523]">
                            {note.endTime}
                          </td>

                          {/* ACTIONS */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/notes/${note.id}`}
                                title="Edit note"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-[#C27A8A] hover:bg-[#FCEEF1] transition-colors"
                              >
                                <Pencil className="w-4 h-4 pop-icon" />
                              </Link>
                              <button
                                title="Delete note"
                                disabled={deleteMutation.isPending}
                                onClick={() => handleDelete(note.id)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4 pop-icon" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      </Fragment>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
