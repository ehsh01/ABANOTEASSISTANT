import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClient, useClientPrograms } from "@/hooks/use-aba-api";
import { useT } from "@/hooks/use-translation";

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
  } = useClientPrograms(id);
  const t = useT();
  const [activeTab, setActiveTab] = useState("sessionNotes");

  const client = clientResp?.data;
  const programs = programsResp?.data ?? [];

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
          className="max-w-2xl mx-auto space-y-5"
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
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="sessionNotes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="behaviors" className="text-xs">Maladaptive Behaviors</TabsTrigger>
                <TabsTrigger value="programsInterventions" className="text-xs">Programs & Interventions</TabsTrigger>
              </TabsList>

              <TabsContent value="sessionNotes" className="space-y-3">
                <p className="text-sm text-[#877870] italic">Session notes for this client will appear here.</p>
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

              <TabsContent value="programsInterventions" className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#2D2523] mb-3">Replacement Programs</h3>
                  {replacements.length === 0 ? (
                    <p className="text-sm text-[#877870] italic">{t.clientDetail.noPrograms}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {replacements.map((program) => (
                        <span key={program} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-teal-50 text-teal-700 border-teal-200">
                          {program}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#2D2523] mb-3">Interventions</h3>
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
                </div>
              </TabsContent>

            </Tabs>
          </div>
        </motion.div>
      )}
    </div>
  );
}
