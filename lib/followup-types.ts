/** Tipos compartilhados entre o serviço de follow-up e a tela "Hoje" (007). */

export type TodayTask = {
  id: string;
  title: string;
  type: "WHATSAPP" | "CALL" | "MEETING" | "OTHER";
  dueAt: string;
  dueTimeLabel: string;
  overdueDays: number;
  dealId: string;
  dealTitle: string;
  dealValue: number | null;
  stageName: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  ownerId: string;
  ownerName: string;
};

export type TodayCounts = {
  overdue: number;
  today: number;
  completedToday: number;
};

export type TodayData = {
  todayKey: string;
  todayLabel: string;
  timezone: string;
  overdue: TodayTask[];
  today: TodayTask[];
  counts: TodayCounts;
  sellers: Array<{ id: string; name: string }>;
  ownerFilter: string | null;
  lostReasons: Array<{ id: string; name: string }>;
};
