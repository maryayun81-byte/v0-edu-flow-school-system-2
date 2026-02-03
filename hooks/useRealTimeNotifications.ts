"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Notification {
  id: string;
  type: "note" | "assignment" | "quiz" | "class" | "general";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

export function useRealTimeNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
    setLoading(false);
  }, [userId]);

  // Add a toast notification
  const addToast = useCallback(
    (message: string, type: ToastNotification["type"] = "info") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  // Remove a specific toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  // Create a notification
  const createNotification = useCallback(
    async (
      type: Notification["type"],
      title: string,
      message: string,
      data?: Record<string, unknown>
    ) => {
      const { error } = await supabase.from("notifications").insert({
        type,
        title,
        message,
        data,
        is_read: false,
      });

      if (!error) {
        addToast(message, "success");
      }
    },
    [addToast]
  );

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Subscribe to notifications table changes
    const notificationsChannel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          addToast(newNotification.message, "info");
        }
      )
      .subscribe();

    // Subscribe to notes changes
    const notesChannel = supabase
      .channel("realtime-notes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notes" },
        (payload) => {
          addToast("New study material uploaded!", "info");
        }
      )
      .subscribe();

    // Subscribe to assignments changes
    const assignmentsChannel = supabase
      .channel("realtime-assignments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assignments" },
        (payload) => {
          addToast("New assignment posted!", "warning");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "assignments" },
        (payload) => {
          const updated = payload.new as { is_completed?: boolean };
          if (updated.is_completed) {
            addToast("Assignment marked as complete!", "success");
          }
        }
      )
      .subscribe();

    // Subscribe to quizzes changes
    const quizzesChannel = supabase
      .channel("realtime-quizzes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quizzes" },
        (payload) => {
          const newQuiz = payload.new as { is_published?: boolean };
          if (newQuiz.is_published) {
            addToast("New quiz available!", "info");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes" },
        (payload) => {
          const updated = payload.new as { is_published?: boolean };
          if (updated.is_published) {
            addToast("New quiz published!", "info");
          }
        }
      )
      .subscribe();

    // Subscribe to timetable changes
    const timetableChannel = supabase
      .channel("realtime-timetable")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetables" },
        (payload) => {
          addToast("Class schedule updated!", "info");
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      notificationsChannel.unsubscribe();
      notesChannel.unsubscribe();
      assignmentsChannel.unsubscribe();
      quizzesChannel.unsubscribe();
      timetableChannel.unsubscribe();
    };
  }, [userId, fetchNotifications, addToast]);

  return {
    notifications,
    toasts,
    unreadCount,
    loading,
    addToast,
    removeToast,
    markAsRead,
    markAllAsRead,
    createNotification,
    refreshNotifications: fetchNotifications,
  };
}
