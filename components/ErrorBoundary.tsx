'use client';

import React from "react"

import { useEffect } from 'react';

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress unhandled promise rejections from browser extensions (MetaMask, etc.)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason);
      
      // Suppress errors from browser extensions
      if (
        errorMessage.includes('MetaMask') ||
        errorMessage.includes('ethereum') ||
        errorMessage.includes('wallet') ||
        errorMessage.includes('Web3')
      ) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}
