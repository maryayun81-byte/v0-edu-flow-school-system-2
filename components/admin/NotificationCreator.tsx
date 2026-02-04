"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Bell, 
  Send, 
  Users, 
  User, 
  GraduationCap, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  ShieldAlert,
  Search,
  History,
  Trash2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NotificationCreator({ adminId }: { adminId: string }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [audience, setAudience] = useState("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sentHistory, setSentHistory] = useState<any[]>([]);

  // Fetch sent history on mount
  useEffect(() => {
    fetchHistory();
    // Subscribe to changes
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Search for users when audience is 'individual'
  useEffect(() => {
    if (audience !== 'individual' || !searchQuery) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .ilike('full_name', `%${searchQuery}%`)
        .limit(5);
      
      if (data) setSearchResults(data);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, audience]);

  async function fetchHistory() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setSentHistory(data);
  }

  async function handleSend() {
    if (!title || !message) return;
    if (audience === 'individual' && !targetUserId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title,
          message,
          type,
          audience,
          target_user_id: audience === 'individual' ? targetUserId : null,
          created_by: adminId
        });

      if (error) throw error;

      // Reset form
      setTitle("");
      setMessage("");
      setTargetUserId("");
      setSearchQuery("");
      fetchHistory();
      
    } catch (error) {
      console.error("Error sending notification:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    fetchHistory();
  }

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'urgent': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'success': return "bg-green-500/10 text-green-500 border-green-500/20";
      case 'warning': return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case 'urgent': return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Creation Form */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Send New Notification
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Notification Title</Label>
            <Input 
              placeholder="e.g., School Closure Notice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Message Content</Label>
            <Textarea 
              placeholder="Enter the full message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-muted min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" /> Information
                    </div>
                  </SelectItem>
                  <SelectItem value="success">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Success
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" /> Warning
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" /> Urgent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Everyone
                    </div>
                  </SelectItem>
                  <SelectItem value="student">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Students Only
                    </div>
                  </SelectItem>
                  <SelectItem value="teacher">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Teachers Only
                    </div>
                  </SelectItem>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" /> Specific User
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {audience === 'individual' && (
            <div className="space-y-2 relative">
              <Label>Search User</Label>
              <div className="relative">
                <Input 
                  placeholder="Type name to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted pl-9"
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              
              {searchResults.length > 0 && !targetUserId && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setTargetUserId(user.id);
                        setSearchQuery(user.full_name);
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button 
            onClick={handleSend} 
            disabled={!title || !message || loading || (audience === 'individual' && !targetUserId)}
            className="w-full bg-primary h-11"
          >
            {loading ? "Sending..." : "Push Notification"}
          </Button>
        </div>
      </div>

      {/* History Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          Recent Notifications
        </h3>

        <div className="space-y-3">
          {sentHistory.map(notif => (
            <div key={notif.id} className="bg-card border border-border/50 rounded-xl p-4 flex gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getTypeColor(notif.type)}`}>
                {getTypeIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-foreground truncate">{notif.title}</h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{notif.message}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                    To: {notif.audience}
                  </span>
                  <button 
                    onClick={() => handleDelete(notif.id)}
                    className="ml-auto text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {sentHistory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No notifications sent yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Plus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
