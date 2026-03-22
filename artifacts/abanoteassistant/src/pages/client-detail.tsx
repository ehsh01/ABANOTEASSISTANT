import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
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
import { useClient, useClientPrograms } from "@/hooks/use-aba-api";

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
          Back to Clients
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
                    Assessment ready
                  </span>
                )}
                {client.assessmentStatus === "uploaded" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    <FileText className="w-3.5 h-3.5" />
                    Assessment uploaded
                  </span>
                )}
                {client.assessmentStatus === "processing" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing
                  </span>
                )}
                {client.assessmentStatus === "missing" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No assessment on file
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
                  Add Note
                </button>
              </Link>
              <Link href={`/clients/edit/${client.id}`}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F9EEF1] border border-[#F0D6DC] text-xs font-semibold text-[#C27A8A] hover:bg-[#C27A8A] hover:text-white hover:border-[#C27A8A] transition-all w-full justify-center"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {client.assessmentStatus === "missing" ? "Upload Assessment" : "Update Assessment"}
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
                <Link href={`/clients/edit/${client.id}`}>
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
              <User className="w-3.5 h-3.5" /> Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoRow label="First Name" value={firstName} />
              <InfoRow label="Last Name" value={lastName} />
              <InfoRow label="Date of Birth" value={p?.dateOfBirth || "—"} />
              <InfoRow label="Gender" value={p?.gender || "—"} />
            </div>
          </div>

          <TagListSection
            title="Maladaptive Behaviors"
            icon={AlertTriangle}
            items={behaviors}
            chipColor="rose"
            emptyHint="No maladaptive behaviors documented yet. Add them from Edit → Edit behaviors."
          />

          <TagListSection
            title="Replacement Programs"
            icon={Zap}
            items={replacements}
            chipColor="teal"
            emptyHint="No replacement programs documented yet. Add them from Edit → Edit programs."
          />

          <TagListSection
            title="Interventions"
            icon={Shield}
            items={interventions}
            chipColor="amber"
            emptyHint="No interventions documented yet. Add them from Edit → Edit interventions."
          />

          {/* Structured programs from API (if any) */}
          <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Formal program list
            </h2>
            {programsLoading && (
              <div className="flex items-center gap-2 text-sm text-[#877870]">
                <Loader2 className="w-4 h-4 animate-spin text-[#C27A8A]" />
                Loading programs…
              </div>
            )}
            {programsError && (
              <p className="text-sm text-[#877870] italic">
                Program list could not be loaded. Profile programs above still apply.
              </p>
            )}
            {!programsLoading && !programsError && programs.length === 0 && (
              <p className="text-sm text-[#877870] italic">No formal programs linked to this client.</p>
            )}
            {!programsLoading && !programsError && programs.length > 0 && (
              <div className="space-y-3">
                {programs.map((prog) => (
                  <div key={prog.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {prog.type === "primary" ? (
                        <Shield className="w-4 h-4 text-[#C27A8A]" />
                      ) : (
                        <Tag className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#2D2523]">{prog.name}</p>
                      {prog.description && (
                        <p className="text-xs text-[#877870] mt-0.5">{prog.description}</p>
                      )}
                      <span
                        className={`text-xs font-medium mt-1 inline-block ${
                          prog.type === "primary" ? "text-[#C27A8A]" : "text-amber-600"
                        }`}
                      >
                        {prog.type === "primary" ? "Primary" : "Supplemental"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
