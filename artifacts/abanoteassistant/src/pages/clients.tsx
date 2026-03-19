import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Search,
  UserPlus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { useClientsStore, type Client } from "@/store/clients-store";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function calcAge(dob: string): string {
  const [month, day, year] = dob.split("/").map(Number);
  if (!month || !day || !year) return "—";
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
}

const STATUS_CONFIG = {
  ready: { label: "Assessment Ready", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  uploaded: { label: "Assessment Uploaded", icon: FileText, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  processing: { label: "Processing", icon: Loader2, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  missing: { label: "No Assessment", icon: AlertCircle, bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
};

function ClientCard({ client }: { client: Client }) {
  const status = STATUS_CONFIG[client.assessmentStatus];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 border border-[#F0E4E1] hover:shadow-[0_8px_32px_rgba(194,122,138,0.1)] hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shrink-0 group-hover:scale-105 transition-transform"
            style={{ background: "linear-gradient(135deg, #C27A8A 0%, #e8c4cc 100%)" }}
          >
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div>
            <h3 className="font-bold text-[#2D2523] text-lg leading-tight">
              {client.firstName} {client.lastName}
            </h3>
            <p className="text-[#877870] text-sm mt-0.5">
              {calcAge(client.dateOfBirth)} · {client.gender}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#F0E4E1] group-hover:text-[#C27A8A] group-hover:translate-x-0.5 transition-all" />
      </div>

      {/* Assessment badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border mb-4 ${status.bg} ${status.text} ${status.border}`}
      >
        <StatusIcon className={`w-3.5 h-3.5 ${client.assessmentStatus === "processing" ? "animate-spin" : ""}`} />
        {status.label}
      </span>

      {/* Chips summary */}
      <div className="space-y-2 text-sm">
        {client.maladaptiveBehaviors.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[#877870] whitespace-nowrap pt-0.5">Behaviors:</span>
            <div className="flex flex-wrap gap-1">
              {client.maladaptiveBehaviors.slice(0, 2).map((b) => (
                <span key={b} className="px-2 py-0.5 rounded-md bg-[#FDFAF7] border border-[#F0E4E1] text-[#2D2523] text-xs">
                  {b}
                </span>
              ))}
              {client.maladaptiveBehaviors.length > 2 && (
                <span className="px-2 py-0.5 rounded-md bg-[#FDFAF7] border border-[#F0E4E1] text-[#877870] text-xs">
                  +{client.maladaptiveBehaviors.length - 2}
                </span>
              )}
            </div>
          </div>
        )}
        {client.replacementPrograms.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[#877870] whitespace-nowrap pt-0.5">Programs:</span>
            <div className="flex flex-wrap gap-1">
              {client.replacementPrograms.slice(0, 2).map((p) => (
                <span key={p} className="px-2 py-0.5 rounded-md bg-[#FDFAF7] border border-[#F0E4E1] text-[#2D2523] text-xs">
                  {p}
                </span>
              ))}
              {client.replacementPrograms.length > 2 && (
                <span className="px-2 py-0.5 rounded-md bg-[#FDFAF7] border border-[#F0E4E1] text-[#877870] text-xs">
                  +{client.replacementPrograms.length - 2}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DOB */}
      <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-[#F0E4E1] text-xs text-[#877870]">
        <Clock className="w-3.5 h-3.5" />
        DOB: {client.dateOfBirth}
      </div>
    </motion.div>
  );
}

export default function Clients() {
  const { clients } = useClientsStore();
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                  style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)" }}
                />
                <Sparkles className="w-4 h-4 text-white relative z-10" />
              </div>
              <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase">ABANOTEASSISTANT</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#877870]">
            <Link href="/"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">Dashboard</span></Link>
            <Link href="/notes"><span className="hover:text-[#2D2523] transition-colors cursor-pointer">Notes</span></Link>
            <Link href="/clients"><span className="text-[#C27A8A] cursor-pointer">Clients</span></Link>
          </div>

          <Link href="/wizard">
            <button className="bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:shadow-[0_12px_28px_rgba(194,122,138,0.35)] hover:-translate-y-0.5 flex items-center gap-2">
              New Note <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#2D2523] tracking-tight">Clients</h1>
            <p className="text-[#877870] mt-1">{clients.length} total clients</p>
          </div>
          <Link href="/clients/new">
            <button className="flex items-center gap-2 bg-[#C27A8A] hover:bg-[#b06a79] text-white px-5 py-3 rounded-xl font-semibold transition-all shadow-[0_8px_20px_rgba(194,122,138,0.25)] hover:-translate-y-0.5">
              <UserPlus className="w-5 h-5" />
              New Client
            </button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#877870]" />
          <input
            type="search"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#F0E4E1] bg-white text-[#2D2523] placeholder:text-[#877870] text-sm focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/30 focus:border-[#C27A8A] transition-all"
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FDFAF7] border border-[#F0E4E1] flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-[#C27A8A]/50" />
            </div>
            <h3 className="text-lg font-bold text-[#2D2523] mb-1">No clients found</h3>
            <p className="text-[#877870] text-sm mb-6">
              {search ? `No results for "${search}"` : "Add your first client to get started"}
            </p>
            {!search && (
              <Link href="/clients/new">
                <button className="flex items-center gap-2 bg-[#C27A8A] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-[#b06a79]">
                  <UserPlus className="w-4 h-4" />
                  Add First Client
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-16">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
