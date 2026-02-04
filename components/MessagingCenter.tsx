"use client";

import React from "react"

import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChatListSkeleton, MessagesSkeleton } from "@/components/DashboardSkeleton";
import { useMessaging, useConversation, type Conversation, type Message } from "@/hooks/useMessaging";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

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
}

export function MessagingCenter({ userId, userRole, userName, initialChatUserId }: MessagingCenterProps) {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<ContactUser[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const { conversations, loading: loadingConversations, startDirectConversation, refresh } = useMessaging(userId);

  // Handle initial chat request
  useEffect(() => {
    if (initialChatUserId) {
      handleStartChat(initialChatUserId);
    }
  }, [initialChatUserId]);

  // Fetch available contacts based on role
  useEffect(() => {
    async function fetchContacts() {
      setLoadingContacts(true);
      try {
        let query = supabase.from("profiles").select("id, full_name, avatar_url, role, subject");

        if (userRole === "student") {
          // Students can only message their teachers
          query = query.eq("role", "teacher");
        } else if (userRole === "teacher") {
          // Teachers can message their students
          query = query.in("role", ["student", "teacher"]);
        } else {
          // Admins can message anyone
          query = query.in("role", ["student", "teacher"]);
        }

        const { data } = await query.neq("id", userId);
        setAvailableContacts(data || []);
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
    const convId = await startDirectConversation(contactId);
    if (convId) {
      setActiveConversation(convId);
      setShowNewChat(false);
    }
  }

  function getOtherParticipant(conv: Conversation) {
    return conv.participants?.find((p) => p.user_id !== userId)?.user;
  }

  if (activeConversation) {
    return (
      <ChatView
        conversationId={activeConversation}
        userId={userId}
        userName={userName}
        onBack={() => setActiveConversation(null)}
        conversation={conversations.find((c) => c.id === activeConversation)}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Messages</h2>
          {conversations.some((c) => (c.unread_count || 0) > 0) && (
            <Badge className="bg-primary text-primary-foreground">
              {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewChat(true)}
          className="bg-primary hover:bg-primary/90"
        >
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted border-border/50"
          />
        </div>
      </div>

      {/* New Chat Contacts (Horizontal Scroll) */}
      {newChatContacts.length > 0 && !showNewChat && (
        <div className="p-3 border-b border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Start a new conversation</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {newChatContacts.slice(0, 10).map((contact) => (
              <button
                key={contact.id}
                onClick={() => handleStartChat(contact.id)}
                className="flex flex-col items-center gap-1.5 min-w-[72px] p-2 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  <AvatarImage src={contact.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {contact.full_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground font-medium truncate max-w-[64px]">
                  {contact.full_name?.split(" ")[0]}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {contact.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="p-4">
            <ChatListSkeleton />
          </div>
        ) : showNewChat ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Select Contact</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNewChat(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {loadingContacts ? (
              <ChatListSkeleton />
            ) : (
              <div className="space-y-2">
                {availableContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleStartChat(contact.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={contact.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {contact.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{contact.full_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {contact.role} {contact.subject && `- ${contact.subject}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start chatting with your contacts above</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors ${
                    (conv.unread_count || 0) > 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={other?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {other?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {(conv.unread_count || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`font-medium truncate ${(conv.unread_count || 0) > 0 ? "text-foreground" : "text-foreground/80"}`}>
                        {other?.full_name || "Unknown"}
                      </p>
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className={`text-sm truncate ${(conv.unread_count || 0) > 0 ? "text-foreground/90 font-medium" : "text-muted-foreground"}`}>
                        {conv.last_message.sender_id === userId ? "You: " : ""}
                        {conv.last_message.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Chat View Component
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle typing indicator
  function handleInputChange(value: string) {
    setNewMessage(value);
    if (value.trim()) {
      setTyping(true);
    }
  }

  async function handleSend() {
    if (!newMessage.trim()) return;
    await sendMessage(newMessage);
    setNewMessage("");
    setTyping(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
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
    <div className="h-[calc(100vh-200px)] flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={otherParticipant?.avatar_url || "/placeholder.svg"} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {otherParticipant?.full_name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">
            {otherParticipant?.full_name || "Unknown"}
          </p>
          {typingUsers.length > 0 ? (
            <p className="text-xs text-primary animate-pulse">typing...</p>
          ) : (
            <p className="text-xs text-muted-foreground capitalize">
              {otherParticipant?.role}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDateHeader(group.date)}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg, idx) => {
                    const isMine = msg.sender_id === userId;
                    const showAvatar = !isMine && (idx === 0 || group.messages[idx - 1]?.sender_id !== msg.sender_id);

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        {!isMine && (
                          <div className="w-8 shrink-0">
                            {showAvatar && (
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={msg.sender?.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {msg.sender?.full_name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                        <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl ${
                              isMine
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted text-foreground rounded-tl-sm"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            {isMine && (
                              <CheckCheck className="w-3 h-3 text-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{typingUsers[0].full_name} is typing...</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/50 bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
            <Paperclip className="w-5 h-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-11 bg-muted border-border/50 rounded-full px-4"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="shrink-0 w-11 h-11 rounded-full bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d");
}

function formatDateHeader(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMMM d, yyyy");
}

export default MessagingCenter;
