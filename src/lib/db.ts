import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── テーブル型定義 ────────────────────────────────────────
type CustomerRow = {
  id:           number;
  name:         string;
  display_name: string | null;
  contact:      string | null;
  category:     string;
  status:       string;
  tags:         string;
  crisis_level: number;
  temperature:  string;
  created_at:   string;
  updated_at:   string;
  next_action:  string | null;
  total_amount: number;
  notes:        string | null;
  line_user_id: string | null;
};

type MessageRow = {
  id:          number;
  customer_id: number;
  source:      string;
  direction:   string;
  text:        string;
  raw_type:    string | null;
  created_at:  string;
};

type AppraisalRow = {
  id:           number;
  customer_id:  number;
  type:         string;
  status:       string;
  price:        number;
  paid:         number;
  notes:        string | null;
  created_at:   string;
  delivered_at: string | null;
};

type AbResultRow = {
  id:            number;
  winner:        string;  // "A" | "B"
  decided_at:    string;
  click_count_a: number;
  click_count_b: number;
  cvr_a:         number;
  cvr_b:         number;
  is_current:    boolean;
};

export type Database = {
  public: {
    Tables: {
      customers: {
        Row:    CustomerRow;
        Insert: Partial<CustomerRow> & Pick<CustomerRow, "name">;
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      messages: {
        Row:    MessageRow;
        Insert: Partial<MessageRow> & Pick<MessageRow, "customer_id" | "source" | "direction" | "text">;
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      appraisals: {
        Row:    AppraisalRow;
        Insert: Partial<AppraisalRow> & Pick<AppraisalRow, "customer_id" | "type">;
        Update: Partial<AppraisalRow>;
        Relationships: [
          {
            foreignKeyName: "appraisals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      ab_results: {
        Row:    AbResultRow;
        Insert: Omit<AbResultRow, "id" | "decided_at">;
        Update: Partial<AbResultRow>;
        Relationships: [];
      };
    };
    Views:          { [_ in never]?: never };
    Functions:      { [_ in never]?: never };
    Enums:          { [_ in never]?: never };
    CompositeTypes: { [_ in never]?: never };
  };
};

// ─── シングルトン（遅延初期化）────────────────────────────
const g = globalThis as unknown as { _supabase?: SupabaseClient<Database> };

function getSupabase(): SupabaseClient<Database> {
  if (!g._supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url) throw new Error("SUPABASE_URL が設定されていません");
    if (!key) throw new Error("SUPABASE_ANON_KEY が設定されていません");
    g._supabase = createClient<Database>(url, key);
  }
  return g._supabase;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
