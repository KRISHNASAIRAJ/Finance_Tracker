/**
 * DailyReportScreen — AI-generated daily report (evening summary / morning briefing).
 * Reports are generated server-side (pg_cron → ai-daily-report Edge Function → Groq)
 * and pushed via Expo notifications; this screen reads the latest report and
 * can trigger an on-demand generation for today.
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { useAuth } from '../../../services/AuthProvider';
import {
  fetchDailyReports,
  triggerDailyReport,
  DailyReport as DailyReportData,
} from '../../../services/aiServices';

function istToday(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
  return ist.toISOString().split('T')[0];
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const base = Date.parse(istToday());
  for (let i = 0; i < n; i++) {
    out.push(new Date(base - i * 86400000).toISOString().split('T')[0]);
  }
  return out;
}

export default function DailyReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<DailyReportData[]>([]);
  const [selectedDate, setSelectedDate] = useState(istToday());
  const [mode, setMode] = useState<'evening' | 'morning'>('evening');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    const list = await fetchDailyReports();
    setReports(list);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load, user]);

  const dateReports = reports.filter((r) => r.reportDate === selectedDate);
  const active =
    dateReports.find((r) => r.mode === mode) ??
    dateReports[0] ??
    null;
  const activeMode = active?.mode ?? mode;

  const handleGenerate = async () => {
    if (generating || !user) return;
    setGenerating(true);
    setErrMsg(null);
    const ok = await triggerDailyReport(mode);
    if (ok) {
      await load();
    } else {
      setErrMsg('Could not generate the report. Check your connection and try again.');
    }
    setGenerating(false);
  };

  const renderBody = (body: string) => {
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((line, i) => {
      if (line.startsWith('- ')) {
        return (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{line.slice(2)}</Text>
          </View>
        );
      }
      return (
        <Text key={i} style={styles.bodyText}>
          {line}
        </Text>
      );
    });
  };

  const dateChipLabel = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const prettyDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Daily Report</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleGenerate}
          disabled={generating || loading}
        >
          {generating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {lastNDays(4).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dateChip, d === selectedDate && styles.dateChipActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.dateChipText, d === selectedDate && styles.dateChipTextActive]}>
                {d === istToday() ? 'Today' : dateChipLabel(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          {(['evening', 'morning'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, activeMode === m && styles.modeChipActive]}
              onPress={() => setMode(m)}
            >
              <Ionicons
                name={m === 'evening' ? 'moon-outline' : 'sunny-outline'}
                size={14}
                color={activeMode === m ? colors.onPrimary : colors.textSecondary}
              />
              <Text style={[styles.modeText, activeMode === m && styles.modeTextActive]}>
                {m === 'evening' ? 'Evening 9:30 PM' : 'Morning 8:30 AM'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : active && active.content?.headline ? (
          <>
            {/* Headline card */}
            <View style={styles.headlineCard}>
              <Text style={styles.headlineDate}>{prettyDate}</Text>
              <Text style={styles.headline}>{active.content.headline}</Text>
              <Text style={styles.summary}>{active.content.summary}</Text>
            </View>

            {/* Sections */}
            {active.content.sections.map((sec, i) => (
              <View key={i} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                {sec.title === 'QUOTE' ? (
                  <View style={styles.quoteBox}>
                    {renderBody(sec.body)}
                  </View>
                ) : (
                  renderBody(sec.body)
                )}
              </View>
            ))}

            <Text style={styles.disclaimer}>{active.content.disclaimer}</Text>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>
              No {activeMode === 'evening' ? 'evening' : 'morning'} report for {dateChipLabel(selectedDate)}
            </Text>
            <Text style={styles.emptySubtext}>
              Reports arrive automatically — evening at 9:30 PM, morning at 8:30 AM.
            </Text>
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
              {generating ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
                  <Text style={styles.generateBtnText}>Generate Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {errMsg ? <Text style={styles.errorText}>{errMsg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 40,
    gap: 12,
  },
  dateStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateChipTextActive: {
    color: colors.onPrimary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.onPrimary,
  },
  headlineCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 16,
    gap: 8,
  },
  headlineDate: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
    lineHeight: 26,
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.primary,
  },
  bodyText: {
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 21,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
  },
  disclaimer: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
});
