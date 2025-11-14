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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          arrears_balance: number | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          in_charge_name: string
          phone: string
          price_per_kg: number
          shop_name: string
          status: string | null
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          address?: string | null
          arrears_balance?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          in_charge_name: string
          phone: string
          price_per_kg: number
          shop_name: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          address?: string | null
          arrears_balance?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          in_charge_name?: string
          phone?: string
          price_per_kg?: number
          shop_name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      cylinder_capacities: {
        Row: {
          capacity_kg: number
          id: string
        }
        Insert: {
          capacity_kg: number
          id?: string
        }
        Update: {
          capacity_kg?: number
          id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string | null
          customer_id: string
          delivery_date: string | null
          id: string
          logged_by_user_id: string
          manual_adjustment: number | null
          notes: string | null
          price_per_kg_at_time: number
          total_charge: number
          total_kg: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          delivery_date?: string | null
          id?: string
          logged_by_user_id: string
          manual_adjustment?: number | null
          notes?: string | null
          price_per_kg_at_time: number
          total_charge: number
          total_kg: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          delivery_date?: string | null
          id?: string
          logged_by_user_id?: string
          manual_adjustment?: number | null
          notes?: string | null
          price_per_kg_at_time?: number
          total_charge?: number
          total_kg?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          cylinder_capacity_id: string
          delivery_id: string
          id: string
          kg_contribution: number
          quantity: number
        }
        Insert: {
          cylinder_capacity_id: string
          delivery_id: string
          id?: string
          kg_contribution: number
          quantity: number
        }
        Update: {
          cylinder_capacity_id?: string
          delivery_id?: string
          id?: string
          kg_contribution?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_cylinder_capacity_id_fkey"
            columns: ["cylinder_capacity_id"]
            isOneToOne: false
            referencedRelation: "cylinder_capacities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          message: string
          sent_at: string | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          message: string
          sent_at?: string | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          message?: string
          sent_at?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          created_at: string | null
          customer_id: string
          delivery_id: string | null
          handled_by: string | null
          id: string
          method: string
          paid_at: string | null
          reference: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          customer_id: string
          delivery_id?: string | null
          handled_by?: string | null
          id?: string
          method: string
          paid_at?: string | null
          reference?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          customer_id?: string
          delivery_id?: string | null
          handled_by?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          profile_pic_url: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          profile_pic_url?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_pic_url?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string | null
          customer_id: string
          delivery_id: string | null
          file_url: string | null
          filename: string
          id: string
          payment_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          delivery_id?: string | null
          file_url?: string | null
          filename: string
          id?: string
          payment_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          delivery_id?: string | null
          file_url?: string | null
          filename?: string
          id?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
