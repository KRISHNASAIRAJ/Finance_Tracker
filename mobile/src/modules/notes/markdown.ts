/**
 * markdown — pure helpers for the Notes v2 body format.
 *
 * Body format: `title\n\nrest...`, with Apple-Notes checklists (`- [ ]`,
 * `- [x]`). Everything here is deliberately line-based with simple anchored
 * replacements: a 100k-character note must not trigger regex backtracking.
 */

export type FormatKind =
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'mono'
  | 'title' | 'heading' | 'subheading' | 'body'
  | 'bullet' | 'dash' | 'numbered' | 'quote' | 'checklist'
  | 'indent' | 'outdent' | 'table';

export interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const WRAPPERS: Partial<Record<FormatKind, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['<u>', '</u>'],
  strikethrough: ['~~', '~~'],
  mono: ['`', '`'],
};

const PREFIXES: Partial<Record<FormatKind, string>> = {
  title: '# ',
  heading: '## ',
  subheading: '### ',
  bullet: '- ',
  dash: '* ',
  numbered: '1. ',
  quote: '> ',
  checklist: '- [ ] ',
};

/** Remove Markdown markers for previews and search indexing. */
export function stripMarkdown(input: string): string {
  let out = input;
  out = out.replace(/^\s*#{1,6}\s+/gm, '');
  out = out.replace(/^\s*>\s?/gm, '');
  // Checklist markers must be stripped BEFORE the generic bullet marker,
  // otherwise "- [x] Item" is reduced to "[x] Item".
  out = out.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '');
  out = out.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/gm, '');
  out = out.replace(/\*\*|__|~~|<u>|<\/u>|`/g, '');
  out = out.replace(/(^|\s)\*(?!\s)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return out.replace(/\s+/g, ' ').trim();
}

/** Title = first non-empty line, markdown stripped. */
export function titleFromBody(bodyMd: string): string {
  const lines = String(bodyMd || '').split('\n');
  for (const line of lines) {
    const cleaned = stripMarkdown(line);
    if (cleaned) return cleaned;
  }
  return 'New Note';
}

/** Preview = the following lines, markdown stripped, collapsed to one line. */
export function previewFromBody(bodyMd: string, maxLines = 2): string {
  const lines = String(bodyMd || '').split('\n');
  let seenTitle = false;
  const picked: string[] = [];
  for (const line of lines) {
    if (!seenTitle) {
      if (stripMarkdown(line)) seenTitle = true;
      continue;
    }
    const cleaned = stripMarkdown(line);
    if (!cleaned) continue;
    picked.push(cleaned);
    if (picked.length >= maxLines) break;
  }
  return picked.join(' ');
}

export interface ChecklistProgress { done: number; total: number }

export function checklistProgress(bodyMd: string): ChecklistProgress {
  let done = 0;
  let total = 0;
  for (const line of String(bodyMd || '').split('\n')) {
    if (/^\s*[-*+]\s+\[[ xX]\]\s*/.test(line)) {
      total++;
      if (/\[[xX]\]/.test(line)) done++;
    }
  }
  return { done, total };
}

/** Toggle the checklist marker on a single line. Returns the full body. */
export function toggleChecklistItem(bodyMd: string, lineIndex: number): string {
  const lines = String(bodyMd || '').split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return bodyMd;
  const line = lines[lineIndex];
  if (/\[[xX]\]/.test(line)) {
    lines[lineIndex] = line.replace(/\[[xX]\]/, '[ ]');
  } else if (/^\s*[-*+]\s+\[ \]/.test(line)) {
    lines[lineIndex] = line.replace(/\[ \]/, '[x]');
  }
  return lines.join('\n');
}

/** Checked items move to the bottom only when the user enables it. */
export function moveCheckedToBottom(bodyMd: string): string {
  const lines = String(bodyMd || '').split('\n');
  const open: string[] = [];
  const checked: string[] = [];
  for (const line of lines) {
    if (/^\s*[-*+]\s+\[[xX]\]/.test(line)) checked.push(line);
    else open.push(line);
  }
  return [...open, ...checked].join('\n');
}

const LEADING_MARKER = /^(\s*)(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+|- \[[ xX]\]\s+)?/;

function applyPrefixToLines(body: string, start: number, end: number, prefix: string): FormatResult {
  const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = body.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? body.length : nextBreak;
  const segment = body.slice(lineStart, lineEnd);
  const lines = segment.split('\n').map((line) => `${LEADING_MARKER.exec(line)?.[1] ?? ''}${prefix}${line.replace(LEADING_MARKER, '')}`);
  const text = body.slice(0, lineStart) + lines.join('\n') + body.slice(lineEnd);
  return { text, selectionStart: lineStart, selectionEnd: lineStart + lines.join('\n').length };
}

/** Apply a formatting action at the current selection. */
export function formatRange(body: string, start: number, end: number, kind: FormatKind): FormatResult {
  const safeBody = String(body || '');
  const s = Math.max(0, Math.min(start, safeBody.length));
  const e = Math.max(s, Math.min(end, safeBody.length));

  if (kind === 'table') {
    const skeleton = '\n| Column | Column |\n| --- | --- |\n|  |  |\n';
    return {
      text: safeBody.slice(0, s) + skeleton + safeBody.slice(e),
      selectionStart: s + 1,
      selectionEnd: s + 1 + 'Column'.length,
    };
  }

  const wrapper = WRAPPERS[kind];
  if (wrapper) {
    const [open, close] = wrapper;
    const selected = safeBody.slice(s, e);
    // Wrappers may sit just OUTSIDE the selection (the user selected only the
    // words inside a bold span) — detect and remove those first.
    if (safeBody.slice(s - open.length, s) === open && safeBody.slice(e, e + close.length) === close) {
      return {
        text: safeBody.slice(0, s - open.length) + selected + safeBody.slice(e + close.length),
        selectionStart: s - open.length,
        selectionEnd: e - open.length,
      };
    }
    if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
      const inner = selected.slice(open.length, selected.length - close.length);
      return {
        text: safeBody.slice(0, s) + inner + safeBody.slice(e),
        selectionStart: s,
        selectionEnd: s + inner.length,
      };
    }
    return {
      text: safeBody.slice(0, s) + open + selected + close + safeBody.slice(e),
      selectionStart: s + open.length,
      selectionEnd: s + open.length + selected.length,
    };
  }

  if (kind === 'indent' || kind === 'outdent') {
    const lineStart = safeBody.lastIndexOf('\n', Math.max(0, s - 1)) + 1;
    const nextBreak = safeBody.indexOf('\n', e);
    const lineEnd = nextBreak === -1 ? safeBody.length : nextBreak;
    const segment = safeBody.slice(lineStart, lineEnd);
    const changed = kind === 'indent'
      ? segment.split('\n').map((l) => `  ${l}`).join('\n')
      : segment.split('\n').map((l) => l.replace(/^ {1,2}/, '')).join('\n');
    return {
      text: safeBody.slice(0, lineStart) + changed + safeBody.slice(lineEnd),
      selectionStart: lineStart,
      selectionEnd: lineStart + changed.length,
    };
  }

  if (kind === 'body') return applyPrefixToLines(safeBody, s, e, '');
  const prefix = PREFIXES[kind];
  return prefix ? applyPrefixToLines(safeBody, s, e, prefix) : { text: safeBody, selectionStart: s, selectionEnd: e };
}

/** Clean Markdown for export/share. */
export function exportAsText(bodyMd: string, tags: string[] = []): string {
  const cleaned = String(bodyMd || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  const tagLine = tags.filter(Boolean).map((t) => `#${t.replace(/^#/, '')}`).join(' ');
  return tagLine ? `${cleaned}\n\n${tagLine}\n` : `${cleaned}\n`;
}
