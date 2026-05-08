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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          content: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          budget: string | null
          business_name: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          service: string | null
          status: string
        }
        Insert: {
          budget?: string | null
          business_name?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          service?: string | null
          status?: string
        }
        Update: {
          budget?: string | null
          business_name?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          service?: string | null
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          gumroad_url: string | null
          id: string
          price: number | null
          published: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          gumroad_url?: string | null
          id?: string
          price?: number | null
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          gumroad_url?: string | null
          id?: string
          price?: number | null
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          category: string | null
          client: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          external_url: string | null
          featured: boolean
          gallery: Json | null
          id: string
          project_date: string | null
          published: boolean
          results: string | null
          services: string[] | null
          slug: string
          sort_order: number
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          client?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          project_date?: string | null
          published?: boolean
          results?: string | null
          services?: string[] | null
          slug: string
          sort_order?: number
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          client?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          project_date?: string | null
          published?: boolean
          results?: string | null
          services?: string[] | null
          slug?: string
          sort_order?: number
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string
          featured: boolean
          id: string
          name: string
          photo_url: string | null
          position: string
          published: boolean
          socials: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          name: string
          photo_url?: string | null
          position: string
          published?: boolean
          socials?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          name?: string
          photo_url?: string | null
          position?: string
          published?: boolean
          socials?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          client_name: string
          company: string | null
          created_at: string
          id: string
          photo_url: string | null
          published: boolean
          rating: number
          review: string
          sort_order: number
        }
        Insert: {
          client_name: string
          company?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          published?: boolean
          rating?: number
          review: string
          sort_order?: number
        }
        Update: {
          client_name?: string
          company?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          published?: boolean
          rating?: number
          review?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
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
      app_role: ["admin", "editor", "user"],
    },
  },
} as const
