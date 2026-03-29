export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      Check_Kontragent: {
        Row: {
          id: string
          Р”Р°С‚Р°: string | null
          Р“СЂСѓРїРїР°: string | null
          Р”РІРёР¶РµРЅРёРµ: string | null
          РќР°С‡РёСЃР»РµРЅРѕ: string | null
          РћРїР»Р°С‡РµРЅРѕ: string | null
          РџРµСЂРёРѕРґ: string | null
          РџСЃРµРІРґРѕ: string | null
          Р РµСЃС‚РѕСЂР°РЅ: string | null
        }
        Insert: {
          id?: string
          Р”Р°С‚Р°?: string | null
          Р“СЂСѓРїРїР°?: string | null
          Р”РІРёР¶РµРЅРёРµ?: string | null
          РќР°С‡РёСЃР»РµРЅРѕ?: string | null
          РћРїР»Р°С‡РµРЅРѕ?: string | null
          РџРµСЂРёРѕРґ?: string | null
          РџСЃРµРІРґРѕ?: string | null
          Р РµСЃС‚РѕСЂР°РЅ?: string | null
        }
        Update: {
          id?: string
          Р”Р°С‚Р°?: string | null
          Р“СЂСѓРїРїР°?: string | null
          Р”РІРёР¶РµРЅРёРµ?: string | null
          РќР°С‡РёСЃР»РµРЅРѕ?: string | null
          РћРїР»Р°С‡РµРЅРѕ?: string | null
          РџРµСЂРёРѕРґ?: string | null
          РџСЃРµРІРґРѕ?: string | null
          Р РµСЃС‚РѕСЂР°РЅ?: string | null
        }
        Relationships: []
      }
      balance_fact: {
        Row: {
          id: string
          БалансТип: string | null
          Период: string | null
          Ресторан: string | null
          СтатьяKey: string | null
          Сумма: string | null
        }
        Insert: {
          id?: string
          БалансТип?: string | null
          Период?: string | null
          Ресторан?: string | null
          СтатьяKey?: string | null
          Сумма?: string | null
        }
        Update: {
          id?: string
          БалансТип?: string | null
          Период?: string | null
          Ресторан?: string | null
          СтатьяKey?: string | null
          Сумма?: string | null
        }
        Relationships: []
      }
      bar_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          entry_date: string
          entry_type: string
          id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          entry_date?: string
          entry_type: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
        }
        Relationships: []
      }
      bar_transactions: {
        Row: {
          created_at: string | null
          id: string
          restaurant_id: string | null
          Бармен: string | null
          Дата: string | null
          Категория: string | null
          Сумма: number | null
          Тип: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          Бармен?: string | null
          Дата?: string | null
          Категория?: string | null
          Сумма?: number | null
          Тип?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          Бармен?: string | null
          Дата?: string | null
          Категория?: string | null
          Сумма?: number | null
          Тип?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_flows: {
        Row: {
          id: string
          IsOpExp: string | null
          БалансТип: string | null
          Период: string | null
          "Период (Год)": string | null
          "Период (Индекс месяца)": string | null
          "Период (Квартал)": string | null
          "Период (Месяц)": string | null
          Поток: string | null
          Ресторан: string | null
          СтатьяKey: string | null
          Сумма: string | null
          ФинТип: string | null
        }
        Insert: {
          id?: string
          IsOpExp?: string | null
          БалансТип?: string | null
          Период?: string | null
          "Период (Год)"?: string | null
          "Период (Индекс месяца)"?: string | null
          "Период (Квартал)"?: string | null
          "Период (Месяц)"?: string | null
          Поток?: string | null
          Ресторан?: string | null
          СтатьяKey?: string | null
          Сумма?: string | null
          ФинТип?: string | null
        }
        Update: {
          id?: string
          IsOpExp?: string | null
          БалансТип?: string | null
          Период?: string | null
          "Период (Год)"?: string | null
          "Период (Индекс месяца)"?: string | null
          "Период (Квартал)"?: string | null
          "Период (Месяц)"?: string | null
          Поток?: string | null
          Ресторан?: string | null
          СтатьяKey?: string | null
          Сумма?: string | null
          ФинТип?: string | null
        }
        Relationships: []
      }
      owners_fact: {
        Row: {
          id: string
          Группа: string | null
          Движение: string | null
          Начислено: string | null
          Оплачено: string | null
          Период: string | null
          Псевдо: string | null
          Ресторан: string | null
        }
        Insert: {
          id?: string
          Группа?: string | null
          Движение?: string | null
          Начислено?: string | null
          Оплачено?: string | null
          Период?: string | null
          Псевдо?: string | null
          Ресторан?: string | null
        }
        Update: {
          id?: string
          Группа?: string | null
          Движение?: string | null
          Начислено?: string | null
          Оплачено?: string | null
          Период?: string | null
          Псевдо?: string | null
          Ресторан?: string | null
        }
        Relationships: []
      }
      prepayments: {
        Row: {
          created_at: string | null
          id: string
          restaurant_id: string | null
          "Дата банкета": string | null
          "Дата предоплаты": string | null
          Клиент: string | null
          "Способ оплаты": string | null
          Статус: string | null
          Сумма: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          "Дата банкета"?: string | null
          "Дата предоплаты"?: string | null
          Клиент?: string | null
          "Способ оплаты"?: string | null
          Статус?: string | null
          Сумма?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          "Дата банкета"?: string | null
          "Дата предоплаты"?: string | null
          Клиент?: string | null
          "Способ оплаты"?: string | null
          Статус?: string | null
          Сумма?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prepayments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
