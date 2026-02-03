"use client";

import { QRCodeSVG } from "qrcode.react";
import { GraduationCap, School, BookOpen, Calendar, Sparkles } from "lucide-react";

interface StudentIDCardProps {
  fullName: string;
  admissionNumber: string;
  schoolName: string;
  formClass: string;
  subjects: string[];
  avatarUrl?: string;
  createdAt?: string;
}

export default function StudentIDCard({
  fullName,
  admissionNumber,
  schoolName,
  formClass,
  subjects,
  avatarUrl,
  createdAt,
}: StudentIDCardProps) {
  const currentYear = new Date().getFullYear();
  const joinYear = createdAt ? new Date(createdAt).getFullYear() : currentYear;

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* ID Card */}
      <div className="relative bg-gradient-to-br from-card via-card/95 to-card/90 border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header Strip */}
        <div className="bg-gradient-to-r from-primary to-accent h-2" />

        {/* Card Content */}
        <div className="p-6">
          {/* School Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-foreground text-sm">EduFlow</span>
                <p className="text-[10px] text-muted-foreground">Student ID</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Academic Year</p>
              <p className="text-sm font-bold text-foreground">{currentYear}</p>
            </div>
          </div>

          {/* Student Info */}
          <div className="flex gap-4 mb-6">
            {/* Avatar */}
            <div className="w-20 h-24 bg-muted rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/50">
              {avatarUrl ? (
                <img
                  src={avatarUrl || "/placeholder.svg"}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate mb-1">
                {fullName}
              </h2>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <School className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate">{schoolName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">{formClass}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">Since {joinYear}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Admission Number */}
          <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border/30">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Admission Number
            </p>
            <p className="text-xl font-mono font-bold text-chart-3 tracking-wider">
              {admissionNumber}
            </p>
          </div>

          {/* Subjects */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Enrolled Subjects
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {subjects.slice(0, 6).map((subject) => (
                <span
                  key={subject}
                  className="px-2 py-1 bg-primary/10 text-primary text-[10px] rounded-md font-medium"
                >
                  {subject}
                </span>
              ))}
              {subjects.length > 6 && (
                <span className="px-2 py-1 bg-muted text-muted-foreground text-[10px] rounded-md">
                  +{subjects.length - 6} more
                </span>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">
                Scan for verification
              </p>
              <p className="text-[8px] text-muted-foreground/70">
                This card is property of EduFlow. If found, please return to the
                school office.
              </p>
            </div>
            <div className="bg-foreground p-2 rounded-lg">
              <QRCodeSVG
                value={`EDUFLOW:${admissionNumber}`}
                size={48}
                level="M"
                bgColor="transparent"
                fgColor="var(--background)"
              />
            </div>
          </div>
        </div>

        {/* Footer Strip */}
        <div className="bg-gradient-to-r from-accent to-primary h-1" />
      </div>

      {/* Print Notice */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Present this ID card for all school activities
      </p>
    </div>
  );
}
