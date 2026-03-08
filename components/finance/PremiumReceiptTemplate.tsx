"use client";

import React from "react";
import { Receipt as ReceiptIcon, ShieldCheck, Globe, Phone, Mail } from "lucide-react";

interface Receipt {
  receipt_number: string;
  student_name: string;
  event_name: string | null;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  remaining_balance: number;
  status: string;
}

export default function PremiumReceiptTemplate({ receipt }: { receipt: Receipt }) {
  if (!receipt) return null;

  return (
    <div 
      id="premium-receipt-capture"
      className="w-full max-w-[800px] bg-white p-6 md:p-12 text-slate-800 font-sans relative overflow-hidden mx-auto"
      style={{ minHeight: "800px" }}
    >
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 opacity-[0.03] rounded-full -mr-32 -mt-32 border-[40px] border-emerald-500" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-50 opacity-[0.03] rounded-full -ml-24 -mb-24 border-[30px] border-emerald-500" />
      
      {/* Header */}
      <div className="flex justify-between items-start mb-16 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200">
              <ReceiptIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">PEAK PERFORMANCE</h1>
              <p className="text-emerald-600 font-bold tracking-[0.3em] text-[10px] -mt-1">TUTORING CENTRE</p>
            </div>
          </div>
          <div className="space-y-1 text-slate-500 text-sm font-medium">
            <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> <span>www.peakperformance.edu</span></div>
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> <span>+254 700 000 000</span></div>
            <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> <span>finance@peakperformance.edu</span></div>
          </div>
        </div>
        
        <div className="text-right">
          <h2 className="text-5xl font-black text-slate-200 mb-2">RECEIPT</h2>
          <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block shadow-lg">
            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-0.5">Receipt Number</p>
            <p className="font-mono text-lg font-bold">{receipt.receipt_number}</p>
          </div>
          <p className="text-sm text-slate-400 mt-3 font-medium">Issued on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <hr className="border-slate-100 mb-12" />

      {/* Info Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 mb-12 md:mb-16 relative z-10">
        <div>
          <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">BILL TO STUDENT</h3>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <p className="text-xl font-bold text-slate-900 mb-1">{receipt.student_name}</p>
            <p className="text-slate-500 font-medium">Peak Performance Student</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">PAYMENT DETAILS</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Payment Date</span>
              <span className="text-slate-900 font-bold">{new Date(receipt.payment_date).toLocaleDateString('en-GB')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Payment Method</span>
              <span className="text-slate-900 font-bold">{receipt.payment_method.toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Reference Code</span>
              <span className="text-slate-900 font-mono font-bold">{receipt.transaction_ref || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="mb-16 relative z-10">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="text-left py-4 px-6 rounded-l-xl text-[10px] font-black tracking-widest uppercase">Description</th>
              <th className="text-right py-4 px-6 rounded-r-xl text-[10px] font-black tracking-widest uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-8 px-6">
                <p className="text-lg font-bold text-slate-900">{receipt.event_name || "General Tuition Fee"}</p>
                <p className="text-sm text-slate-500 mt-1">Official education service payment for the specified term/event.</p>
              </td>
              <td className="py-8 px-6 text-right">
                <p className="text-2xl font-black text-slate-900">KSh {receipt.amount.toLocaleString()}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-24 relative z-10">
        <div className="w-80 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Subtotal</span>
            <span className="text-slate-900 font-bold">KSh {receipt.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tax (VAT 0%)</span>
            <span className="text-slate-900 font-bold">KSh 0</span>
          </div>
          <div className="flex justify-between items-center bg-emerald-600 text-white p-6 rounded-2xl shadow-xl shadow-emerald-100">
            <span className="font-black text-xs uppercase tracking-widest opacity-80">Total Paid</span>
            <span className="text-3xl font-black">KSh {receipt.amount.toLocaleString()}</span>
          </div>
          {receipt.remaining_balance > 0 && (
            <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Outstanding Balance</span>
              <span className="text-red-500 font-black">KSh {receipt.remaining_balance.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Footer Stamp */}
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-8 relative z-10">
        <div className="space-y-6 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 italic">"Excellence in every lesson"</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Official Certification</p>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-[400px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</p>
            <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
              This is a computer-generated receipt and does not require a physical signature. 
              Payments are subject to the tutoring centre's refund policy. Please keep this 
              record for your personal accounting and tax purposes.
            </p>
          </div>
        </div>

        <div className="text-center">
          <div className="w-32 h-32 border-4 border-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto rotate-12 opacity-50">
             <div className="text-[10px] font-black text-slate-300 uppercase leading-tight">PAID IN FULL<br/>VERIFIED</div>
          </div>
          <div className="w-48 h-0.5 bg-slate-200 mb-2"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorised Signatory</p>
        </div>
      </div>

      {/* Page Border Decor */}
      <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600" />
      <div className="absolute top-0 right-0 w-2 h-full bg-slate-100" />
    </div>
  );
}
