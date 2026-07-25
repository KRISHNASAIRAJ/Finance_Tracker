import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';

const DAYS = [
  { day: 'Monday', tag: 'Non-veg · Chicken', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + 4 soaked almonds + 2 walnuts' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Overnight oats: Greek yoghurt, fruit, walnuts, peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + tomato rasam + airfryer chicken (double batch) + sautéed cabbage' },
    { time: '10:45 AM', label: 'Snack', detail: 'Roasted chana (¼ cup) + mixed nuts' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + rasam + chicken + cabbage, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted peanuts + seed dose' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning chicken + 2 ragi dosa with chutney' },
  ]},
  { day: 'Tuesday', tag: 'Non-veg · Chicken · Dosa day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked black raisins' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Dosa + tomato chutney + 1 boiled egg, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + sambar + airfryer chicken + carrot poriyal' },
    { time: '10:45 AM', label: 'Snack', detail: 'Protein smoothie: banana + peanut butter + plant protein + water' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + sambar + chicken + carrot poriyal, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted makhana in ghee + seed dose' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning chicken + fresh chapati' },
  ]},
  { day: 'Wednesday', tag: 'Vegetarian · Mandatory dal', veg: true, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Overnight oats: Greek yoghurt, fruit, almonds, peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + dal tadka (double batch) + sautéed cabbage' },
    { time: '10:45 AM', label: 'Snack', detail: 'Fruit chaat with roasted peanuts' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + dal + cabbage, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted chana + nuts + Greek yoghurt bowl' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning dal + ragi dosa with chutney' },
  ]},
  { day: 'Thursday', tag: 'Vegetarian', veg: true, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked raisins' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Sourdough toast + avocado + peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + tomato pappu + paneer/mushroom curry + beetroot poriyal' },
    { time: '10:45 AM', label: 'Snack', detail: 'Protein smoothie: fruit + peanut butter + plant protein + water' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + pappu + paneer/mushroom + beetroot, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted chana + nuts + fruit' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat paneer/mushroom curry + aloo-paneer paratha' },
  ]},
  { day: 'Friday', tag: 'Non-veg · Chicken · Dosa day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Dosa + chutney + 1 boiled egg, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + rasam + airfryer chicken + bhindi fry' },
    { time: '10:45 AM', label: 'Snack', detail: 'Roasted makhana + mixed nuts' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + rasam + chicken + bhindi fry, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted peanuts + seed dose' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning chicken + fresh chapati' },
  ]},
  { day: 'Saturday', tag: 'Fish/prawns alt weekends · else chicken', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked raisins' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Overnight oats: Greek yoghurt, banana/avocado, walnuts, peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + veg kurma + fish/prawns or chicken + sautéed cabbage' },
    { time: '10:45 AM', label: 'Snack', detail: 'Protein smoothie (blender at home)' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + kurma + fish/chicken + cabbage, from tiffin' },
    { time: '5:30 PM', label: 'Snack', detail: 'Roasted chana + nuts + fruit' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning protein + ragi dosa' },
  ]},
  { day: 'Sunday', tag: 'Non-veg · Chicken · Prep day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water + soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast', detail: 'Sourdough/milk bread + peanut butter + banana, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + sambar + mixed veg curry + chicken curry (bigger meal)' },
    { time: '10:45 AM', label: 'Snack', detail: 'Nuts + seeds trail mix' },
    { time: '1:30 PM', label: 'Lunch (office)', detail: 'Rice + sambar + veg curry + chicken, from tiffin' },
    { time: '5:30 PM', label: 'Snack + prep', detail: 'Fruit chaat + Greek yoghurt. Make dosa batter, soak moong, marinate, roast seeds' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat morning chicken + fresh chapati' },
  ]},
];

export default function DietViewerScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Project 65</Text>
          <Text style={styles.appBarSubtitle}>Body Recomposition Protocol</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}><Text style={styles.statVal}>54<Text style={styles.statUnit}> kg</Text></Text><Text style={styles.statLabel}>Current</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>65<Text style={styles.statUnit}> kg</Text></Text><Text style={styles.statLabel}>Target</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>170.6<Text style={styles.statUnit}> cm</Text></Text><Text style={styles.statLabel}>Height</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>18.5</Text><Text style={styles.statLabel}>BMI</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>2,650</Text><Text style={styles.statLabel}>kcal/day</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>140g</Text><Text style={styles.statLabel}>Protein</Text></View>
        </View>

        {/* Daily Dose */}
        <Text style={styles.sectionTitle}>DAILY FIXED DOSE</Text>
        <View style={styles.doseCard}>
          {[
            { icon: 'nutrition-outline', text: '1 tbsp pumpkin seeds + 1 tbsp sesame seeds, lightly roasted' },
            { icon: 'leaf-outline', text: '1 fruit: banana / avocado / pineapple / orange (buy one at a time)' },
            { icon: 'flame-outline', text: 'Fats: 1-2 tsp ghee on dal/rice · Anveshan groundnut oil for cooking' },
            { icon: 'fitness-outline', text: '1 scoop Comix plant protein (~24g) blended into shake/day' },
            { icon: 'water-outline', text: '2.5-3 litres water per day' },
          ].map((item, i) => (
            <View key={i} style={styles.doseItem}>
              <Ionicons name={item.icon as any} size={16} color={colors.primary} />
              <Text style={styles.doseText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* 7-Day Plan */}
        <Text style={styles.sectionTitle}>7-DAY ROTATION</Text>
        {DAYS.map((day) => (
          <View key={day.day} style={styles.dayCard}>
            <View style={[styles.dayHead, day.veg && styles.dayHeadVeg]}>
              <Text style={styles.dayName}>{day.day}</Text>
              <Text style={[styles.dayTag, day.veg && styles.dayTagVeg]}>{day.tag}</Text>
            </View>
            {day.meals.map((meal, i) => (
              <View key={i} style={styles.mealRow}>
                <Text style={styles.mealTime}>{meal.time}</Text>
                <View style={styles.mealContent}>
                  <Text style={styles.mealLabel}>{meal.label} —</Text>
                  <Text style={styles.mealDetail}>{meal.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Notes */}
        <Text style={styles.sectionTitle}>KEY NOTES</Text>
        <View style={styles.notesCard}>
          <Text style={styles.noteItem}>• All cooking done in one block: 5:30-7:45 AM (breakfast + lunch + dinner's protein doubled)</Text>
          <Text style={styles.noteItem}>• Lunch goes in tiffin to office (8 AM-6 PM, 40 min commute)</Text>
          <Text style={styles.noteItem}>• Dinner: reheat morning's protein + fresh dosa/chapati (5-10 min)</Text>
          <Text style={styles.noteItem}>• No non-veg Wed & Thu. Fish/prawns alternate Saturdays only.</Text>
          <Text style={styles.noteItem}>• Only Greek yoghurt (Epigamia/Milkymist), no curd or buttermilk</Text>
          <Text style={styles.noteItem}>• Track weight weekly, not daily. Photos monthly.</Text>
          <Text style={styles.noteItem}>• Walks: 15-20 min morning + evening for circulation and posture</Text>
          <Text style={styles.noteItem}>• Bloodwork clear — repeat in a few months (V-D, B12, ferritin, zinc)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  appBarSubtitle: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 1 },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  statsCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 14, gap: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statItem: { width: '33%', alignItems: 'center', paddingVertical: 8 },
  statVal: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  statUnit: { fontSize: 11, fontWeight: '500', color: colors.onSurfaceVariant },
  statLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.8, marginTop: 8 },
  doseCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  doseItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  doseText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  dayCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#3b82f620' },
  dayHeadVeg: { backgroundColor: `${colors.success}20` },
  dayName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  dayTag: { fontSize: 10, fontWeight: '600', color: '#3b82f6', backgroundColor: '#3b82f615', paddingHorizontal: 8, paddingVertical: 3, borderRadius: rounded.full },
  dayTagVeg: { color: colors.success, backgroundColor: `${colors.success}15` },
  mealRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  mealTime: { width: 80, padding: 10, fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600' },
  mealContent: { flex: 1, padding: 10, paddingLeft: 0 },
  mealLabel: { fontSize: 11, fontWeight: '600', color: colors.primary },
  mealDetail: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  notesCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  noteItem: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 19 },
});
