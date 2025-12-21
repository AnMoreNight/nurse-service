import { Visit, Staff, ShiftAssignment, ShiftType, Company, UserAccount, CompanySettings } from './types';

// Helper for dates to ensure Local Time usage
export const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatDateForCSV = (isoDateStr: string) => {
    if (!isoDateStr) return '';
    const [y, m, d] = isoDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const w = weekLabels[dateObj.getDay()];
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} (${w})`;
};

// Calculates the effective shift type considering defaults and overrides
// Returns 'none' if it's a regular working day (implied), otherwise the specific ShiftType
export const getEffectiveShiftType = (staff: Staff, dateStr: string, shifts: ShiftAssignment[]): ShiftType | 'none' => {
    const shift = shifts.find(s => s.staffId === staff.id && s.date === dateStr);
    
    // Explicit override exists (including 'work', 'holiday', 'night1_holiday' etc.)
    if (shift) {
        return shift.type || 'none';
    }

    // Check Default Holidays
    if (staff.defaultHolidayWeekDays) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        
        if (staff.defaultHolidayWeekDays.includes(dayOfWeek)) {
            return 'holiday';
        }
    }

    // Default is working ('none')
    return 'none'; 
};

// Common logic to check if a visit occurs on a specific date (handles recurrence)
export const checkVisitVisibility = (visit: Visit, targetDate: string): boolean => {
    // 1. Check exclusions (specific dates removed from series)
    if (visit.excludeDates && visit.excludeDates.includes(targetDate)) return false;

    // 2. Check recurrence end date (if series was terminated)
    if (visit.recurrenceEndDate && targetDate > visit.recurrenceEndDate) return false;

    // 3. Simple date match for non-recurring or base date match
    if (visit.date === targetDate) return true;

    // 4. Recurrence rules check
    if (visit.recurrence === 'custom' && visit.recurrenceRule) {
        // Ensure strictly comparable dates (YYYY-MM-DD)
        if (targetDate < visit.date) return false;

        const start = new Date(visit.date);
        const current = new Date(targetDate);
        start.setHours(0,0,0,0);
        current.setHours(0,0,0,0);

        const rule = visit.recurrenceRule;
        if (rule.endType === 'date' && rule.endDate && targetDate > rule.endDate) return false;
        
        if (rule.frequency === 'daily') {
            const diffTime = Math.abs(current.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays % rule.interval === 0;
        }
        if (rule.frequency === 'weekly') {
            if (!rule.weekDays.includes(current.getDay())) return false;
            const startWeekStart = new Date(start);
            startWeekStart.setDate(start.getDate() - start.getDay());
            const currentWeekStart = new Date(current);
            currentWeekStart.setDate(current.getDate() - current.getDay());
            const weeksDiff = Math.round((currentWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
            return weeksDiff >= 0 && weeksDiff % rule.interval === 0;
        }
        if (rule.frequency === 'monthly') {
            const monthsDiff = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
            if (monthsDiff < 0 || monthsDiff % rule.interval !== 0) return false;
            if (rule.weekNos && rule.weekNos.length > 0) {
                if (!rule.weekDays.includes(current.getDay())) return false;
                const day = current.getDate();
                const nth = Math.floor((day - 1) / 7) + 1; 
                return rule.weekNos.includes(nth);
            } else {
                return current.getDate() === start.getDate();
            }
        }
        if (rule.frequency === 'yearly') {
            const yearDiff = current.getFullYear() - start.getFullYear();
            if (yearDiff < 0 || yearDiff % rule.interval !== 0) return false;
            // Check if same month and date
            return current.getMonth() === start.getMonth() && current.getDate() === start.getDate();
        }
    }
    return false;
};

const getToday = () => toLocalISOString(new Date());
const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalISOString(d);
};

// Default Settings
export const DEFAULT_SETTINGS: CompanySettings = {
    visitStatuses: [
        { key: 'REGULAR_NURSE', label: '通常訪問(看護)', color: 'blue' },
        { key: 'REGULAR_REHAB', label: '通常訪問(リハ)', color: 'emerald' },
        { key: 'EMERGENCY', label: '緊急訪問', color: 'red' },
        { key: 'OTHER', label: 'その他', color: 'orange' },
        { key: 'CANCELLED', label: 'キャンセル', color: 'gray' },
    ],
    jobTitles: ['看護師', '理学療法士(PT)', '作業療法士(OT)', '言語聴覚士(ST)', '事務']
};

// --- MOCK SAAS DATA ---
export const MOCK_COMPANIES: Company[] = [
    {
        id: 'c1',
        name: 'さくら訪問看護ステーション',
        status: 'active',
        contactPerson: '田中 太郎',
        email: 'contact@sakura-nurse.jp',
        userCount: 2, 
        createdAt: '2024-01-15',
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    },
    {
        id: 'c2',
        name: 'ひまわりケアサービス',
        status: 'active',
        contactPerson: '鈴木 花子',
        email: 'info@himawari-care.com',
        userCount: 1,
        createdAt: '2024-03-10',
        settings: {
            ...DEFAULT_SETTINGS,
            visitStatuses: [
                { key: 'REGULAR_NURSE', label: '定期巡回(看)', color: 'emerald' },
                { key: 'REGULAR_REHAB', label: '定期巡回(リ)', color: 'teal' },
                { key: 'EMERGENCY', label: '緊急対応', color: 'rose' },
                { key: 'OTHER', label: '自費サービス', color: 'purple' },
                { key: 'CANCELLED', label: '中止', color: 'slate' },
            ]
        }
    },
    {
        id: 'c3',
        name: 'メディカルサポート東京',
        status: 'active',
        contactPerson: '佐藤 健',
        email: 'admin@med-support-tokyo.co.jp',
        userCount: 1, 
        createdAt: '2023-11-20',
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    }
];

export const MOCK_DB_USERS: UserAccount[] = [
    { id: 'sys', username: 'manager', password: 'empawa', name: 'System Manager', role: 'system_admin' },
    { id: 'u1', username: 'admin', password: 'empawa', name: '田中 太郎', role: 'admin', companyId: 'c1', companyName: 'さくら訪問看護ステーション' },
    { id: 'u2', username: 'user', password: 'empawa', name: '山田 花子', role: 'user', companyId: 'c1', companyName: 'さくら訪問看護ステーション' },
    { id: 'u3', username: 'admin2', password: 'admin2', name: '鈴木 花子', role: 'admin', companyId: 'c2', companyName: 'ひまわりケアサービス' },
    { id: 'u4', username: 'admin3', password: 'admin3', name: '佐藤 健', role: 'admin', companyId: 'c3', companyName: 'メディカルサポート東京' },
];

export const MOCK_STAFF: Staff[] = [
  { id: 's1', companyId: 'c1', name: '看護師A (長谷川)', jobTitle: '看護師', color: 'blue', avatar: 'HA', joinedDate: '2020-01-01', defaultHolidayWeekDays: [0, 6] }, 
  { id: 's2', companyId: 'c1', name: '看護師B (西村)', jobTitle: '看護師', color: 'emerald', avatar: 'NI', joinedDate: '2020-01-01', defaultHolidayWeekDays: [0, 3] }, 
  { id: 's3', companyId: 'c1', name: '理学療法士C (佐藤)', jobTitle: '理学療法士(PT)', color: 'amber', avatar: 'SA', joinedDate: '2020-01-01', defaultHolidayWeekDays: [] },
];

// Base date for recurring visits (ensure it's in the past so it shows up)
const BASE_DATE = '2024-01-01'; 

export const MOCK_VISITS: Visit[] = [
  // --- Monday (1) ---
  {
    id: 'v_mon_1', companyId: 'c1', staffIds: ['s1'], patientName: '山本 太郎', address: '東京都新宿区西新宿2-8-1',
    date: BASE_DATE, startTime: '09:00', endTime: '10:00', status: 'REGULAR_NURSE', notes: 'バイタル測定',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [1], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_mon_2', companyId: 'c1', staffIds: ['s2'], patientName: '高橋 次郎', address: '東京都中野区中野4-1-1',
    date: BASE_DATE, startTime: '11:00', endTime: '12:00', status: 'REGULAR_NURSE', notes: '入浴介助',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [1], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_mon_3', companyId: 'c1', staffIds: ['s3'], patientName: '伊藤 四郎', address: '東京都渋谷区宇田川町1-1',
    date: BASE_DATE, startTime: '14:00', endTime: '15:00', status: 'REGULAR_REHAB', notes: '歩行訓練',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [1], endType: 'never', weekNos: [] }
  },

  // --- Tuesday (2) ---
  {
    id: 'v_tue_1', companyId: 'c1', staffIds: ['s3'], patientName: '渡辺 五郎', address: '東京都文京区春日1-16-21',
    date: BASE_DATE, startTime: '09:30', endTime: '10:30', status: 'REGULAR_REHAB', notes: '関節可動域訓練',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [2], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_tue_2', companyId: 'c1', staffIds: ['s1'], patientName: '中村 六郎', address: '東京都千代田区千代田1-1',
    date: BASE_DATE, startTime: '13:00', endTime: '14:30', status: 'CANCELLED', notes: '本人都合によりキャンセル',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [2], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_tue_3', companyId: 'c1', staffIds: ['s2'], patientName: '小林 七郎', address: '東京都新宿区戸山1-21-1',
    date: BASE_DATE, startTime: '15:00', endTime: '16:00', status: 'REGULAR_NURSE', notes: '服薬管理',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [2], endType: 'never', weekNos: [] }
  },

  // --- Wednesday (3) ---
  {
    id: 'v_wed_1', companyId: 'c1', staffIds: ['s1'], patientName: '加藤 八郎', address: '東京都渋谷区恵比寿4-20-3',
    date: BASE_DATE, startTime: '10:00', endTime: '11:00', status: 'REGULAR_NURSE', notes: '創傷処置',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [3], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_wed_2', companyId: 'c1', staffIds: ['s2'], patientName: '吉田 九郎', address: '東京都港区赤坂9-7-1',
    date: BASE_DATE, startTime: '14:00', endTime: '15:00', status: 'REGULAR_NURSE', notes: '状態観察',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [3], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_wed_3', companyId: 'c1', staffIds: ['s3'], patientName: '佐々木 十郎', address: '東京都新宿区大久保3-8-2',
    date: BASE_DATE, startTime: '16:00', endTime: '17:00', status: 'REGULAR_REHAB', notes: '生活動作訓練',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [3], endType: 'never', weekNos: [] }
  },

  // --- Thursday (4) ---
  {
    id: 'v_thu_1', companyId: 'c1', staffIds: ['s2'], patientName: '松本 一', address: '東京都中野区中央1-1',
    date: BASE_DATE, startTime: '09:00', endTime: '10:00', status: 'REGULAR_NURSE', notes: '清拭',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [4], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_thu_2', companyId: 'c1', staffIds: ['s1'], patientName: '井上 二', address: '東京都豊島区西池袋1-1',
    date: BASE_DATE, startTime: '11:00', endTime: '12:00', status: 'REGULAR_NURSE', notes: '点滴管理',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [4], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_thu_3', companyId: 'c1', staffIds: ['s3'], patientName: '木村 三', address: '東京都文京区本郷7-3-1',
    date: BASE_DATE, startTime: '13:30', endTime: '14:30', status: 'REGULAR_REHAB', notes: '屋外歩行',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [4], endType: 'never', weekNos: [] }
  },

  // --- Friday (5) ---
  {
    id: 'v_fri_1', companyId: 'c1', staffIds: ['s1'], patientName: '林 四', address: '東京都千代田区永田町1-7-1',
    date: BASE_DATE, startTime: '10:00', endTime: '11:00', status: 'REGULAR_NURSE', notes: '家族指導',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [5], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_fri_2', companyId: 'c1', staffIds: ['s2'], patientName: '清水 五', address: '東京都新宿区歌舞伎町1-30-1',
    date: BASE_DATE, startTime: '13:00', endTime: '14:00', status: 'EMERGENCY', notes: '発熱対応',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [5], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_fri_3', companyId: 'c1', staffIds: ['s1'], patientName: '山崎 六', address: '東京都渋谷区道玄坂1-1',
    date: BASE_DATE, startTime: '15:00', endTime: '16:00', status: 'OTHER', notes: 'カンファレンス',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [5], endType: 'never', weekNos: [] }
  },

  // --- Saturday (6) ---
  {
    id: 'v_sat_1', companyId: 'c1', staffIds: ['s3'], patientName: '池田 七', address: '東京都港区六本木6-10-1',
    date: BASE_DATE, startTime: '09:00', endTime: '10:00', status: 'REGULAR_REHAB', notes: '週末リハ',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [6], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_sat_2', companyId: 'c1', staffIds: ['s2'], patientName: '橋本 八', address: '東京都中野区東中野1-1',
    date: BASE_DATE, startTime: '11:00', endTime: '12:00', status: 'REGULAR_NURSE', notes: '状態確認',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [6], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_sat_3', companyId: 'c1', staffIds: ['s1'], patientName: '山下 九', address: '東京都新宿区百人町1-1',
    date: BASE_DATE, startTime: '14:00', endTime: '15:00', status: 'CANCELLED', notes: 'ショートステイ利用のため',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [6], endType: 'never', weekNos: [] }
  },

  // --- Sunday (0) ---
  {
    id: 'v_sun_1', companyId: 'c1', staffIds: ['s1'], patientName: '森田 十', address: '東京都新宿区神楽坂',
    date: BASE_DATE, startTime: '09:00', endTime: '10:00', status: 'REGULAR_NURSE', notes: '休日訪問',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [0], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_sun_2', companyId: 'c1', staffIds: ['s3'], patientName: '吉川 十一', address: '東京都渋谷区神宮前1-1',
    date: BASE_DATE, startTime: '13:00', endTime: '14:00', status: 'REGULAR_REHAB', notes: '拘縮予防',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [0], endType: 'never', weekNos: [] }
  },
  {
    id: 'v_sun_3', companyId: 'c1', staffIds: ['s2'], patientName: '西田 十二', address: '東京都豊島区目白1-1',
    date: BASE_DATE, startTime: '16:00', endTime: '17:00', status: 'EMERGENCY', notes: '転倒連絡あり',
    recurrence: 'custom', recurrenceRule: { frequency: 'weekly', interval: 1, weekDays: [0], endType: 'never', weekNos: [] }
  },
];

export const MOCK_SHIFTS: ShiftAssignment[] = [
    { id: 'sh1', companyId: 'c1', staffId: 's1', date: getToday(), type: 'night1' },
    { id: 'sh2', companyId: 'c1', staffId: 's2', date: getToday(), type: 'night2' },
    { id: 'sh3', companyId: 'c1', staffId: 's2', date: getTomorrow(), type: 'night1' },
    { id: 'sh4', companyId: 'c1', staffId: 's1', date: getTomorrow(), type: 'night2' },
];
