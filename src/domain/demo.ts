import { fromISODate, toISODate } from './dates';
import type { ISODate, Money, TransactionInput } from './types';

/** Deterministic PRNG so the same seed always produces the same sample data. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoRefs {
  accounts: { cash: number; bank: number; wallet: number };
  /** Category ids looked up by the default Vietnamese names. */
  expense: Record<'food' | 'housing' | 'transport' | 'shopping' | 'entertainment' | 'health' | 'education' | 'bills' | 'travel' | 'family' | 'other', number>;
  income: Record<'salary' | 'freelance' | 'bonus' | 'gift', number>;
}

/** Default category names used to resolve {@link DemoRefs}. */
export const DEMO_CATEGORY_NAMES = {
  expense: {
    food: 'Ăn uống',
    housing: 'Nhà ở',
    transport: 'Di chuyển',
    shopping: 'Mua sắm',
    entertainment: 'Giải trí',
    health: 'Sức khỏe',
    education: 'Giáo dục',
    bills: 'Hóa đơn',
    travel: 'Du lịch',
    family: 'Gia đình',
    other: 'Khác',
  },
  income: { salary: 'Lương', freelance: 'Freelance', bonus: 'Thưởng', gift: 'Quà tặng' },
} as const;

/** Monthly budgets created together with the sample data. */
export const DEMO_BUDGETS: { key: keyof DemoRefs['expense']; amount: Money }[] = [
  { key: 'food', amount: 4_000_000 },
  { key: 'transport', amount: 1_200_000 },
  { key: 'shopping', amount: 2_000_000 },
  { key: 'entertainment', amount: 1_000_000 },
  { key: 'bills', amount: 1_500_000 },
];

const FOOD_NOTES = ['Ăn sáng', 'Ăn trưa', 'Ăn tối', 'Cà phê', 'Trà sữa', 'Bún bò', 'Phở', 'Cơm tấm', 'Bánh mì'];
const TRANSPORT_NOTES = ['Grab', 'Xăng xe', 'Gửi xe', 'Be', 'Taxi'];
const SHOPPING_NOTES = ['Siêu thị', 'Shopee', 'Quần áo', 'Đồ gia dụng', 'Lazada'];
const FUN_NOTES = ['Xem phim', 'Karaoke', 'Netflix', 'Cà phê bạn bè', 'Game'];

/**
 * Generates a realistic year of transactions for a salaried person in Vietnam:
 * salary on the 5th, rent and bills monthly, meals most days, weekly top-ups to the e-wallet,
 * occasional shopping, travel, bonuses and freelance income. All amounts are whole thousands.
 */
export function generateDemoYear(refs: DemoRefs, end: ISODate, days = 365, seed = 2026): TransactionInput[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];
  const between = (min: number, max: number) => Math.round((min + rnd() * (max - min)) / 1000) * 1000;
  const chance = (p: number) => rnd() < p;

  const { accounts: a, expense: e, income: i } = refs;
  const out: TransactionInput[] = [];
  const add = (t: TransactionInput) => out.push(t);

  const endDate = fromISODate(end);
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(endDate);
    day.setDate(endDate.getDate() - d);
    const date = toISODate(day);
    const dom = day.getDate();
    const dow = day.getDay(); // 0 = Sunday
    const weekend = dow === 0 || dow === 6;

    // ----- Monthly -----
    if (dom === 5) {
      add({ type: 'income', amount: 18_000_000, accountId: a.bank, categoryId: i.salary, note: `Lương tháng ${day.getMonth() + 1}`, date });
    }
    if (dom === 1) add({ type: 'expense', amount: 4_500_000, accountId: a.bank, categoryId: e.housing, note: 'Tiền nhà', date });
    if (dom === 10) add({ type: 'expense', amount: between(400_000, 1_100_000), accountId: a.wallet, categoryId: e.bills, note: 'Tiền điện', date });
    if (dom === 12) add({ type: 'expense', amount: 250_000, accountId: a.wallet, categoryId: e.bills, note: 'Internet', date });
    if (dom === 15) add({ type: 'expense', amount: between(100_000, 200_000), accountId: a.wallet, categoryId: e.bills, note: 'Tiền nước', date });
    if (dom === 20) add({ type: 'expense', amount: 260_000, accountId: a.bank, categoryId: e.entertainment, note: 'Netflix + Spotify', date });
    if (dom === 7 || dom === 22) add({ type: 'transfer', amount: 2_000_000, fromAccountId: a.bank, toAccountId: a.cash, note: 'Rút tiền mặt', date });
    if (dom === 25 && chance(0.6)) add({ type: 'expense', amount: between(1_000_000, 3_000_000), accountId: a.bank, categoryId: e.family, note: 'Gửi bố mẹ', date });
    if (dom === 18 && chance(0.35)) add({ type: 'income', amount: between(2_000_000, 8_000_000), accountId: a.bank, categoryId: i.freelance, note: 'Dự án freelance', date });

    // ----- Weekly -----
    if (dow === 1) add({ type: 'transfer', amount: between(900_000, 1_200_000), fromAccountId: a.bank, toAccountId: a.wallet, note: 'Nạp Momo', date });
    if (dow === 0 && chance(0.7)) add({ type: 'expense', amount: between(250_000, 700_000), accountId: a.bank, categoryId: e.shopping, note: 'Siêu thị', date });

    // ----- Daily -----
    const meals = weekend ? 2 : 3;
    for (let m = 0; m < meals; m++) {
      if (chance(0.85)) add({ type: 'expense', amount: between(25_000, weekend ? 150_000 : 70_000), accountId: pick([a.cash, a.wallet]), categoryId: e.food, note: pick(FOOD_NOTES), date });
    }
    if (!weekend && chance(0.6)) add({ type: 'expense', amount: between(20_000, 90_000), accountId: a.wallet, categoryId: e.transport, note: pick(TRANSPORT_NOTES), date });
    if (dow === 3) add({ type: 'expense', amount: between(60_000, 80_000), accountId: a.cash, categoryId: e.transport, note: 'Xăng xe', date });
    if (chance(0.05)) add({ type: 'expense', amount: between(150_000, 900_000), accountId: a.bank, categoryId: e.shopping, note: pick(SHOPPING_NOTES), date });
    if (weekend && chance(0.35)) add({ type: 'expense', amount: between(100_000, 500_000), accountId: pick([a.cash, a.wallet]), categoryId: e.entertainment, note: pick(FUN_NOTES), date });
    if (chance(0.025)) add({ type: 'expense', amount: between(80_000, 900_000), accountId: a.cash, categoryId: e.health, note: 'Thuốc / khám bệnh', date });
    if (chance(0.01)) add({ type: 'income', amount: between(200_000, 1_000_000), accountId: a.cash, categoryId: i.gift, note: 'Lì xì / quà', date });
    if (chance(0.02)) add({ type: 'expense', amount: between(50_000, 300_000), accountId: a.cash, categoryId: e.other, date });
  }

  // ----- A few one-off events spread through the year -----
  const dayOffset = (n: number) => {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - n);
    return toISODate(d);
  };
  add({ type: 'income', amount: 18_000_000, accountId: a.bank, categoryId: i.bonus, note: 'Thưởng Tết', date: dayOffset(Math.min(days - 1, 250)) });
  add({ type: 'expense', amount: 7_500_000, accountId: a.bank, categoryId: e.travel, note: 'Du lịch Đà Nẵng', date: dayOffset(Math.min(days - 1, 120)) });
  add({ type: 'expense', amount: 3_200_000, accountId: a.bank, categoryId: e.education, note: 'Khoá học tiếng Anh', date: dayOffset(Math.min(days - 1, 200)) });
  add({ type: 'expense', amount: 2_400_000, accountId: a.bank, categoryId: e.shopping, note: 'Tai nghe mới', date: dayOffset(Math.min(days - 1, 40)) });

  return out;
}
