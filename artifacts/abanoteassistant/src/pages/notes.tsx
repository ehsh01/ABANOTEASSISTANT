import { Fragment } from "react";
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
import { useNotesStore, type SessionNote } from "@/store/notes-store";

const BILLING_CODE_LABELS: Record<string, string> = {
  "97153": "Adaptive behavior treatment",
  "97155": "Protocol modification",
  "97156": "Family adaptive behavior",
};

function StatusBadge({ status }: { status: SessionNote["status"] }) {
  return status === "final" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold pop-text">
      Final
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold pop-text">
      Draft
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
  const { notes, deleteNote } = useNotesStore();

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
            <Link href="/"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">Dashboard</span></Link>
            <Link href="/notes"><span className="text-[#C27A8A] cursor-pointer">Notes</span></Link>
            <Link href="/clients"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">Clients</span></Link>
          </div>

          <Link href="/wizard">
            <button className="bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:shadow-[0_12px_28px_rgba(194,122,138,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
              New Note <ChevronRight className="w-4 h-4 pop-icon-white" />
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#2D2523] tracking-tight">Session Notes</h1>
            <p className="text-[#877870] mt-1">{notes.length} total notes</p>
          </div>
          <Link href="/wizard">
            <button className="flex items-center gap-2 bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:-translate-y-0.5">
              <Plus className="w-5 h-5 pop-icon-white" />
              Generate Note
            </button>
          </Link>
        </div>

        {/* ── Table ── */}
        {notes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FDFAF7] border border-[#F0E4E1] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[#C27A8A]/50 pop-icon" />
            </div>
            <h3 className="text-lg font-bold text-[#2D2523] mb-1">No notes yet</h3>
            <p className="text-[#877870] text-sm mb-6 max-w-sm">
              Generate your first session note using the wizard — it only takes a minute.
            </p>
            <Link href="/wizard">
              <button className="flex items-center gap-2 bg-[#C27A8A] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-[#b06a79]">
                <Plus className="w-4 h-4 pop-icon-white" />
                Generate First Note
              </button>
            </Link>
          </motion.div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid #F0E4E1",
              boxShadow: "0 2px 8px rgba(194,122,138,0.06)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FDFAF7] border-b border-[#F0E4E1]">
                    {["CLIENT NAME", "TYPE", "BILLING CODE", "SESSION DATE", "START TIME", "END TIME", "ACTIONS"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-6 py-4 text-left text-xs font-bold text-[#877870] tracking-widest uppercase whitespace-nowrap pop-text"
                        >
                          {col}
                        </th>
                      )
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
                              <Link href="/clients">
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
                            {note.sessionDate}
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
                              <button
                                title="Edit note"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-[#C27A8A] hover:bg-[#FCEEF1] transition-colors"
                              >
                                <Pencil className="w-4 h-4 pop-icon" />
                              </button>
                              <button
                                title="Delete note"
                                onClick={() => deleteNote(note.id)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
