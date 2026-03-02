export interface CardTransaction {
  id?: number;
  card_company: string;
  amount: number;
  merchant: string;
  transaction_date: string;
  description: string;
  category: string | null;
  email_subject?: string;
  email_from?: string;
  gmail_message_id?: string;
  is_verified?: boolean;
  created_at?: string;
  memo?: string;
  tags?: string[];  // FlexTag: ["外食", "接待", "経費"]
}

export interface ParsedTransaction {
  amount: number;
  transaction_date: string; // ISO 8601: "YYYY-MM-DDTHH:MM:SS.sss..."
  merchant: string;
  card_company: string;
  raw_text: string;
}

export interface MonthlyAggregation {
  month: string;
  total: number;
  count: number;
  average: number;
  by_category: Record<string, number>;
  by_card: Record<string, number>;
}
