"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "image" | "file" | "system";
  file_url?: string;
  file_name?: string;
  is_edited: boolean;
  is_deleted: boolean;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  last_read_at: string;
  joined_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
}

export interface TypingUser {
  user_id: string;
  full_name: string;
}

export function useMessaging(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch conversations with participants
      const { data: participations, error: partError } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          last_read_at,
          conversations!inner (
            id,
            type,
            name,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq("user_id", userId);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get all conversation IDs
      const convIds = participations.map((p: any) => p.conversation_id);

      // Fetch all participants for these conversations
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            role
          )
        `)
        .in("conversation_id", convIds);

      // Fetch last message for each conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });

      // Build conversation objects
      const convs: Conversation[] = participations.map((p: any) => {
        const conv = p.conversations;
        const participants = (allParticipants || [])
          .filter((part: any) => part.conversation_id === conv.id)
          .map((part: any) => ({
            ...part,
            user: part.profiles,
          }));

        const lastMessage = (lastMessages || []).find(
          (m: any) => m.conversation_id === conv.id
        );

        // Count unread messages
        const unreadCount = (lastMessages || []).filter(
          (m: any) =>
            m.conversation_id === conv.id &&
            m.sender_id !== userId &&
            new Date(m.created_at) > new Date(p.last_read_at)
        ).length;

        return {
          ...conv,
          participants,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      });

      // Sort by last message time
      convs.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(convs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const startDirectConversation = useCallback(async (otherUserId: string) => {
    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          conversations!inner (type)
        `)
        .eq("user_id", userId);

      if (existing) {
        for (const p of existing) {
          const { data: otherParticipant } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", p.conversation_id)
            .eq("user_id", otherUserId)
            .single();

          if (otherParticipant && (p as any).conversations.type === "direct") {
            return p.conversation_id;
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({ type: "direct", created_by: userId })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      await supabase.from("conversation_participants").insert([
        { conversation_id: newConv.id, user_id: userId },
        { conversation_id: newConv.id, user_id: otherUserId },
      ]);

      await fetchConversations();
      return newConv.id;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [userId, fetchConversations]);

  useEffect(() => {
    if (userId) {
      fetchConversations();
    }
  }, [userId, fetchConversations]);

  // Real-time subscription for conversations
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refresh: fetchConversations,
    startDirectConversation,
  };
}

export function useConversation(conversationId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:sender_id (
            id,
            full_name,
            avatar_url,
            role
          )
        `)
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  const fetchParticipants = useCallback(async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from("conversation_participants")
      .select(`
        *,
        user:user_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq("conversation_id", conversationId);

    setParticipants(data || []);
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "image" | "file" = "text", fileUrl?: string, fileName?: string) => {
      if (!conversationId || !content.trim()) return;

      try {
        const { error } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: content.trim(),
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
        });

        if (error) throw error;
        
        // Clear typing indicator
        await supabase
          .from("typing_indicators")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("user_id", userId);
      } catch (err) {
        console.error("Error sending message:", err);
      }
    },
    [conversationId, userId]
  );

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId) return;

    try {
      if (isTyping) {
        await supabase.from("typing_indicators").upsert(
          { conversation_id: conversationId, user_id: userId, started_at: new Date().toISOString() },
          { onConflict: "conversation_id,user_id" }
        );

        // Auto-clear after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      } else {
        await supabase
          .from("typing_indicators")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("user_id", userId);
      }
    } catch (err) {
      console.error("Error setting typing:", err);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      fetchParticipants();
    }
  }, [conversationId, fetchMessages, fetchParticipants]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const messagesChannel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the new message with sender info
          const { data } = await supabase
            .from("messages")
            .select(`
              *,
              sender:sender_id (
                id,
                full_name,
                avatar_url,
                role
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          // Fetch current typing users
          const { data } = await supabase
            .from("typing_indicators")
            .select(`
              user_id,
              profiles:user_id (
                full_name
              )
            `)
            .eq("conversation_id", conversationId)
            .neq("user_id", userId);

          setTypingUsers(
            (data || [])
              .filter((t: any) => t.profiles)
              .map((t: any) => ({
                user_id: t.user_id,
                full_name: t.profiles.full_name,
              }))
          );
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      typingChannel.unsubscribe();
    };
  }, [conversationId, userId]);

  return {
    messages,
    loading,
    typingUsers,
    participants,
    sendMessage,
    setTyping,
    refresh: fetchMessages,
  };
}
