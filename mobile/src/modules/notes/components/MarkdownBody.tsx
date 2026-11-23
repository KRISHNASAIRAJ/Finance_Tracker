/**
 * MarkdownBody — read-only styled preview of body_md, built on RN Text with
 * the Meridian tokens (no Markdown dependency). Checklist lines get tappable
 * circles so they behave like Apple Notes checklists.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mc } from '../../../shared/theme/meridian';
import PressScale from '../../../shared/components/meridian/PressScale';
import { toggleChecklistItem } from '../markdown';

interface Props {
  bodyMd: string;
  onToggleChecklist?: (lineIndex: number, newBody: string) => void;
}

const INLINE = /(\*\*[^*]+\*\*|<u>[\s\S]*?<\/u>|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]*\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return String(text || '').split(INLINE).filter((part) => part.length > 0).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={key} style={styles.bold}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      return <Text key={key} style={styles.underline}>{part.slice(3, -4)}</Text>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <Text key={key} style={styles.strike}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={key} style={styles.mono}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <Text key={key} style={styles.italic}>{part.slice(1, -1)}</Text>;
    }
    const link = /^\[([^\]]+)\]\(([^)]*)\)$/.exec(part);
    if (link) return <Text key={key} style={styles.link}>{link[1]}</Text>;
    return <Text key={key}>{part}</Text>;
  });
}

export default function MarkdownBody({ bodyMd, onToggleChecklist }: Props) {
  const lines = String(bodyMd || '').split('\n');
  return (
    <View style={styles.body}>
      {lines.map((line, index) => {
        const key = `line-${index}`;
        if (!line.trim()) return <View key={key} style={styles.gap} />;

        if (/^\s*[-*+]\s+\[[ xX]\]/.test(line)) {
          const done = /\[[xX]\]/.test(line);
          const label = line.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, '');
          return (
            <PressScale
              key={key}
              onPress={() => onToggleChecklist?.(index, toggleChecklistItem(bodyMd, index))}
              scale={0.98}
              style={styles.checkRow}
              accessibilityLabel={done ? 'Mark checklist item incomplete' : 'Complete checklist item'}
            >
              <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                {done ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={[styles.checkText, done && styles.checkTextDone]}>{renderInline(label, key)}</Text>
            </PressScale>
          );
        }

        if (/^#\s+/.test(line)) return <Text key={key} style={styles.h1}>{renderInline(line.replace(/^#\s+/, ''), key)}</Text>;
        if (/^##\s+/.test(line)) return <Text key={key} style={styles.h2}>{renderInline(line.replace(/^##\s+/, ''), key)}</Text>;
        if (/^###\s+/.test(line)) return <Text key={key} style={styles.h3}>{renderInline(line.replace(/^###\s+/, ''), key)}</Text>;
        if (/^>\s?/.test(line)) {
          return (
            <View key={key} style={styles.quote}>
              <Text style={styles.quoteText}>{renderInline(line.replace(/^>\s?/, ''), key)}</Text>
            </View>
          );
        }

        const bullet = /^(\s*)([-*+]|\d+\.)\s+/.exec(line);
        if (bullet) {
          return (
            <View key={key} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>{bullet[2] === '*' ? '–' : bullet[2]}</Text>
              <Text style={styles.bodyText}>{renderInline(line.slice(bullet[0].length), key)}</Text>
            </View>
          );
        }

        return <Text key={key} style={styles.bodyText}>{renderInline(line, key)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 2 },
  gap: { height: 8 },
  bodyText: { fontSize: 15, lineHeight: 22, color: mc.text },
  h1: { fontSize: 26, fontWeight: '600', color: mc.text, marginTop: 8, marginBottom: 4 },
  h2: { fontSize: 19, fontWeight: '600', color: mc.text, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 16, fontWeight: '600', color: mc.text, marginTop: 8, marginBottom: 3 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike: { textDecorationLine: 'line-through', color: mc.textDim },
  mono: { fontFamily: 'monospace', color: mc.amber },
  link: { color: mc.sky, textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, borderLeftColor: mc.amber, paddingLeft: 12, marginVertical: 4 },
  quoteText: { fontSize: 15, fontStyle: 'italic', color: mc.textDim, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletMark: { color: mc.amber, fontSize: 15, lineHeight: 22 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    borderColor: mc.textGhost, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkCircleDone: { backgroundColor: mc.amber, borderColor: mc.amber },
  checkMark: { fontSize: 12, color: mc.ink, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 15, lineHeight: 22, color: mc.text },
  checkTextDone: { color: mc.textDim, textDecorationLine: 'line-through' },
});
