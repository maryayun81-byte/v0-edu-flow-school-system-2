"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Receipt as ReceiptIcon, Send, Download, Clock, CheckCircle, X, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Receipt as ReceiptType } from "./types";
import { generatePDF } from "@/lib/pdf-utils";
import PremiumReceiptTemplate from "@/components/finance/PremiumReceiptTemplate";

const supabase = createClient();

interface Props {
  receipts: ReceiptType[];
  onRefresh: () => void;
}

export default function FinanceReceipts({ receipts, onRefresh }: Props) {
  const [publishing, setPublishing] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReceiptType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function publishReceipt(receipt: ReceiptType) {
    setPublishing(receipt.id);
    await supabase.from("ppt_receipts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", receipt.id);
    setPublishing(null);
    onRefresh();
  }

  async function downloadPDF(r: ReceiptType) {
    setIsGenerating(true);
    // Explicitly set the preview to the target receipt so it's rendered in the hidden template
    setPreview(r);
    // Give it a tiny bit of time to render
    setTimeout(async () => {
      await generatePDF("premium-receipt-capture", `${r.receipt_number}.pdf`);
      setIsGenerating(false);
    }, 100);
  }

  return (
    <div className="space-y-4">
      {receipts.length === 0 ? (
        <div className="bg-card/60 border border-border/50 rounded-2xl p-16 text-center">
          <ReceiptIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">No Receipts Yet</h3>
          <p className="text-sm text-muted-foreground">Generate receipts from the Payment Records tab.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {receipts.map(r => (
            <div key={r.id} className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 space-y-4 hover:border-border transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-emerald-400 font-bold">{r.receipt_number}</p>
                  <p className="font-semibold text-foreground mt-0.5">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground">{r.event_name || "No event"}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${r.status === "published" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                  {r.status === "published" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">KSh {r.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{r.payment_method.toUpperCase()} · {r.payment_date}</p>
                </div>
              </div>
              {r.transaction_ref && (
                <p className="font-mono text-xs bg-muted rounded-lg px-3 py-1.5 text-muted-foreground">{r.transaction_ref}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPreview(r)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button 
                  onClick={() => downloadPDF(r)} 
                  disabled={isGenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {isGenerating ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} 
                  PDF
                </button>
                {r.status !== "published" && (
                  <button onClick={() => publishReceipt(r)} disabled={publishing === r.id} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> Publish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Receipt Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white text-center">
              <p className="text-xs font-bold tracking-widest uppercase opacity-80 mb-1">Peak Performance Tutoring</p>
              <p className="text-2xl font-bold">RECEIPT</p>
              <p className="font-mono text-xs mt-1 opacity-80">{preview.receipt_number}</p>
            </div>
            <div className="p-6 space-y-3">
              {[
                ["Student", preview.student_name], ["Event", preview.event_name || "N/A"],
                ["Amount", `KSh ${preview.amount.toLocaleString()}`],
                ["Method", preview.payment_method.toUpperCase()],
                ["Reference", preview.transaction_ref || "N/A"],
                ["Date", preview.payment_date],
                ["Balance", `KSh ${preview.remaining_balance.toLocaleString()}`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => downloadPDF(preview)} 
                  disabled={isGenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-4 rounded-xl text-sm bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-200"
                >
                  {isGenerating ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Hidden PDF Template for Capture */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        {preview && <PremiumReceiptTemplate receipt={preview} />}
      </div>
    </div>
  );
}
