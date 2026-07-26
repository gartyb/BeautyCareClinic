import { Note } from '../types/Note';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const notes: Note[] = [
  // cust-1 notes
  {
    id: 'note-1',
    customerId: 'cust-1',
    treatmentTypeId: 'tt-1',
    text: 'לקוחה עם עור יבש ורגיש. יש להשתמש במוצרים ללא בישום. מגיבה טוב לסרום הידרציה.',
    authorUserId: 'user-therapist-1',
    createdDate: '2025-10-10',
  },
  {
    id: 'note-2',
    customerId: 'cust-1',
    text: 'לקוחה מעוניינת לשמוע על חבילת לייזר לגוף בביקור הבא. יש לתאם פגישת ייעוץ.',
    authorUserId: 'user-manager-1',
    createdDate: '2025-11-20',
  },

  // cust-2 notes
  {
    id: 'note-3',
    customerId: 'cust-2',
    treatmentTypeId: 'tt-3',
    text: 'כאבי גב כרוניים באזור המותן. להמנע מלחץ עמוק באזור זה. לעבוד עם שמן לבנדר.',
    authorUserId: 'user-therapist-1',
    createdDate: '2025-09-10',
  },
  {
    id: 'note-4',
    customerId: 'cust-2',
    text: 'לקוחה ביקשה לשנות מועד הטיפולים לימי שלישי אחר הצהריים.',
    authorUserId: 'user-manager-1',
    createdDate: '2025-10-20',
  },

  // cust-3 notes
  {
    id: 'note-5',
    customerId: 'cust-3',
    treatmentTypeId: 'tt-2',
    text: 'עור בהיר מאוד, יש לכוון את עוצמת הלייזר בהתאם. מסכים לפרוטוקול מוגבר.',
    authorUserId: 'user-therapist-1',
    createdDate: '2024-01-20',
  },
  {
    id: 'note-6',
    customerId: 'cust-3',
    text: 'לקוחה VIP. מגיעה תמיד בזמן, מאוד מרוצה מהטיפולים. שקלה להפנות חברות.',
    authorUserId: 'user-manager-1',
    createdDate: '2024-08-15',
  },

  // cust-4 notes
  {
    id: 'note-7',
    customerId: 'cust-4',
    text: 'לקוחה חדשה, הגיעה בהמלצת אסתר מזרחי. מעוניינת בטיפול פנים בסיסי תחילה.',
    authorUserId: 'user-manager-1',
    createdDate: '2025-11-01',
  },

  // cust-5 notes
  {
    id: 'note-8',
    customerId: 'cust-5',
    treatmentTypeId: 'tt-3',
    text: 'מעדיפה עיסוי בלחץ בינוני. מוזיקה שקטה ברקע. אלרגית לאגוזים — לא להשתמש בשמן אגוזים.',
    authorUserId: 'user-therapist-1',
    createdDate: '2025-07-15',
  },
  {
    id: 'note-9',
    customerId: 'cust-5',
    text: 'לקוחה קנתה עוד חבילה לאחר שהסתיימה הסדרה הקודמת. שקלה גם חבילת לייזר לגוף.',
    authorUserId: 'user-manager-1',
    createdDate: '2025-08-01',
  },
];
