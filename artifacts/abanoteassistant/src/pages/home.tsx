import { Link } from "wouter";
import { FileText, Wand2, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Wand2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground font-display">ABA Note Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold text-sm">
              DR
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground font-display mb-4">
                Clinical notes, <br className="hidden sm:block" />
                <span className="text-primary">generated in seconds.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Save hours of documentation time. Our AI assistant guides you through a quick checklist and writes professional, compliant session notes instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/wizard" 
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 transition-all duration-200"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Create Note with AI
              </Link>
              <button className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl bg-card border-2 border-border text-foreground hover:bg-secondary/50 transition-all duration-200">
                View Past Notes
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-8 border-t border-border/50">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Save Time</h4>
                  <p className="text-sm text-muted-foreground mt-1">Average time saved: 15 mins per note.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Compliant</h4>
                  <p className="text-sm text-muted-foreground mt-1">Structures ABC data professionally.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-3xl blur-3xl -z-10 transform rotate-6"></div>
            <img 
              src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
              alt="Clinical background" 
              className="rounded-3xl shadow-2xl border border-white/20 object-cover aspect-video w-full"
            />
            
            {/* Floating UI Element */}
            <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl p-5 shadow-xl border border-border/50 max-w-xs animate-in slide-in-from-bottom-4 duration-700 delay-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-sm font-semibold">Note Generated</div>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full mb-2"></div>
              <div className="h-2 w-3/4 bg-secondary rounded-full mb-2"></div>
              <div className="h-2 w-5/6 bg-secondary rounded-full"></div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
