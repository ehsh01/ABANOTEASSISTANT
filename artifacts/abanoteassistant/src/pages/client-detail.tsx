import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  CalendarDays,
  Tag,
  AlertTriangle,
  Zap,
  Shield,
  FileText,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
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

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const id = clientId ? Number(clientId) : undefined;
  const { data: clientResp, isLoading: clientLoading } = useClient(id);
  const { data: programsResp, isLoading: programsLoading } = useClientPrograms(id);

  const client = clientResp?.data;
  const programs = programsResp?.data ?? [];
  const isLoading = clientLoading || programsLoading;

  const p = client?.profile;
  const firstName = p?.firstName ?? client?.name?.split(" ")[0] ?? "";
  const lastName = p?.lastName ?? client?.name?.split(" ").slice(1).join(" ") ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  const behaviors = p?.maladaptiveBehaviors ?? [];
  const replacements = p?.replacementPrograms ?? [];

  return (
    <div className="min-h-screen bg-[#FDE8EE] px-4 py-6 md:px-8 md:py-8">
      {/* Back link */}
      <Link href="/clients">
        <button className="flex items-center gap-1.5 text-sm text-[#877870] hover:text-[#C27A8A] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>
      </Link>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[#C27A8A]" />
        </div>
      )}

      {!isLoading && !client && (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#877870]">
          <User className="w-8 h-8" />
          <p className="text-sm">Client not found.</p>
        </div>
      )}

      {!isLoading && client && (
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
              {client.ageBand && (
                <p className="text-sm text-[#877870] mt-0.5">{client.ageBand}</p>
              )}
              <div className="mt-2">
                {client.assessmentStatus === "ready" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assessment complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Assessment pending
                  </span>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <Link href={`/wizard?clientId=${client.id}`}>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C27A8A] text-white text-xs font-semibold hover:bg-[#b06a79] transition-all">
                  <FileText className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </Link>
              <Link href={`/clients/edit/${client.id}`}>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FDFAF7] border border-[#F0E4E1] text-xs font-semibold text-[#877870] hover:border-[#C27A8A] hover:text-[#C27A8A] transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </Link>
            </div>
          </div>

          {/* Basic info */}
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

          {/* Maladaptive Behaviors */}
          {behaviors.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Maladaptive Behaviors
              </h2>
              <div className="flex flex-wrap gap-2">
                {behaviors.map((b) => (
                  <Chip key={b} label={b} color="rose" />
                ))}
              </div>
            </div>
          )}

          {/* Replacement Programs */}
          {replacements.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Replacement Programs
              </h2>
              <div className="flex flex-wrap gap-2">
                {replacements.map((r) => (
                  <Chip key={r} label={r} color="teal" />
                ))}
              </div>
            </div>
          )}

          {/* Programs from API */}
          {programs.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8D8D3] shadow-[0_4px_20px_-4px_rgba(44,37,35,0.12),0_1px_3px_rgba(44,37,35,0.06)] p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#877870] mb-4 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Programs
              </h2>
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
                      <span className={`text-xs font-medium mt-1 inline-block ${prog.type === "primary" ? "text-[#C27A8A]" : "text-amber-600"}`}>
                        {prog.type === "primary" ? "Primary" : "Supplemental"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
