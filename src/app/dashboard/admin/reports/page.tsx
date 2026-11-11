"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { AiReportsCard } from "@/components/admin/AiReportsCard";

/** Admin console — AI reports: what members flagged in ÖRZA's AI output (Google Play's AI-Generated Content policy). */
export default function AdminAiReportsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin console"
        title="AI reports"
        description="Members report AI replies, recipes and plans they find offensive, unsafe or wrong. Read what they saw, fix the cause in the prompts or filters, reply by email when it helps, then mark it reviewed."
      />
      <Reveal y={10}>
        <AiReportsCard />
      </Reveal>
    </div>
  );
}
