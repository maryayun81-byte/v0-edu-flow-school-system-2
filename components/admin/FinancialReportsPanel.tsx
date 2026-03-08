'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Download, Mail, RefreshCw, CheckCircle, 
  XCircle, Clock, Search, Filter, ExternalLink,
  DollarSign, BarChart3, TrendingUp
} from 'lucide-react';
import { Input } from "@/components/ui/input";

const supabase = createClient();

interface ReportArchive {
  id: string;
  event_id: string;
  event_name: string;
  pdf_url: string;
  csv_url: string;
  created_at: string;
  sent_at: string | null;
  status: 'generated' | 'sent' | 'archived';
  financial_summary: any;
  recipient_email: string;
}

export default function FinancialReportsPanel() {
  const [reports, setReports] = useState<ReportArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_reports_archive')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualGeneration(eventId: string) {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/reports/generate/${eventId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchReports();
      } else {
        alert('Failed to generate report: ' + data.error);
      }
    } catch (err) {
      console.error('Manual trigger error:', err);
    } finally {
      setRefreshing(false);
    }
  }

  const filteredReports = reports.filter(r => 
    r.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Reports Archive</h2>
          <p className="text-muted-foreground">Premium executive reports generated at the end of each tuition event.</p>
        </div>
        <Button 
          onClick={fetchReports} 
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reports Sent</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'sent').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Efficiency</p>
                <p className="text-2xl font-bold">
                  {(reports.reduce((acc, r) => acc + (r.financial_summary?.collection_efficiency || 0), 0) / (reports.length || 1) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <CardTitle>Autonomous Dispatch Log</CardTitle>
              <CardDescription>Track the delivery status and financial highlights of all automated reports.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search event or email..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Tuition Event</TableHead>
                  <TableHead>Revenue Metric</TableHead>
                  <TableHead>Delivery Status</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead className="text-right">Archives</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading archives...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                      No reports found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold">{report.event_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{report.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">
                              {((report.financial_summary?.collection_efficiency || 0) * 100).toFixed(1)}% Eff.
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            KSh {report.financial_summary?.total_collected?.toLocaleString()} Collected
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {report.status === 'sent' ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              Delivered
                            </Badge>
                            <span className="text-[10px] text-muted-foreground italic">To: {report.recipient_email}</span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Generated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{new Date(report.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild className="h-8 gap-2">
                            <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="h-8 gap-2 border-primary/20 hover:bg-primary/5">
                            <a href={report.csv_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="w-3 h-3" />
                              CSV
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
