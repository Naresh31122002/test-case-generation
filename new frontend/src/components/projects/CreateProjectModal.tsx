"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { createProject } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [nameError, setNameError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Project name is required.");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError("");
    const project = createProject(name, description, domain);
    setName("");
    setDescription("");
    setDomain("");
    onClose();
    onCreated?.(project.id);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-md bg-white border border-border rounded-card shadow-card overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-navy">Create Project</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-navy transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Project name <span className="text-pink">*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(""); }}
                  placeholder="e.g. Payments Platform"
                  className={`w-full h-10 px-3 rounded-btn border text-sm text-navy placeholder:text-muted focus:outline-none transition-colors ${
                    nameError ? "border-[#EF4444] focus:border-[#EF4444]" : "border-border focus:border-pink"
                  }`}
                />
                {nameError && (
                  <p className="text-xs text-[#EF4444] mt-1">{nameError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this project cover?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Domain
                </label>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. FinTech, E-Commerce, Healthcare"
                  className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="h-9 px-4 rounded-btn bg-pink text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Create Project
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
