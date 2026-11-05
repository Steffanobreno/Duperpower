"use client";
import { useState, type ReactNode } from "react";
import { Popup } from "./popup";

/** A confirmation shown as a small window that closes by itself ("Appointment booked."). */
export function Toast({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? <Popup kind="success" onClose={() => setOpen(false)} autoClose={3500}>{children}</Popup> : null;
}
