"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from "recharts";
import { 
  Users, CheckCircle2, AlertCircle, TrendingUp, 
  Calendar, School, UserCheck, UserMinus 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const supabase = createClient();

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"]; // Green, Amber, Red, Blue

interface TeacherAnalyticsProps {
  teacherId: string;
}

export default function TeacherAttendanceAnalytics({ teacherId }: TeacherAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    atRiskCount: 0,
    perfectAttendanceCount: 0
  });

  const [studentPerformance, setStudentPerformance] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, [teacherId]);

  useEffect(() => {
    if (selectedEventId && classInfo) {
      fetchAnalyticsData();
    }
  }, [selectedEventId, classInfo]);

  async function fetchInitialData() {
    setLoading(true);
    // 1. Get teacher's class
    const { data: ctData } = await supabase
      .from("class_teachers")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", teacherId)
      .single();

    if (ctData) {
      setClassInfo((ctData as any).classes);
      
      // 2. Get active/recent events
      const { data: eventData } = await supabase
        .from("tuition_events")
        .select("id, name, status")
        .order("start_date", { ascending: false });
      
      setEvents(eventData || []);
      if (eventData && eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }
    }
    setLoading(false);
  }

  async function fetchAnalyticsData() {
    if (!selectedEventId || !classInfo) return;

    // 1. Fetch eligibility/summary data for the class in this event
    const { data: eligibilityData } = await supabase
      .from("exam_eligibility")
      .select(`
        student_id, 
        attendance_percentage, 
        days_present, 
        days_late, 
        days_absent, 
        days_excused,
        is_eligible,
        profiles!student_id(full_name)
      `)
      .eq("event_id", selectedEventId)
      .eq("class_id", classInfo.id);

    if (eligibilityData) {
      // Process stats
      const total = eligibilityData.length;
      const avg = eligibilityData.reduce((acc: number, curr: any) => acc + Number(curr.attendance_percentage), 0) / (total || 1);
      const atRisk = eligibilityData.filter((s: any) => Number(s.attendance_percentage) < 80).length;
      const perfect = eligibilityData.filter((s: any) => Number(s.attendance_percentage) === 100).length;

      setStats({
        totalStudents: total,
        avgAttendance: Math.round(avg),
        atRiskCount: atRisk,
        perfectAttendanceCount: perfect
      });

      // Process student performance (Bar Chart)
      setStudentPerformance(eligibilityData.map((s: any) => ({
        name: (s.profiles as any).full_name.split(" ")[0],
        percentage: Number(s.attendance_percentage)
      })).sort((a: any, b: any) => b.percentage - a.percentage).slice(0, 10));

      // At Risk List
      setAtRiskStudents(eligibilityData
        .filter((s: any) => Number(s.attendance_percentage) < 80)
        .sort((a: any, b: any) => Number(a.attendance_percentage) - Number(b.attendance_percentage))
      );

      // Status Distribution (Pie Chart)
      const dist = [
        { name: "Present", value: eligibilityData.reduce((acc: number, curr: any) => acc + curr.days_present, 0) },
        { name: "Late", value: eligibilityData.reduce((acc: number, curr: any) => acc + curr.days_late, 0) },
        { name: "Absent", value: eligibilityData.reduce((acc: number, curr: any) => acc + curr.days_absent, 0) },
        { name: "Excused", value: eligibilityData.reduce((acc: number, curr: any) => acc + curr.days_excused, 0) }
      ];
      setDistribution(dist);
    }

    // 2. Fetch daily trend (Line Chart)
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("attendance_date, status")
      .eq("event_id", selectedEventId)
      .eq("class_id", classInfo.id)
      .order("attendance_date");

    if (attendanceData) {
      const trendMap = new Map();
      attendanceData.forEach((r: any) => {
        if (!trendMap.has(r.attendance_date)) {
          trendMap.set(r.attendance_date, { date: r.attendance_date, present: 0, total: 0 });
        }
        const entry = trendMap.get(r.attendance_date);
        entry.total++;
        if (r.status === "present" || r.status === "late") entry.present++;
      });

      setDailyTrend(Array.from(trendMap.values()).map((d: any) => ({
        date: new Date(d.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
        rate: Math.round((d.present / d.total) * 100)
      })));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!classInfo) {
    return (
      <Card className="bg-card/50 border-dashed border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <School className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground">No Class Assigned</h3>
          <p className="text-muted-foreground max-w-sm mt-1">
            You are not currently designated as a class teacher for any class.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Class Attendance Analytics</h2>
          <p className="text-sm text-muted-foreground">Class: <span className="font-semibold text-primary">{classInfo.name}</span></p>
        </div>
        <div className="w-full md:w-64">
           <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="bg-muted border-border/50">
              <SelectValue placeholder="Select event..." />
            </SelectTrigger>
            <SelectContent>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50 overflow-hidden group hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest opacity-60">Total</Badge>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-black text-foreground">{stats.totalStudents}</h4>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Students Enrolled</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 overflow-hidden group hover:border-green-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20 uppercase font-bold tracking-widest">Target 80%</Badge>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-black text-foreground">{stats.avgAttendance}%</h4>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg. Attendance Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 overflow-hidden group hover:border-red-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                <AlertCircle className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20 uppercase font-bold tracking-widest">Alert</Badge>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-black text-foreground">{stats.atRiskCount}</h4>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Students At Risk (&lt;80%)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 overflow-hidden group hover:border-blue-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase font-bold tracking-widest">Elite</Badge>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-black text-foreground">{stats.perfectAttendanceCount}</h4>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Perfect Attendance (100%)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance by Student Bar Chart */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Attendance by Student</CardTitle>
            <CardDescription>Top 10 performing students attendance %</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentPerformance} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fill: "#999", fontSize: 11 }} 
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#333", borderRadius: "8px", color: "#fff" }}
                />
                <Bar 
                  dataKey="percentage" 
                  radius={[0, 4, 4, 0]} 
                  barSize={12}
                >
                  {studentPerformance.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.percentage >= 80 ? "#10b981" : entry.percentage >= 60 ? "#f59e0b" : "#ef4444"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Attendance Trend Line Chart */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Daily Attendance Trend</CardTitle>
            <CardDescription>Class attendance rate % per day</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: "#999", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                   tick={{ fill: "#999", fontSize: 10 }}
                   domain={[0, 100]}
                   axisLine={false}
                   tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#333", borderRadius: "8px", color: "#fff" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Distribution Pie Chart */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Overall Distribution</CardTitle>
            <CardDescription>Presence breakdown across all attendance dates</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#333", borderRadius: "8px", color: "#fff" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* At Risk Students Table */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-red-400">At-Risk Students</CardTitle>
                <CardDescription>Students with attendance below 80%</CardDescription>
              </div>
              <Badge variant="destructive">{atRiskStudents.length} Students</Badge>
            </div>
          </CardHeader>
          <CardContent>
             <div className="space-y-4 max-h-[235px] overflow-y-auto pr-2 custom-scrollbar">
               {atRiskStudents.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-10 opacity-40">
                   <UserCheck className="w-10 h-10 mb-2" />
                   <p className="text-xs">No students at risk. Great job!</p>
                 </div>
               ) : (
                 atRiskStudents.map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-xs font-bold">
                         {(s.profiles as any).full_name.charAt(0)}
                       </div>
                       <div>
                         <p className="text-sm font-bold">{(s.profiles as any).full_name}</p>
                         <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                           {s.days_absent} Absent · {s.days_late} Late
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-sm font-black text-red-400">{s.attendance_percentage}%</p>
                       <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">At Risk</Badge>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </CardContent>
        </Card>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

function Badge({ children, className, variant = "default" }: any) {
  const variants: any = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border",
    destructive: "bg-destructive/20 text-destructive border-destructive/30"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
