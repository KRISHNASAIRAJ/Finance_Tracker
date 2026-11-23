/** Text with search matches tinted in the Notes accent (amber). */
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { mc } from '../../../shared/theme/meridian';
import { highlightSegments } from '../search';

interface Props {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function HighlightedText({ text, query, style, numberOfLines }: Props) {
  const segments = highlightSegments(text, query);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, i) => (
        <Text key={i} style={segment.match ? styles.match : undefined}>{segment.text}</Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  match: { color: mc.amber, fontWeight: '600' },
});
