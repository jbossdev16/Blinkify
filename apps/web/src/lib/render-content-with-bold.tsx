import type React from "react";

/**
 * Renders text with Markdown-style * and ** as bold (no extra deps).
 * Use for AI assistant message content.
 */
export function renderContentWithBold(content: string): React.ReactNode {
  if (!content.trim()) return content;
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastEnd = 0;
  let match;
  let key = 0;
  let anyMatch = false;
  while ((match = re.exec(content)) !== null) {
    anyMatch = true;
    if (match.index > lastEnd) {
      parts.push(<span key={key++}>{content.slice(lastEnd, match.index)}</span>);
    }
    parts.push(<strong key={key++}>{match[1] ?? match[2]}</strong>);
    lastEnd = re.lastIndex;
  }
  if (!anyMatch) return content;
  if (lastEnd < content.length) {
    parts.push(<span key={key++}>{content.slice(lastEnd)}</span>);
  }
  return <>{parts}</>;
}
