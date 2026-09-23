"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered frosted-glass dialog. `side="right"` renders a drawer (used for mobile menus). */
export function DialogContent({
  className,
  children,
  title,
  description,
  side = "center",
  hideClose,
  ...rest
}: React.ComponentProps<typeof D.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: "center" | "right";
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgba(7,9,12,0.35)] backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed z-50 border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.9)] backdrop-blur-orza shadow-orza-floating focus:outline-none",
          side === "center" &&
            "left-1/2 top-1/2 w-[min(520px,calc(100%-32px))] max-h-[calc(100dvh-48px)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-orza-xl p-6 sm:p-7",
          side === "right" && "right-0 top-0 h-dvh w-[86vw] sm:w-[380px] overflow-y-auto p-6",
          className
        )}
        {...rest}
      >
        <D.Title className="font-editorial text-[22px] leading-7 font-semibold text-orza-strong pr-8">{title}</D.Title>
        {description ? (
          <D.Description className="mt-1.5 text-sm text-orza-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
        )}
        <div className="mt-5">{children}</div>
        {!hideClose && (
          <D.Close
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-orza-muted hover:bg-black/5 hover:text-orza-strong"
          >
            <X className="h-4 w-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
