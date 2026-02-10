"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  MessageSquare,
  Send,
  Search,
  ArrowLeft,
  MoreVertical,
  Check,
  CheckCheck,
  ImageIcon,
  Paperclip,
  X,
  User,
  Users,
  Smile,
  Phone,
  Video,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChatListSkeleton, MessagesSkeleton } from "@/components/DashboardSkeleton";
import { useMessaging, useConversation, type Conversation, type Message } from "@/hooks/useMessaging";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MessagingCenterProps {
  userId: string;
  userRole: "student" | "teacher" | "admin";
  userName: string;
  initialChatUserId?: string | null;
}

interface ContactUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  subject?: string;
  class?: string;
  shared_subjects?: string[];
  is_online?: boolean; // Mock status
}

export function MessagingCenter({ userId, userRole, userName, initialChatUserId }: MessagingCenterProps) {
  // Navigation State for Mobile Responsiveness
  // null = list view, string = chat view
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<ContactUser[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Responsive: track window width or simply use CSS classes. 
  // We'll use CSS classes (hidden md:block etc) to manage dual view.

  const { conversations, loading: loadingConversations, startDirectConversation, refresh } = useMessaging(userId);

  // Handle initial chat request
  useEffect(() => {
    if (initialChatUserId) {
      handleStartChat(initialChatUserId);
    }
  }, [initialChatUserId]);

  // Fetch available contacts based on role using database functions
  useEffect(() => {
    async function fetchContacts() {
      setLoadingContacts(true);
      try {
        let contacts: ContactUser[] = [];

        console.log('Fetching contacts for role:', userRole);
        
        if (userRole === "student") {
          // Get teachers student can message
          console.log('Calling get_student_messageable_teachers...');
          const { data: teachers, error: teachersError } = await supabase
            .rpc('get_student_messageable_teachers', { _student_id: userId });
          
          if (teachersError) console.error('Error fetching teachers:', teachersError);
          else console.log('Teachers found:', teachers?.length);

          // Get classmates student can message
          console.log('Calling get_student_messageable_classmates...');
          const { data: classmates, error: classmatesError } = await supabase
            .rpc('get_student_messageable_classmates', { _student_id: userId });
          
          if (classmatesError) console.error('Error fetching classmates:', classmatesError);
          else console.log('Classmates found:', classmates?.length);

          contacts = [
            ...(teachers || []).map((t: any) => ({
              id: t.teacher_id,
              full_name: t.teacher_name,
              role: 'teacher',
              subject: t.teacher_subject,
              avatar_url: t.teacher_avatar,
              class: 'Your Teacher'
            })),
            ...(classmates || []).map((c: any) => ({
              id: c.classmate_id,
              full_name: c.classmate_name,
              role: 'student',
              avatar_url: c.classmate_avatar,
              shared_subjects: c.shared_subjects
            }))
          ];
        } else if (userRole === "teacher") {
          // Get students teacher can message
          console.log('Calling get_teacher_messageable_students...');
          const { data: students, error } = await supabase
            .rpc('get_teacher_messageable_students', { _teacher_id: userId });
          
          if (error) console.error('Error fetching students:', error);
          else console.log('Students found:', students?.length);

          contacts = (students || []).map((s: any) => ({
            id: s.student_id,
            full_name: s.student_name,
            role: 'student',
            avatar_url: s.student_avatar,
            class: s.student_class,
            shared_subjects: s.shared_subjects
          }));
        } else {
          // Admin can message anyone
          const { data: allUsers } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, role, subject, form_class")
            .in("role", ["student", "teacher"])
            .neq("id", userId);

          contacts = (allUsers || []).map((u: any) => ({
            id: u.id,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            role: u.role,
            subject: u.subject,
            class: u.form_class
          }));
        }

        setAvailableContacts(contacts);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      } finally {
        setLoadingContacts(false);
      }
    }

    fetchContacts();
  }, [userId, userRole]);

  // Get contacts not in existing conversations
  const newChatContacts = useMemo(() => {
    const existingUserIds = new Set<string>();
    conversations.forEach((conv) => {
      conv.participants?.forEach((p) => {
        if (p.user_id !== userId) {
          existingUserIds.add(p.user_id);
        }
      });
    });

    return availableContacts.filter((c) => !existingUserIds.has(c.id));
  }, [availableContacts, conversations, userId]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const otherParticipant = conv.participants?.find((p) => p.user_id !== userId);
    return otherParticipant?.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  async function handleStartChat(contactId: string) {
    try {
      const convId = await startDirectConversation(contactId);
      if (convId) {
        setActiveConversation(convId);
        setShowNewChat(false);
      } else {
        alert('Failed to start conversation.');
      }
    } catch (err: any) {
      console.error('Error starting chat:', err);
      // alert(err.message || 'Failed to start conversation.');
    }
  }

  function getOtherParticipant(conv: Conversation) {
    return conv.participants?.find((p) => p.user_id !== userId)?.user;
  }

  const selectedConversationData = conversations.find((c) => c.id === activeConversation);

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[800px] w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* LEFT SIDEBAR - List View */}
      {/* Hidden on mobile if conversation is active */}
      <div className={cn(
        "w-full md:w-[320px] lg:w-[360px] flex flex-col border-r border-white/10 bg-black/20 transition-all duration-300 absolute md:relative inset-0 z-10 md:z-0 overflow-hidden md:shrink-0",
        activeConversation ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      )}>
        
        {/* Sidebar Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
             </div>
             <div>
               <h2 className="font-bold text-white text-lg leading-tight">Messages</h2>
               <p className="text-xs text-gray-400 font-medium">
                 {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)} unread
               </p>
             </div>
          </div>
          <Button
            size="icon"
            onClick={() => setShowNewChat(true)}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/5 shadow-inner"
          >
            <Users className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2 shrink-0">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-400 transition-colors" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white/5 border-white/5 rounded-2xl focus:bg-white/10 focus:border-indigo-500/50 transition-all text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Categories / New Chat Row */}
        {newChatContacts.length > 0 && !showNewChat && (
          <div className="py-2 pl-4 shrink-0">
             <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-2 pr-4">
                  {newChatContacts.slice(0, 8).map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleStartChat(contact.id)}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 transition-all">
                         <Avatar className="w-full h-full border-2 border-black">
                            <AvatarImage src={contact.avatar_url || "/placeholder.svg"} className="object-cover" />
                            <AvatarFallback className="bg-zinc-800 text-white text-xs">{contact.full_name[0]}</AvatarFallback>
                         </Avatar>
                         {/* Online Badges - mocked */}
                         <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full" />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium truncate w-14 text-center group-hover:text-white transition-colors">
                        {contact.full_name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
             </ScrollArea>
          </div>
        )}

        {/* List Content */}
        <ScrollArea className="flex-1 px-3 py-2 min-h-0">
             {loadingConversations ? (
                 <ChatListSkeleton />
             ) : showNewChat ? (
               <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Select Contact</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewChat(false)} className="h-6 w-6 p-0 rounded-full hover:bg-white/10">
                       <X className="w-3 h-3" />
                    </Button>
                  </div>
                  {availableContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleStartChat(contact.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group"
                    >
                      <Avatar className="w-10 h-10 border border-white/10">
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-indigo-900/50 text-indigo-200">{contact.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{contact.full_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{contact.role}</p>
                      </div>
                    </button>
                  ))}
               </div>
             ) : filteredConversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-medium">No messages yet</p>
                  <Button variant="link" onClick={() => setShowNewChat(true)} className="text-indigo-400">Start new chat</Button>
               </div>
             ) : (
                <div className="space-y-1">
                  {filteredConversations.map(conv => {
                     const other = getOtherParticipant(conv);
                     const isActive = activeConversation === conv.id;
                     return (
                       <button
                         key={conv.id}
                         onClick={() => setActiveConversation(conv.id)}
                         className={cn(
                           "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 relative group overflow-hidden",
                           isActive ? "bg-white/10 shadow-lg" : "hover:bg-white/5"
                         )}
                       >
                         {/* Active indicator bar */}
                         {isActive && <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full" />}
                         
                         <Avatar className="w-12 h-12 border-2 border-white/5 shadow-sm">
                           <AvatarImage src={other?.avatar_url} />
                           <AvatarFallback className="bg-zinc-800 text-gray-300 font-bold">{other?.full_name[0]}</AvatarFallback>
                         </Avatar>
                         
                         <div className="flex-1 min-w-0 text-left pl-1">
                            <div className="flex items-center justify-between mb-0.5">
                               <span className={cn(
                                 "font-bold text-sm truncate", 
                                 isActive ? "text-white" : "text-gray-300 group-hover:text-white"
                               )}>
                                 {other?.full_name}
                               </span>
                               {conv.last_message && (
                                 <span className="text-[10px] text-gray-500 font-medium">
                                   {formatMessageTime(conv.last_message.created_at)}
                                 </span>
                               )}
                            </div>
                            <div className="flex items-center justify-between">
                               <p className={cn(
                                 "text-xs truncate max-w-[160px]",
                                 (conv.unread_count || 0) > 0 ? "text-white font-semibold" : "text-gray-500 group-hover:text-gray-400"
                               )}>
                                  {conv.last_message?.sender_id === userId && "You: "}
                                  {conv.last_message?.content || "Started a conversation"}
                               </p>
                               {(conv.unread_count || 0) > 0 && (
                                 <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-0 h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                                   {conv.unread_count}
                                 </Badge>
                               )}
                            </div>
                         </div>
                       </button>
                     );
                  })}
                </div>
             )}
        </ScrollArea>

        {/* Settings / Footer can go here */}
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div className={cn(
        "absolute md:relative inset-0 w-full md:w-auto md:flex-1 bg-gradient-to-br from-gray-900 to-black flex flex-col transition-transform duration-300 z-20 md:z-0 overflow-hidden",
        activeConversation ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
         
         {activeConversation ? (
             <ChatView 
                conversationId={activeConversation}
                userId={userId}
                userName={userName}
                conversation={selectedConversationData}
                onBack={() => setActiveConversation(null)}
             />
         ) : (
            // Empty State (Desktop only usually)
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-grid-white/[0.02]">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6 animate-pulse">
                   <MessageSquare className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Select a Conversation</h3>
                <p className="text-gray-400 max-w-xs">
                  Choose a contact from the left to start chatting or connect with someone new.
                </p>
            </div>
         )}

      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
// CHAT VIEW SUB-COMPONENT
// ----------------------------------------------------------------------

interface ChatViewProps {
  conversationId: string;
  userId: string;
  userName: string;
  onBack: () => void;
  conversation?: Conversation;
}

function ChatView({ conversationId, userId, userName, onBack, conversation }: ChatViewProps) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, loading, typingUsers, participants, sendMessage, setTyping } = useConversation(conversationId, userId);
  const otherParticipant = participants.find((p) => p.user_id !== userId)?.user;

  // Scroll to bottom
  useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (value.trim()) setTyping(true);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await sendMessage(newMessage);
    setNewMessage("");
    setTyping(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
     setNewMessage(prev => prev + emoji);
  };

  // Group messages logic
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    messages.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
         groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col h-full relative">
       {/* Wallpaper Effect */}
       <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-repeat" />

       {/* Chat Header */}
       <div className="p-4 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
                <ArrowLeft className="w-5 h-5" />
             </Button>
             <div className="relative">
                <Avatar className="w-10 h-10 border border-white/10">
                   <AvatarImage src={otherParticipant?.avatar_url} />
                   <AvatarFallback>{otherParticipant?.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
             </div>
             <div>
                <h3 className="font-bold text-white text-sm md:text-base">{otherParticipant?.full_name}</h3>
                <p className="text-xs text-indigo-400 font-medium">
                   {typingUsers.length > 0 ? "typing..." : "Online"}
                </p>
             </div>
          </div>
          <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
                <Phone className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
                <Video className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
                <Info className="w-5 h-5" />
             </Button>
          </div>
       </div>

       {/* Messages Area */}
       <ScrollArea className="flex-1 p-4 md:p-6 z-0">
          {loading ? (
             <MessagesSkeleton />
          ) : (
             <div className="space-y-6">
                {groupedMessages.map((group) => (
                   <div key={group.date}>
                      <div className="flex justify-center mb-6">
                         <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                            {formatDateHeader(group.date)}
                         </span>
                      </div>
                      <div className="space-y-2">
                         {group.messages.map((msg, idx) => {
                            const isMine = msg.sender_id === userId;
                            const isFirst = idx === 0 || group.messages[idx - 1]?.sender_id !== msg.sender_id;
                            const isLast = idx === group.messages.length - 1 || group.messages[idx + 1]?.sender_id !== msg.sender_id;
                            
                            return (
                               <div key={msg.id} className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
                                  <div className={cn("flex max-w-[80%] md:max-w-[70%] items-end gap-2", isMine ? "flex-row-reverse" : "flex-row")}>
                                     {/* Avatar for other user */}
                                     {!isMine && (
                                        <div className="w-8 shrink-0">
                                           {isLast && (
                                              <Avatar className="w-6 h-6 border border-white/10">
                                                 <AvatarImage src={msg.sender?.avatar_url} />
                                                 <AvatarFallback className="text-[10px] bg-zinc-800 text-gray-400">{msg.sender?.full_name[0]}</AvatarFallback>
                                              </Avatar>
                                           )}
                                        </div>
                                     )}

                                     {/* Message Bubble */}
                                     <div className={cn(
                                        "px-4 py-2.5 shadow-sm transition-all relative group",
                                        isMine 
                                          ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-sm" 
                                          : "bg-zinc-800/80 backend-blur-md text-gray-100 border border-white/5 rounded-2xl rounded-tl-sm"
                                     )}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                        <div className={cn("flex items-center gap-1 mt-1 opacity-60 text-[10px]", isMine ? "justify-end text-indigo-200" : "text-gray-400")}>
                                            <span>{format(new Date(msg.created_at), "h:mm a")}</span>
                                            {isMine && <CheckCheck className="w-3 h-3" />}
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            )
                         })}
                      </div>
                   </div>
                ))}
                
                {/* Typing Bubble */}
                {typingUsers.length > 0 && (
                   <div className="flex w-full justify-start mt-2">
                      <div className="flex max-w-[80%] items-end gap-2">
                          <Avatar className="w-6 h-6 border border-white/10">
                              <AvatarImage src={otherParticipant?.avatar_url} />
                              <AvatarFallback className="text-[10px] bg-zinc-800 text-gray-400">{otherParticipant?.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="bg-zinc-800/80 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center border border-white/5">
                             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150" />
                             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-300" />
                          </div>
                      </div>
                   </div>
                )}
                
                <div ref={messagesEndRef} className="h-4" />
             </div>
          )}
       </ScrollArea>

       {/* Chat Input Area */}
       <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/5 z-10">
          <div className="flex items-end gap-2 bg-zinc-900/50 p-2 rounded-3xl border border-white/10 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
             <Button variant="ghost" size="icon" className="rounded-full text-gray-400 hover:text-white hover:bg-white/10 h-10 w-10 shrink-0">
                <Paperclip className="w-5 h-5 transform rotate-45" />
             </Button>

             <Input 
                ref={inputRef}
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..." 
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500 h-10 py-2.5 min-h-[40px] max-h-[120px]"
             />

             {/* Emoji Popover */}
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="ghost" size="icon" className="rounded-full text-gray-400 hover:text-yellow-400 hover:bg-white/10 h-10 w-10 shrink-0 transition-colors">
                    <Smile className="w-5 h-5" />
                 </Button>
               </PopoverTrigger>
               <PopoverContent side="top" align="end" className="p-0 border-0 bg-transparent shadow-none w-auto">
                 <EmojiPicker onSelect={addEmoji} />
               </PopoverContent>
             </Popover>

             {newMessage.trim() ? (
                <Button 
                  onClick={handleSend} 
                  size="icon" 
                  className="rounded-full h-10 w-10 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 shrink-0 transition-all animate-in zoom-in duration-200"
                >
                   <Send className="w-4 h-4 ml-0.5" />
                </Button>
             ) : (
                <Button variant="ghost" size="icon" className="rounded-full text-gray-400 hover:text-white hover:bg-white/10 h-10 w-10 shrink-0">
                   <ImageIcon className="w-5 h-5" />
                </Button>
             )}
          </div>
       </div>

    </div>
  );
}

// Helpers
function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

function formatDateHeader(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export default MessagingCenter;
