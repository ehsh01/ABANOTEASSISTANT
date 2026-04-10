import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, Fragment } from "react";
import {
  ArrowLeft,
  User,
  AlertTriangle,
  Zap,
  Shield,
  FileText,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Tag,
  Upload,
  Trash2,
  Plus,
} from "lucide-react";
import { useDeleteSessionNote, useUpdateClientProgram, useDeleteClientProgram } from "@/hooks/use-aba-api";
import { sessionTimeRangeFromHours, formatSessionDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClient, useClientPrograms, useNotesList } from "@/hooks/use-aba-api";
import { useT } from "@/hooks/use-translation";
import { ApiError, ProgramType, type Program } from "@workspace/api-client-react";

function formatProgramsFetchError(err: unknown): string {
  if (err instanceof ApiError && err.data && typeof err.data === "object") {
    const d = err.data as { error?: string; messages?: string[] };
    const chunks = [
      d.error,
      ...(Array.isArray(d.messages) ? d.messages.filter((m) => typeof m === "string" && m.trim()) : []),
    ].filter(Boolean) as string[];
    if (chunks.length > 0) return chunks.join(" ");
  }
  return err instanceof Error ? err.message : String(err);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#877870]">{label}</span>
      <span className="text-sm text-[#2D2523] font-medium">{value || "—"}</span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "rose" | "amber" | "teal" }) {
  const styles = {
    rose: "bg-[#F9EEF1] text-[#C27A8A] border-[#F0D6DC]",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[color]}`}>
      {label}
    </span>
  );
}

function TagListSection({
  title,
  icon: Icon,
  items,
  chipColor,
  emptyHint,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  chipColor: "rose" | "amber" | "teal";
  emptyHint: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-[#877870] italic">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Chip key={item} label={item} color={chipColor} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const id = clientId ? Number(clientId) : undefined;
  const { data: clientResp, isLoading: clientLoading } = useClient(id);
  const {
    data: programsResp,
    isLoading: programsLoading,
    isError: programsError,
    error: programsFetchError,
  } = useClientPrograms(id);
  const { data: notesResp, isLoading: notesLoading } = useNotesList();
  const deleteMutation = useDeleteSessionNote();
  const updateProgramMutation = useUpdateClientProgram();
  const deleteProgramMutation = useDeleteClientProgram();
  const t = useT();
  const [activeTab, setActiveTab] = useState("sessionNotes");

  // Program edit state
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>(ProgramType.primary);
  const [editDescription, setEditDescription] = useState("");

  const handleDeleteNote = (noteId: number) => {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    deleteMutation.mutate(noteId);
  };

  const handleStartEdit = (program: Program) => {
    setEditingProgramId(program.id);
    setEditName(program.name);
    setEditType(program.type);
    setEditDescription(program.description ?? "");
  };

  const handleCancelEdit = () => {
    setEditingProgramId(null);
  };

  const handleSaveEdit = () => {
    if (!id || editingProgramId === null) return;
    updateProgramMutation.mutate(
      {
        clientId: id,
        programId: editingProgramId,
        data: {
          name: editName.trim() || undefined,
          type: editType as typeof ProgramType[keyof typeof ProgramType],
          description: editDescription.trim() || null,
        },
      },
      {
        onSuccess: () => setEditingProgramId(null),
      },
    );
  };

  const handleDeleteProgram = (programId: number) => {
    if (!id) return;
    if (!window.confirm("Remove this program? This cannot be undone.")) return;
    deleteProgramMutation.mutate({ clientId: id, programId });
  };

  const client = clientResp?.data;
  const programs = programsResp?.data ?? [];
  const clientNotes = useMemo(() => {
    if (!id || !notesResp?.data) return [];
    return notesResp.data.filter((note) => note.clientId === id);
  }, [id, notesResp?.data]);

  const p = client?.profile;
  const firstName = p?.firstName ?? client?.name?.split(" ")[0] ?? "";
  const lastName = p?.lastName ?? client?.name?.split(" ").slice(1).join(" ") ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  const behaviors = p?.maladaptiveBehaviors ?? [];
  const replacements = p?.replacementPrograms ?? [];
  const interventions = p?.interventions ?? [];

  return (
    <div className="min-h-screen bg-[#FDE8EE] px-4 py-6 md:px-8 md:py-8">
      <Link href="/clients">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-[#877870] hover:text-[#C27A8A] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.clientDetail.backToClients}
        </button>
      </Link>

      {clientLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[#C27A8A]" />
        </div>
      )}

      {!clientLoading && !client && (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#877870]">
          <User className="w-8 h-8" />
          <p className="text-sm">Client not found.</p>
        </div>
      )}

      {!clientLoading && client && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="max-w-4xl mx-auto space-y-5"
        >
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6 flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#F9EEF1] flex items-center justify-center text-[#C27A8A] font-bold text-xl shrink-0">
              {initials || <User className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#2D2523]">{fullName || client.name}</h1>
              {client.ageBand && <p className="text-sm text-[#877870] mt-0.5">{client.ageBand}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {client.assessmentStatus === "ready" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.clientDetail.assessmentReady}
                  </span>
                )}
                {client.assessmentStatus === "uploaded" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    <FileText className="w-3.5 h-3.5" />
                    {t.clientDetail.assessmentUploaded}
                  </span>
                )}
                {client.assessmentStatus === "processing" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t.clientDetail.processing}
                  </span>
                )}
                {client.assessmentStatus === "missing" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t.clientDetail.noAssessment}
                  </span>
                )}
              </div>
              {p?.assessmentFileName ? (
                <p className="text-xs text-[#877870] mt-2 truncate" title={p.assessmentFileName}>
                  PDF: {p.assessmentFileName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link href={`/wizard?clientId=${client.id}`}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C27A8A] text-white text-xs font-semibold hover:bg-[#b06a79] transition-all w-full justify-center"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t.clientDetail.generateNote}
                </button>
              </Link>
              <Link href={`/clients/edit/${client.id}?section=personal`}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FDFAF7] border border-[#F0E4E1] text-xs font-semibold text-[#877870] hover:border-[#C27A8A] hover:text-[#C27A8A] transition-all w-full justify-center"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Info
                </button>
              </Link>
            </div>
          </div>

          {/* Assessment missing callout */}
          {client.assessmentStatus === "missing" && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#2D2523]">Assessment required</h3>
                <p className="text-xs text-[#877870] mt-1 leading-relaxed">
                  Notes can't be generated until an assessment PDF is uploaded for this client. Upload one to unlock note generation.
                </p>
                <Link href={`/clients/edit/${client.id}?step=2`}>
                  <button
                    type="button"
                    className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C27A8A] text-white text-xs font-semibold hover:bg-[#b06a79] transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Assessment
                  </button>
                </Link>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {t.clientDetail.basicInfo}
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoRow label="First Name" value={firstName} />
              <InfoRow label="Last Name" value={lastName} />
              <InfoRow label={t.clientDetail.dateOfBirth} value={p?.dateOfBirth || "—"} />
              <InfoRow label={t.clientDetail.gender} value={p?.gender || "—"} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="sessionNotes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="behaviors" className="text-xs">Maladaptive Behaviors</TabsTrigger>
                <TabsTrigger value="programs" className="text-xs">Replacement Programs</TabsTrigger>
                <TabsTrigger value="interventions" className="text-xs">Interventions</TabsTrigger>
              </TabsList>

              <TabsContent value="sessionNotes">
                {notesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#877870] py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C27A8A]" />
                    Loading notes…
                  </div>
                ) : clientNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#FDFAF7] border border-[#F0E4E1] flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6 text-[#C27A8A]/50" />
                    </div>
                    <p className="text-sm font-semibold text-[#2D2523] mb-1">No session notes yet</p>
                    <p className="text-xs text-[#877870] mb-4">Generate the first note for this client</p>
                    <Link href="/wizard">
                      <button className="flex items-center gap-2 bg-[#C27A8A] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#b06a79] transition-colors">
                        <Plus className="w-4 h-4" /> New Note
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-[#E8D8D3]" style={{ boxShadow: "0 2px 10px -2px rgba(44,37,35,0.08)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FDFAF7] border-b border-[#F0E4E1]">
                          {["SESSION DATE", "TIME", "STATUS", "ACTIONS"].map((col) => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-bold text-[#877870] tracking-widest uppercase">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-[#F0E4E1]">
                        <AnimatePresence>
                          {clientNotes.map((note) => {
                            const { startTime, endTime } = sessionTimeRangeFromHours(note.sessionHours);
                            return (
                              <Fragment key={note.noteId}>
                                <motion.tr
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="hover:bg-[#FDFAF7] transition-colors"
                                >
                                  <td className="px-4 py-3 text-[#2D2523] font-medium">
                                    {formatSessionDate(note.sessionDate)}
                                  </td>
                                  <td className="px-4 py-3 text-[#877870] text-xs">
                                    {startTime} – {endTime}
                                  </td>
                                  <td className="px-4 py-3">
                                    {note.status === "final" ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                        Final
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                                        Draft
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={`/notes/${note.noteId}?edit=1`}
                                        title="Edit note"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-[#C27A8A] hover:bg-[#FCEEF1] transition-colors"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Link>
                                      <button
                                        title="Delete note"
                                        disabled={deleteMutation.isPending}
                                        onClick={() => handleDeleteNote(note.noteId)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#877870] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              </Fragment>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="behaviors" className="space-y-3">
                {behaviors.length === 0 ? (
                  <p className="text-sm text-[#877870] italic">{t.clientDetail.noBehaviors}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {behaviors.map((behavior) => (
                      <span key={behavior} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-[#F9EEF1] text-[#C27A8A] border-[#F0D6DC]">
                        {behavior}
                      </span>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="programs" className="space-y-3">
                {programsError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                    <p className="font-semibold text-rose-800 mb-1">Could not load linked programs</p>
                    <p className="text-rose-800/90">{formatProgramsFetchError(programsFetchError)}</p>
                  </div>
                )}
                {programsLoading && (
                  <p className="text-sm text-[#877870] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading linked programs…
                  </p>
                )}
                {!programsLoading && !programsError && programs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#877870]">
                      Linked for session note wizard
                    </p>
                    <div className="space-y-2">
                      {programs.map((program) =>
                        editingProgramId === program.id ? (
                          <div key={program.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[#877870] uppercase tracking-wide">Name</label>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[#877870] uppercase tracking-wide">Type</label>
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value)}
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value={ProgramType.primary}>Primary</option>
                                <option value={ProgramType.supplemental}>Supplemental</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[#877870] uppercase tracking-wide">Description <span className="font-normal normal-case">(optional)</span></label>
                              <input
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="e.g. Reduce task refusal"
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            {updateProgramMutation.isError && (
                              <p className="text-xs text-red-500">Save failed — please try again.</p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={handleSaveEdit}
                                disabled={!editName.trim() || updateProgramMutation.isPending}
                                className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {updateProgramMutation.isPending ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={updateProgramMutation.isPending}
                                className="flex-1 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-[#877870] hover:bg-secondary/30 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div key={program.id} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground">{program.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">{program.type}</span>
                              </div>
                              {program.description && (
                                <p className="text-xs text-[#877870] mt-0.5 truncate">{program.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEdit(program)}
                                className="p-1.5 rounded-lg text-[#877870] hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Edit program"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProgram(program.id)}
                                disabled={deleteProgramMutation.isPending}
                                className="p-1.5 rounded-lg text-[#877870] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                title="Remove program"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#877870]">On client profile</p>
                  {replacements.length === 0 ? (
                    <p className="text-sm text-[#877870] italic">{t.clientDetail.noPrograms}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {replacements.map((program) => (
                        <span
                          key={program}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-teal-50 text-teal-700 border-teal-200"
                        >
                          {program}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="interventions" className="space-y-3">
                {interventions.length === 0 ? (
                  <p className="text-sm text-[#877870] italic">{t.clientDetail.noPrograms}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {interventions.map((intervention) => (
                      <span key={intervention} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                        {intervention}
                      </span>
                    ))}
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </div>
        </motion.div>
      )}
    </div>
  );
}
