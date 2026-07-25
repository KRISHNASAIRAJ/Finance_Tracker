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
import { tc, ts, tr, card, sectionTitle } from '../../../shared/theme/tracend';

const DAYS = [
  { day: 'Monday', tag: 'Non-veg · chicken', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with 4 soaked almonds + 2 walnuts (eat after)' },
    { time: '7:00 AM', label: 'Breakfast (10 min)', detail: 'Overnight oats: oats soaked overnight in water + Greek yoghurt, topped with your current fruit, walnuts, a spoon of homemade peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + quick tomato rasam + airfryer marinated chicken (marinate a bigger batch — half airfried now for the tiffin, rest stays marinated in the fridge for tonight) + capsicum-onion fry' },
    { time: '10:45 AM', label: 'Snack', detail: 'Soaked chia-sabja water + 2–3 dates' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + rasam + chicken + capsicum-onion fry, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Cheese cubes + a few nuts' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Fresh airfried chicken (from the same marinade) + fresh ragi dosa (2) with chutney and a little butter' },
  ]},
  { day: 'Tuesday', tag: 'Non-veg · chicken · dosa day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked black raisins' },
    { time: '7:00 AM', label: 'Breakfast (20 min)', detail: 'Dosa (your batter) + tomato chutney + 1 boiled egg, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + quick sambar (sambar powder) + airfryer marinated chicken (bigger marinade batch, half airfried now) + carrot poriyal' },
    { time: '10:45 AM', label: 'Snack (carry)', detail: 'Protein smoothie: banana + peanut butter + 1 scoop plant protein + 1 tbsp chia + 1 tsp sabja (soaked) + water, blended, in a shaker' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + sambar + chicken + carrot poriyal, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Roasted makhana tossed in ghee + seed dose' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Fresh airfried chicken (from the same marinade) + fresh chapati with a light butter spread' },
  ]},
  { day: 'Wednesday', tag: 'Vegetarian · mandatory dal day', veg: true, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast (10 min)', detail: 'Overnight oats: oats soaked in water + Greek yoghurt, topped with your current fruit, almonds, peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + tomato-palakura pappu (moong dal with tomato + spinach, this week\'s mandatory dal, double batch)' },
    { time: '10:45 AM', label: 'Snack', detail: 'Fruit chaat with roasted peanuts' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + palakura pappu, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Roasted chana + nuts + small Greek yoghurt bowl' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat this morning\'s palakura pappu + fresh ragi dosa with chutney' },
  ]},
  { day: 'Thursday', tag: 'Vegetarian', veg: true, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked raisins' },
    { time: '7:00 AM', label: 'Breakfast (10 min)', detail: 'Toasted multigrain/sourdough with butter + mashed avocado, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + paneer curry (double batch) + beetroot poriyal — no dal today, since Wednesday already covers the week\'s dal' },
    { time: '10:45 AM', label: 'Snack (carry)', detail: 'Protein smoothie: fruit + peanut butter + 1 scoop plant protein + water' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + paneer curry + beetroot poriyal, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Roasted chana + nuts + fruit' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Reheat this morning\'s paneer curry + fresh aloo-paneer paratha (potato + paneer stuffing, a little butter on top — replaces moong dal chilla, same protein, familiar dish)' },
  ]},
  { day: 'Friday', tag: 'Non-veg · chicken · dosa day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast (20 min)', detail: 'Dosa (your batter) + chutney + 1 boiled egg, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + rasam + airfryer marinated chicken (bigger marinade batch, half airfried now) + bhindi fry' },
    { time: '10:45 AM', label: 'Snack', detail: 'Roasted makhana + mixed nuts' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + rasam + chicken + bhindi fry, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Soaked chia-sabja water + 2–3 dates' },
    { time: '7:45 PM', label: 'Dinner', detail: 'Fresh airfried chicken (from the same marinade) + fresh chapati with a light butter spread' },
  ]},
  { day: 'Saturday', tag: 'Fish/prawns on alternate weekends · else chicken', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked raisins' },
    { time: '7:00 AM', label: 'Breakfast (10 min)', detail: 'Overnight oats: oats soaked in water + Greek yoghurt, topped with banana/avocado, walnuts, peanut butter, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + quick veg kurma + airfryer fish or prawns (seafood weekend) — or chicken on the off week — + aloo fry' },
    { time: '10:45 AM', label: 'Snack', detail: 'Protein smoothie with 1 tbsp chia + 1 tsp sabja (soaked) blended in (easy on a weekend)' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + kurma + fish/prawns or chicken + aloo fry, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack', detail: 'Roasted chana + nuts + fruit' },
    { time: '7:45 PM', label: 'Dinner', detail: 'You\'ve got time this evening — cook a fresh small batch of fish/prawns or chicken + fresh ragi dosa' },
  ]},
  { day: 'Sunday', tag: 'Non-veg · chicken · prep day', veg: false, meals: [
    { time: '5:30 AM', label: 'Wake sip', detail: 'Warm water with soaked almonds' },
    { time: '7:00 AM', label: 'Breakfast (10 min)', detail: 'Toasted sourdough/milk bread with peanut butter and banana slices, seed dose' },
    { time: 'Same window', label: 'Lunch, packed', detail: 'Rice + sambar + mixed veg curry + chicken curry — this week\'s bigger, more relaxed meal' },
    { time: '10:45 AM', label: 'Snack', detail: 'Nuts + seeds trail mix' },
    { time: '1:30 PM', label: 'Lunch (at office)', detail: 'Rice + sambar + veg curry + chicken, from the tiffin' },
    { time: '5:30–6 PM', label: 'Snack + prep', detail: 'Fruit chaat + small Greek yoghurt bowl + a few dates. Use this slot to make the week\'s dosa batter, soak/sprout moong for chaats, marinate chicken or fish for the airfryer, and roast the seed/nut stock' },
    { time: '7:45 PM', label: 'Dinner', detail: 'You\'ve got time this evening — cook a fresh small batch of chicken + fresh chapati with butter' },
  ]},
];

const GROCERY = [
  { title: 'Grains & batters', items: ['Rice (sona masuri/basmati)', 'Ragi flour (have it)', 'Wheat flour (chapati/paratha)', 'Oats (rolled)', 'Moong dal, urad dal', 'Sourdough / multigrain / milk bread'] },
  { title: 'Proteins', items: ['Eggs', 'Chicken (local store, any day)', 'Fish / prawns (alternate weekends)', 'Paneer', 'Mushroom', 'Sprouts (moong/chana)', 'Potatoes (for aloo-paneer paratha)', 'Comix plant protein'] },
  { title: 'Dairy & fats', items: ['Epigamia/Milkymist Greek yoghurt', 'Anveshan groundnut oil', 'Desi ghee', 'Butter', 'Cheese cubes/slices', 'Homemade peanut butter (have it)'] },
  { title: 'Nuts, seeds & snacks', items: ['Pumpkin seeds', 'Sesame seeds', 'Chia seeds', 'Sabja (basil) seeds', 'Dates', 'Almonds, walnuts', 'Makhana (fox nuts)', 'Roasted chana', 'Peanuts'] },
  { title: 'Fruit & veg', items: ['Banana, avocado, pineapple (buy one at a time)', 'Orange (when available)', 'Palakura (spinach), menthikura (fenugreek leaves)', 'Bhindi (okra)', 'Carrot, beetroot, potato', 'Capsicum, tomato, onion'] },
  { title: 'Pantry', items: ['Turmeric, black pepper', 'Jeera, ginger-garlic', 'Coriander, mint', 'Sambar/rasam powder', 'Black raisins', 'Rock salt / regular salt'] },
];

const NOTES = [
  { important: false, title: 'Your bloodwork came back normal — good sign', text: 'With LFT and other markers clear, there\'s no red flag holding this plan back. Still worth repeating a basic panel (Vitamin D, B12, ferritin, zinc) in a few months once you\'re deeper into the surplus, just to confirm the plan is actually closing any gaps left over from the TB treatment — nothing urgent, just good tracking.' },
  { important: false, title: 'How the mornings (and evenings) actually work', text: 'Marinate the day\'s chicken or fish the night before (5 minutes), enough for two rounds — one to airfry in the morning for the tiffin, one left marinating in the fridge to airfry fresh in the evening. Rice and rasam/sambar/pappu are cooked in the same morning window. On the two veg days, the dal/paneer curry is made as a double batch and simply reheated at night since there\'s no meat to re-marinate. Evenings then only need 10–15 minutes: whichever protein is on deck plus a fresh dosa or chapati. Weekends are the exception — you\'ve got more time Saturday and Sunday evenings, so cook those dinners fresh rather than relying on the marinade-ahead system.' },
  { important: false, title: 'Introduce new foods gradually', text: 'Your gut has been through a long antibiotic course — bring in the daily Greek yoghurt, sprouts and plant protein shake gradually over the first 1–2 weeks rather than all at once, and watch how you respond before locking in full portions.' },
  { important: false, title: 'Track weekly, not daily', text: 'Weigh yourself once a week, same day, same time, before breakfast. Track waist and upper-arm measurements monthly, and take progress photos monthly. Daily weight swings from water and food volume will only distract you.' },
  { important: true, title: 'Workouts come after, not now', text: 'You\'ve already made the right call — this phase is about food, sleep and recovery. Once weight and energy improve (roughly 4–6 weeks in), a simple 3-day resistance routine focused on arms/shoulders/back will convert this surplus into visible muscle rather than just softness.' },
];

export default function DietViewerScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Project 65</Text>
          <Text style={styles.appBarSubtitle}>a build plan, not a diet.</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}><Text style={styles.statVal}>54<Text style={styles.statUnit}> kg</Text></Text><Text style={styles.statLabel} numberOfLines={1}>Current</Text></View>
          <View style={styles.statItem}><View style={styles.statValContainer}><Text style={styles.statVal}>65<Text style={styles.statUnit}> kg</Text></Text></View><Text style={styles.statLabel} numberOfLines={1}>Target</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>170.6<Text style={styles.statUnit}> cm</Text></Text><Text style={styles.statLabel} numberOfLines={1}>Height</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>23<Text style={styles.statUnit}> yrs</Text></Text><Text style={styles.statLabel} numberOfLines={1}>Age</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>18.5</Text><Text style={styles.statLabel} numberOfLines={1}>BMI</Text><Text style={styles.statSmallLabel}>underweight</Text></View>
          <View style={styles.statItem}><Text style={styles.statVal}>~0.4<Text style={styles.statUnit}> kg/wk</Text></Text><Text style={styles.statLabel} numberOfLines={1}>Target Pace</Text></View>
        </View>

        {/* 01 The Daily Rail — Timeline */}
        <Text style={styles.sectionLabel}>01  THE DAILY RAIL</Text>
        <View style={styles.timelineCard}>
          <Text style={styles.cardNote}>Everything cooked once, in the morning. Breakfast and lunch are both made in the 5:30–7:45am window — lunch goes into a tiffin for the office, and the protein curry is doubled so half of it comes back as dinner. Evenings only need a fresh dosa or chapati, nothing more.</Text>
          <View style={styles.timelineRail}>
            {[
              { w: 6, bg: '#7C9473', label: 'Wake' },
              { w: 16, bg: '#33512E', label: 'Cook b\'fast\n+lunch' },
              { w: 5, bg: tc.amber, label: 'B\'fast' },
              { w: 23, bg: tc.surfaceRaised, label: 'Office', fg: tc.textSecondary },
              { w: 3, bg: tc.amber, label: 'Snk' },
              { w: 6, bg: '#A8462F', label: 'Lunch\n(tiffin)' },
              { w: 16, bg: tc.surfaceRaised, label: 'Office', fg: tc.textSecondary },
              { w: 4, bg: tc.amber, label: 'Snk\n5:30' },
              { w: 6, bg: '#7C9473', label: 'Commute' },
              { w: 8, bg: '#A8462F', label: 'Reheat\n+dosa' },
              { w: 4, bg: '#233B20', label: 'Wind' },
            ].map((seg, i) => (
              <View key={i} style={[styles.railSeg, { flex: seg.w, backgroundColor: seg.bg }]}>
                <Text style={[styles.railSegText, seg.fg ? { color: seg.fg } : null]}>{seg.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.railLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#33512E' }]} /><Text style={styles.legendText}>One cooking block — b'fast + lunch</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tc.amber }]} /><Text style={styles.legendText}>Snack (seeds & nuts fuel)</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#A8462F' }]} /><Text style={styles.legendText}>Main meal</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tc.surfaceRaised }]} /><Text style={styles.legendText}>Office block</Text></View>
          </View>
        </View>

        {/* 02 Daily Targets */}
        <Text style={styles.sectionLabel}>02  DAILY TARGETS</Text>
        <View style={styles.macroGrid}>
          <View style={styles.macroItem}><Text style={styles.macroLabel}>Calories</Text><Text style={styles.macroNum}>2,650</Text><Text style={styles.macroUnit}>kcal/day (range 2,600–2,800)</Text></View>
          <View style={styles.macroItem}><Text style={styles.macroLabel}>Protein</Text><Text style={styles.macroNum}>130</Text><Text style={styles.macroUnit}>g/day (~2.4g/kg)</Text></View>
          <View style={styles.macroItem}><Text style={styles.macroLabel}>Carbs</Text><Text style={styles.macroNum}>340</Text><Text style={styles.macroUnit}>g/day</Text></View>
          <View style={styles.macroItem}><Text style={styles.macroLabel}>Fats</Text><Text style={styles.macroNum}>85</Text><Text style={styles.macroUnit}>g/day</Text></View>
          <View style={styles.macroItem}><Text style={styles.macroLabel}>Water</Text><Text style={styles.macroNum}>2.5–3</Text><Text style={styles.macroUnit}>litres/day</Text></View>
        </View>

        {/* 03 Daily Fixed Dose */}
        <Text style={styles.sectionLabel}>03  THE DAILY FIXED DOSE</Text>
        <Text style={styles.cardNote}>Non-negotiables that run every day, veg or non-veg, layered into whatever meal is convenient.</Text>
        {[
          { icon: 'nutrition-outline', title: 'Pumpkin + sesame seeds', detail: '1 tbsp pumpkin + 1 tbsp sesame, lightly roasted', desc: 'Zinc and copper for hair pigment and shedding, plus zinc/magnesium for testosterone support. Split across breakfast topping and evening snack rather than dumping both in one sitting.' },
          { icon: 'leaf-outline', title: '1 fruit, bought in batches', detail: 'Buy one at a time — banana, avocado or pineapple — and eat it 2–3 days straight before switching. Orange when it\'s around.', desc: 'No need for a fresh variety daily. Banana for dense easy calories, avocado for skin-feeding healthy fats (counts as your fat serving that day — go lighter on ghee), pineapple for digestion and vitamin C, orange for extra vitamin C whenever you find it.' },
          { icon: 'flame-outline', title: 'Fats: ghee, groundnut oil, butter, cheese', detail: '1–2 tsp ghee on dal/rice · groundnut oil for cooking · butter on chapati/toast · cheese cubes 2×/week', desc: 'Dense calories without added bulk. Butter and cheese are folded into this same fat budget, not stacked on top — think of ghee/butter/cheese as one shared allowance you\'re spreading across the day rather than four separate extras.' },
          { icon: 'fitness-outline', title: 'Plant protein (Comix)', detail: '1 scoop (~24g protein) blended into 1 shake/day', desc: 'Closes the protein gap without needing another cooked meal — blend with banana, peanut butter and water, carry in a shaker for your mid-morning slot.' },
          { icon: 'water-outline', title: 'Dates + chia + sabja (basil seeds)', detail: '2–3 dates · 1 tbsp chia + 1 tsp sabja, soaked 15–20 min in water', desc: 'Slotted in as your mid-morning snack on 2–3 days a week (Mon & Fri as written, or blended into the smoothie on Tue/Sat) in place of the roasted nuts snack that day — not added on top of it, so the day\'s totals stay level. Good fibre, plant omega-3, and a steady energy lift without refined sugar.' },
          { icon: 'heart-outline', title: 'For the skin — layered into meals above', detail: 'Vitamin C (pineapple, orange) · healthy fats (avocado, seeds, groundnut oil) · zinc (pumpkin seeds) · beta-carotene (carrot, beetroot, spinach) · collagen-building protein (egg, chicken, fish, paneer)', desc: 'Skin tone responds to the same things as hair and testosterone here — consistent protein, healthy fats, vitamin C and hydration, not any single "miracle" food. You\'re already covering all of it through the plan; the main lever left is your 2.5–3L water and enough sleep to actually recover.', wide: true },
        ].map((item, i) => (
          <View key={i} style={[styles.doseCard, item.wide && styles.doseCardWide]}>
            <View style={styles.doseHeader}>
              <Ionicons name={item.icon as any} size={16} color={tc.action} />
              <Text style={styles.doseTitle}>{item.title}</Text>
            </View>
            <Text style={styles.doseAmt}>{item.detail}</Text>
            <Text style={styles.doseDesc}>{item.desc}</Text>
          </View>
        ))}

        {/* 04 7-Day Rotation */}
        <Text style={styles.sectionLabel}>04  7-DAY ROTATION</Text>
        <Text style={styles.cardNote}>Breakfast and lunch are cooked together in the morning. For chicken/fish days, marinate one bigger batch at once — airfry half for the lunch tiffin, and airfry the rest fresh in the evening for dinner, since you\'re fine airfrying at night. For the two veg days, the dal/curry is made as a double batch in the morning and simply reheated at dinner. Either way, evenings only need 10–15 minutes: a fresh dosa or chapati plus whichever protein is on deck. Chicken is used through the week since it\'s available daily; fish/prawns only show up on Saturday, on alternate weekends — swap in chicken on the off weeks. Wed & Thu are vegetarian, dal is mandatory once (Wed, as a leafy-green pappu), and Greek yoghurt is the only dairy used — no curd or buttermilk anywhere. Sat & Sun dinners can be cooked fresh in the evening too, since you have more time on weekends.</Text>
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

        {/* 05 Weekly Grocery List */}
        <Text style={styles.sectionLabel}>05  WEEKLY GROCERY LIST</Text>
        <Text style={styles.cardNote}>One shop covers the week — chicken fresh from the local store any day, fish/prawns only on seafood weekends, everything else via quick-commerce.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groceryScroll}>
          {GROCERY.map((col, i) => (
            <View key={i} style={styles.groceryCol}>
              <Text style={styles.groceryTitle}>{col.title}</Text>
              {col.items.map((item, j) => (
                <View key={j} style={styles.groceryItem}>
                  <View style={styles.groceryBullet} />
                  <Text style={styles.groceryText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        {/* 06 Notes */}
        <Text style={styles.sectionLabel}>06  READ BEFORE YOU START</Text>
        {NOTES.map((note, i) => (
          <View key={i} style={[styles.noteCard, note.important && styles.noteCardImportant]}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            <Text style={styles.noteText}>{note.text}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.canvas, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: ts.gutter, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: tc.textPrimary, letterSpacing: -0.3 },
  appBarSubtitle: { fontSize: 10, color: tc.textSecondary, marginTop: 1, fontStyle: 'italic' },
  iconBtn: { padding: 8, borderRadius: tr.full },
  scroll: { padding: ts.gutter, gap: 16, paddingBottom: 48 },

  // Stats
  statsCard: { flexDirection: 'row', flexWrap: 'wrap', ...card, padding: 12, gap: 0 },
  statItem: { width: '33.33%', alignItems: 'center', paddingVertical: 10 },
  statValContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statVal: { fontSize: 20, fontWeight: '700', color: tc.textPrimary },
  statUnit: { fontSize: 11, fontWeight: '500', color: tc.textSecondary },
  statLabel: { fontSize: 9, color: tc.textSecondary, fontWeight: '600', marginTop: 2 },
  statSmallLabel: { fontSize: 8, color: tc.attention, fontWeight: '500', marginTop: 1 },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '700', color: tc.textSecondary, letterSpacing: 0.8, marginTop: 4 },
  cardNote: { fontSize: 12, color: tc.textSecondary, lineHeight: 18, paddingBottom: 6 },

  // Timeline
  timelineCard: { ...card, padding: 16, gap: 12 },
  timelineRail: { flexDirection: 'row', height: 56, borderRadius: tr.DEFAULT, overflow: 'hidden' },
  railSeg: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  railSegText: { fontSize: 8, fontWeight: '600', color: '#FAF7EF', textAlign: 'center', lineHeight: 10 },
  railLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc.border, borderStyle: 'dashed' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 11, color: tc.textSecondary },

  // Macro Grid
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: tr.DEFAULT, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: tc.border },
  macroItem: { width: '50%', backgroundColor: tc.surface, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border },
  macroLabel: { fontSize: 9, fontWeight: '700', color: tc.textSecondary, letterSpacing: 0.5, marginBottom: 4 },
  macroNum: { fontSize: 26, fontWeight: '700', color: tc.textPrimary },
  macroUnit: { fontSize: 10, color: tc.textSecondary, marginTop: 2 },

  // Dose
  doseCard: { ...card, padding: 14, gap: 6 },
  doseCardWide: { borderColor: tc.borderFocus },
  doseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTitle: { fontSize: 14, fontWeight: '700', color: tc.textPrimary },
  doseAmt: { fontSize: 11, fontWeight: '500', color: tc.amber, marginTop: 4 },
  doseDesc: { fontSize: 12, color: tc.textSecondary, lineHeight: 18 },

  // Day cards
  dayCard: { borderRadius: tr.DEFAULT, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: tc.border },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#233B20' },
  dayHeadVeg: { backgroundColor: '#7C9473' },
  dayName: { fontSize: 15, fontWeight: '700', color: '#FAF7EF' },
  dayTag: { fontSize: 9, fontWeight: '600', color: '#FAF7EF', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: tr.full, letterSpacing: 0.3 },
  dayTagVeg: { color: '#233B20', backgroundColor: 'rgba(35,59,32,0.1)' },
  mealRow: { flexDirection: 'row', backgroundColor: tc.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tc.border },
  mealTime: { width: 78, padding: 10, fontSize: 9, color: tc.textMuted, fontWeight: '600', paddingTop: 11 },
  mealContent: { flex: 1, padding: 10, paddingLeft: 0 },
  mealLabel: { fontSize: 11, fontWeight: '600', color: tc.action },
  mealDetail: { fontSize: 12, color: tc.textSecondary, lineHeight: 17 },

  // Grocery
  groceryScroll: { gap: 14, paddingVertical: 2 },
  groceryCol: { width: 190 },
  groceryTitle: { fontSize: 10, fontWeight: '700', color: tc.amber, letterSpacing: 0.6, marginBottom: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border },
  groceryItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border },
  groceryBullet: { width: 7, height: 7, borderWidth: 1.5, borderColor: '#33512E', borderRadius: 2 },
  groceryText: { fontSize: 12, color: tc.textSecondary },

  // Notes
  noteCard: { ...card, padding: 14, gap: 4, borderLeftWidth: 3, borderLeftColor: '#7C9473' },
  noteCardImportant: { borderLeftColor: '#A8462F' },
  noteTitle: { fontSize: 13, fontWeight: '700', color: tc.textPrimary },
  noteText: { fontSize: 12, color: tc.textSecondary, lineHeight: 18 },
});
