"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  audience: string;
  target_user_id?: string;
  priority: string;
  action_url?: string;
}

export function useNotifications(userId: string, userRole: 'student' | 'teacher' | 'admin') {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notifications with proper filtering
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch notifications that match the user's role/audience
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          read_status:notification_reads!left(read_at)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        // Process notifications to add read status
        const processedNotifications = data.map(n => ({
          ...n,
          read: n.read_status && n.read_status.length > 0
        }));

        setNotifications(processedNotifications);
        setUnreadCount(processedNotifications.filter((n) => !n.read).length);
      }
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notification_reads")
        .insert({ notification_id: id, user_id: userId });

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [userId]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Get all unread notification IDs
      const unreadNotifs = notifications.filter(n => !n.read);
      
      if (unreadNotifs.length === 0) return;

      // Insert read records for all unread notifications
      const readRecords = unreadNotifs.map(n => ({
        notification_id: n.id,
        user_id: userId
      }));

      const { error } = await supabase
        .from("notification_reads")
        .insert(readRecords);

      if (!error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [notifications, userId]);

  // Delete a notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      // Only admins can delete notifications, but we'll try anyway
      // RLS will prevent unauthorized deletions
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (!error) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((prev) => {
          const notif = notifications.find(n => n.id === id);
          return notif && !notif.read ? Math.max(0, prev - 1) : prev;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Subscribe to notifications table changes
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Check if notification is for this user based on audience
          const isForUser = 
            newNotification.audience === 'all' ||
            (newNotification.audience === userRole) ||
            (newNotification.audience === 'individual' && newNotification.target_user_id === userId);

          if (isForUser) {
            setNotifications((prev) => [{ ...newNotification, read: false }, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: fetchNotifications,
  };
}
