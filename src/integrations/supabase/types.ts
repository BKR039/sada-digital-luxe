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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          category: string | null
          category_ar: string | null
          content: string | null
          content_ar: string | null
          cover_alt: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          excerpt_ar: string | null
          featured: boolean
          id: string
          og_image_url: string | null
          published: boolean
          published_at: string | null
          reading_minutes: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[]
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          category_ar?: string | null
          content?: string | null
          content_ar?: string | null
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_ar?: string | null
          featured?: boolean
          id?: string
          og_image_url?: string | null
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[]
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          category_ar?: string | null
          content?: string | null
          content_ar?: string | null
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_ar?: string | null
          featured?: boolean
          id?: string
          og_image_url?: string | null
          published?: boolean
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[]
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_communication_logs: {
        Row: {
          client_id: string | null
          contact_method: string
          created_at: string
          id: string
          next_action: string | null
          next_followup_date: string | null
          project_id: string
          summary: string
          team_member_id: string | null
        }
        Insert: {
          client_id?: string | null
          contact_method: string
          created_at?: string
          id?: string
          next_action?: string | null
          next_followup_date?: string | null
          project_id: string
          summary: string
          team_member_id?: string | null
        }
        Update: {
          client_id?: string | null
          contact_method?: string
          created_at?: string
          id?: string
          next_action?: string | null
          next_followup_date?: string | null
          project_id?: string
          summary?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communication_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communication_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communication_logs_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_deliverables: {
        Row: {
          assigned_team_ids: string[] | null
          client_id: string
          created_at: string
          deadline: string | null
          deliverable_type: string
          done_quantity: number
          id: string
          notes: string | null
          package_id: string | null
          period_month: string
          project_id: string | null
          remaining_quantity: number | null
          status: string
          target_quantity: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_team_ids?: string[] | null
          client_id: string
          created_at?: string
          deadline?: string | null
          deliverable_type: string
          done_quantity?: number
          id?: string
          notes?: string | null
          package_id?: string | null
          period_month: string
          project_id?: string | null
          remaining_quantity?: number | null
          status?: string
          target_quantity?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_team_ids?: string[] | null
          client_id?: string
          created_at?: string
          deadline?: string | null
          deliverable_type?: string
          done_quantity?: number
          id?: string
          notes?: string | null
          package_id?: string | null
          period_month?: string
          project_id?: string | null
          remaining_quantity?: number | null
          status?: string
          target_quantity?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_deliverables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_deliverables_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_projects: {
        Row: {
          budget: string | null
          business_type: string | null
          client_id: string | null
          client_name: string
          contact_submission_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          followup_next_action: string | null
          followup_owner_id: string | null
          followup_status: string | null
          followup_summary: string | null
          goals: string | null
          id: string
          last_contact_by: string | null
          last_contact_date: string | null
          lead_id: string | null
          next_followup_date: string | null
          original_message: string | null
          problems: string | null
          provided_services: string[] | null
          questionnaire_answers: Json | null
          requested_services: string[] | null
          start_date: string | null
          status: string
          timeline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget?: string | null
          business_type?: string | null
          client_id?: string | null
          client_name: string
          contact_submission_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          followup_next_action?: string | null
          followup_owner_id?: string | null
          followup_status?: string | null
          followup_summary?: string | null
          goals?: string | null
          id?: string
          last_contact_by?: string | null
          last_contact_date?: string | null
          lead_id?: string | null
          next_followup_date?: string | null
          original_message?: string | null
          problems?: string | null
          provided_services?: string[] | null
          questionnaire_answers?: Json | null
          requested_services?: string[] | null
          start_date?: string | null
          status?: string
          timeline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget?: string | null
          business_type?: string | null
          client_id?: string | null
          client_name?: string
          contact_submission_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          followup_next_action?: string | null
          followup_owner_id?: string | null
          followup_status?: string | null
          followup_summary?: string | null
          goals?: string | null
          id?: string
          last_contact_by?: string | null
          last_contact_date?: string | null
          lead_id?: string | null
          next_followup_date?: string | null
          original_message?: string | null
          problems?: string | null
          provided_services?: string[] | null
          questionnaire_answers?: Json | null
          requested_services?: string[] | null
          start_date?: string | null
          status?: string
          timeline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_contact_submission_id_fkey"
            columns: ["contact_submission_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_followup_owner_id_fkey"
            columns: ["followup_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_last_contact_by_fkey"
            columns: ["last_contact_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          billing_start_date: string | null
          client_type: string
          commission_rate: number | null
          commission_recipient_id: string | null
          contact_name: string | null
          created_at: string
          current_period_month: string | null
          default_service_fee: number | null
          default_sponsoring_budget: number | null
          email: string | null
          id: string
          industry: string | null
          monthly_package_price: number | null
          name: string
          notes: string | null
          package_config: Json | null
          package_id: string | null
          package_name: string | null
          phone: string | null
          preferred_channel: string | null
          relationship_owner_id: string | null
          sales_owner_id: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          billing_start_date?: string | null
          client_type?: string
          commission_rate?: number | null
          commission_recipient_id?: string | null
          contact_name?: string | null
          created_at?: string
          current_period_month?: string | null
          default_service_fee?: number | null
          default_sponsoring_budget?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          monthly_package_price?: number | null
          name: string
          notes?: string | null
          package_config?: Json | null
          package_id?: string | null
          package_name?: string | null
          phone?: string | null
          preferred_channel?: string | null
          relationship_owner_id?: string | null
          sales_owner_id?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          billing_start_date?: string | null
          client_type?: string
          commission_rate?: number | null
          commission_recipient_id?: string | null
          contact_name?: string | null
          created_at?: string
          current_period_month?: string | null
          default_service_fee?: number | null
          default_sponsoring_budget?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          monthly_package_price?: number | null
          name?: string
          notes?: string | null
          package_config?: Json | null
          package_id?: string | null
          package_name?: string | null
          phone?: string | null
          preferred_channel?: string | null
          relationship_owner_id?: string | null
          sales_owner_id?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_commission_recipient_id_fkey"
            columns: ["commission_recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_relationship_owner_id_fkey"
            columns: ["relationship_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          budget: string | null
          business_name: string | null
          client_id: string | null
          converted_project_id: string | null
          created_at: string
          discovery_data: Json | null
          email: string
          id: string
          message: string
          name: string
          path_taken: string | null
          phone: string | null
          preferred_contact: string | null
          questionnaire_answers: Json | null
          service: string | null
          status: string
        }
        Insert: {
          budget?: string | null
          business_name?: string | null
          client_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          discovery_data?: Json | null
          email: string
          id?: string
          message: string
          name: string
          path_taken?: string | null
          phone?: string | null
          preferred_contact?: string | null
          questionnaire_answers?: Json | null
          service?: string | null
          status?: string
        }
        Update: {
          budget?: string | null
          business_name?: string | null
          client_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          discovery_data?: Json | null
          email?: string
          id?: string
          message?: string
          name?: string
          path_taken?: string | null
          phone?: string | null
          preferred_contact?: string | null
          questionnaire_answers?: Json | null
          service?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_id: string | null
          commission_rate: number
          commission_recipient_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_agreement: Json | null
          created_at: string
          deal_value: number
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          notes: string | null
          package_id: string | null
          revenue_config: Json | null
          sales_owner_id: string | null
          service_revenue: number
          sponsoring_budget: number
          stage: string
          title: string
          updated_at: string
          won_date: string | null
        }
        Insert: {
          client_id?: string | null
          commission_rate?: number
          commission_recipient_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_agreement?: Json | null
          created_at?: string
          deal_value?: number
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          package_id?: string | null
          revenue_config?: Json | null
          sales_owner_id?: string | null
          service_revenue?: number
          sponsoring_budget?: number
          stage: string
          title: string
          updated_at?: string
          won_date?: string | null
        }
        Update: {
          client_id?: string | null
          commission_rate?: number
          commission_recipient_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_agreement?: Json | null
          created_at?: string
          deal_value?: number
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          package_id?: string | null
          revenue_config?: Json | null
          sales_owner_id?: string | null
          service_revenue?: number
          sponsoring_budget?: number
          stage?: string
          title?: string
          updated_at?: string
          won_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_commission_recipient_id_fkey"
            columns: ["commission_recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expense_transactions: {
        Row: {
          account_id: string | null
          allocation: string
          amount: number
          category_id: string | null
          category_name: string
          client_id: string | null
          commission_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          id: string
          is_recurring: boolean
          notes: string | null
          payment_method: string
          period_month: string | null
          project_id: string | null
          receipt_url: string | null
          reference: string | null
          salary_payment_id: string | null
          sponsoring_campaign_id: string | null
          status: string
          subcategory: string | null
          subscription_id: string | null
          team_member_id: string | null
          transaction_type: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          account_id?: string | null
          allocation?: string
          amount: number
          category_id?: string | null
          category_name: string
          client_id?: string | null
          commission_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: string
          period_month?: string | null
          project_id?: string | null
          receipt_url?: string | null
          reference?: string | null
          salary_payment_id?: string | null
          sponsoring_campaign_id?: string | null
          status?: string
          subcategory?: string | null
          subscription_id?: string | null
          team_member_id?: string | null
          transaction_type?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          account_id?: string | null
          allocation?: string
          amount?: number
          category_id?: string | null
          category_name?: string
          client_id?: string | null
          commission_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: string
          period_month?: string | null
          project_id?: string | null
          receipt_url?: string | null
          reference?: string | null
          salary_payment_id?: string | null
          sponsoring_campaign_id?: string | null
          status?: string
          subcategory?: string | null
          subscription_id?: string | null
          team_member_id?: string | null
          transaction_type?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "sales_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_salary_payment_id_fkey"
            columns: ["salary_payment_id"]
            isOneToOne: false
            referencedRelation: "salary_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_sponsoring_campaign_id_fkey"
            columns: ["sponsoring_campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsoring_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_transactions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          currency: string
          current_balance: number
          id: string
          is_default: boolean
          name: string
          opening_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type: string
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          is_default?: boolean
          name: string
          opening_balance?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          is_default?: boolean
          name?: string
          opening_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_closing_periods: {
        Row: {
          checklist: Json
          closed_at: string | null
          closed_by: string | null
          closing_summary: Json | null
          created_at: string
          id: string
          period_month: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist?: Json
          closed_at?: string | null
          closed_by?: string | null
          closing_summary?: Json | null
          created_at?: string
          id?: string
          period_month: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist?: Json
          closed_at?: string | null
          closed_by?: string | null
          closing_summary?: Json | null
          created_at?: string
          id?: string
          period_month?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_closing_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_closing_periods_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_transactions: {
        Row: {
          account_id: string | null
          allocation: string
          amount: number
          category: string
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_method: string
          period_month: string | null
          project_id: string | null
          receipt_url: string | null
          reference: string | null
          status: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          allocation?: string
          amount: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: string
          period_month?: string | null
          project_id?: string | null
          receipt_url?: string | null
          reference?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          allocation?: string
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: string
          period_month?: string | null
          project_id?: string | null
          receipt_url?: string | null
          reference?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          items: Json
          notes: string | null
          other_revenue: number
          paid_amount: number
          project_id: string | null
          service_revenue: number
          sponsoring_budget: number
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          items?: Json
          notes?: string | null
          other_revenue?: number
          paid_amount?: number
          project_id?: string | null
          service_revenue?: number
          sponsoring_budget?: number
          status?: string
          subtotal: number
          tax_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          other_revenue?: number
          paid_amount?: number
          project_id?: string | null
          service_revenue?: number
          sponsoring_budget?: number
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          commission: number
          created_at: string
          deliverables: Json
          description: string | null
          direct_costs: number | null
          employee_cost: number
          freelancer_cost: number
          gross_margin: number | null
          gross_profit: number | null
          id: string
          is_active: boolean
          name: string
          production_hours: number
          selling_price: number
          services: string[]
          subscription_allocation: number
          target_quantities: Json
          transport_cost: number
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          deliverables?: Json
          description?: string | null
          direct_costs?: number | null
          employee_cost?: number
          freelancer_cost?: number
          gross_margin?: number | null
          gross_profit?: number | null
          id?: string
          is_active?: boolean
          name: string
          production_hours?: number
          selling_price?: number
          services?: string[]
          subscription_allocation?: number
          target_quantities?: Json
          transport_cost?: number
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          deliverables?: Json
          description?: string | null
          direct_costs?: number | null
          employee_cost?: number
          freelancer_cost?: number
          gross_margin?: number | null
          gross_profit?: number | null
          id?: string
          is_active?: boolean
          name?: string
          production_hours?: number
          selling_price?: number
          services?: string[]
          subscription_allocation?: number
          target_quantities?: Json
          transport_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      production_bookings: {
        Row: {
          brief: Json
          client_id: string
          client_notes: string | null
          created_at: string
          created_by: string | null
          date: string
          deal_id: string | null
          duration_hours: number
          edit_preview_url: string | null
          id: string
          internal_notes: string | null
          location: string
          package_id: string | null
          production_type: string
          project_id: string | null
          raw_upload_url: string | null
          stage: string
          team_member_ids: string[] | null
          time: string
          title: string
          updated_at: string
        }
        Insert: {
          brief?: Json
          client_id: string
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deal_id?: string | null
          duration_hours?: number
          edit_preview_url?: string | null
          id?: string
          internal_notes?: string | null
          location: string
          package_id?: string | null
          production_type: string
          project_id?: string | null
          raw_upload_url?: string | null
          stage?: string
          team_member_ids?: string[] | null
          time: string
          title: string
          updated_at?: string
        }
        Update: {
          brief?: Json
          client_id?: string
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deal_id?: string | null
          duration_hours?: number
          edit_preview_url?: string | null
          id?: string
          internal_notes?: string | null
          location?: string
          package_id?: string | null
          production_type?: string
          project_id?: string | null
          raw_upload_url?: string | null
          stage?: string
          team_member_ids?: string[] | null
          time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bookings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          audience: string | null
          audience_ar: string | null
          category: string | null
          category_ar: string | null
          created_at: string
          cta_label: string | null
          cta_label_ar: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          details: string | null
          details_ar: string | null
          featured: boolean
          features: string[]
          full_description: string | null
          full_description_ar: string | null
          gallery: Json
          gumroad_url: string | null
          id: string
          includes: string[]
          name_ar: string | null
          og_image_url: string | null
          preview_url: string | null
          price: number | null
          published: boolean
          seo_description: string | null
          seo_description_ar: string | null
          seo_title: string | null
          seo_title_ar: string | null
          slug: string | null
          sort_order: number
          target_audience_ar: string | null
          thumbnail_url: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          audience_ar?: string | null
          category?: string | null
          category_ar?: string | null
          created_at?: string
          cta_label?: string | null
          cta_label_ar?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          details?: string | null
          details_ar?: string | null
          featured?: boolean
          features?: string[]
          full_description?: string | null
          full_description_ar?: string | null
          gallery?: Json
          gumroad_url?: string | null
          id?: string
          includes?: string[]
          name_ar?: string | null
          og_image_url?: string | null
          preview_url?: string | null
          price?: number | null
          published?: boolean
          seo_description?: string | null
          seo_description_ar?: string | null
          seo_title?: string | null
          seo_title_ar?: string | null
          slug?: string | null
          sort_order?: number
          target_audience_ar?: string | null
          thumbnail_url?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          audience_ar?: string | null
          category?: string | null
          category_ar?: string | null
          created_at?: string
          cta_label?: string | null
          cta_label_ar?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          details?: string | null
          details_ar?: string | null
          featured?: boolean
          features?: string[]
          full_description?: string | null
          full_description_ar?: string | null
          gallery?: Json
          gumroad_url?: string | null
          id?: string
          includes?: string[]
          name_ar?: string | null
          og_image_url?: string | null
          preview_url?: string | null
          price?: number | null
          published?: boolean
          seo_description?: string | null
          seo_description_ar?: string | null
          seo_title?: string | null
          seo_title_ar?: string | null
          slug?: string | null
          sort_order?: number
          target_audience_ar?: string | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_hours: number | null
          actual_minutes: number | null
          assigned_by_id: string | null
          assignee_id: string | null
          attachments: Json | null
          blocked_reason: string | null
          category: string | null
          client_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deadline_alert_days: number | null
          deadline_alert_enabled: boolean | null
          deadline_alert_message: string | null
          deliverable_id: string | null
          delivery_period: string | null
          description: string | null
          due_date: string | null
          end_date: string | null
          estimated_hours: number | null
          estimated_minutes: number | null
          handoff_reason: string | null
          id: string
          labor_cost: number | null
          notes: string | null
          package_id: string | null
          parent_task_id: string | null
          postpone_reason: string | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          result_links: string[] | null
          result_notes: string | null
          result_title: string | null
          reviewer_id: string | null
          revision_count: number | null
          service: string | null
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          waiting_on: string | null
        }
        Insert: {
          actual_hours?: number | null
          actual_minutes?: number | null
          assigned_by_id?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          blocked_reason?: string | null
          category?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_alert_days?: number | null
          deadline_alert_enabled?: boolean | null
          deadline_alert_message?: string | null
          deliverable_id?: string | null
          delivery_period?: string | null
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          estimated_minutes?: number | null
          handoff_reason?: string | null
          id?: string
          labor_cost?: number | null
          notes?: string | null
          package_id?: string | null
          parent_task_id?: string | null
          postpone_reason?: string | null
          previous_assignee_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          result_links?: string[] | null
          result_notes?: string | null
          result_title?: string | null
          reviewer_id?: string | null
          revision_count?: number | null
          service?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          waiting_on?: string | null
        }
        Update: {
          actual_hours?: number | null
          actual_minutes?: number | null
          assigned_by_id?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          blocked_reason?: string | null
          category?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_alert_days?: number | null
          deadline_alert_enabled?: boolean | null
          deadline_alert_message?: string | null
          deliverable_id?: string | null
          delivery_period?: string | null
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          estimated_minutes?: number | null
          handoff_reason?: string | null
          id?: string
          labor_cost?: number | null
          notes?: string | null
          package_id?: string | null
          parent_task_id?: string | null
          postpone_reason?: string | null
          previous_assignee_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          result_links?: string[] | null
          result_notes?: string | null
          result_title?: string | null
          reviewer_id?: string | null
          revision_count?: number | null
          service?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          waiting_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_previous_assignee_id_fkey"
            columns: ["previous_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          after_url: string | null
          before_url: string | null
          category: string | null
          category_ar: string | null
          challenge: string | null
          challenge_ar: string | null
          client: string | null
          client_ar: string | null
          cover_url: string | null
          created_at: string
          deliverables: string[]
          description: string | null
          description_ar: string | null
          external_url: string | null
          featured: boolean
          gallery: Json | null
          id: string
          industry: string | null
          industry_ar: string | null
          metrics: Json
          objective: string | null
          objective_ar: string | null
          outcome_ar: string | null
          process: string | null
          process_ar: string | null
          project_date: string | null
          published: boolean
          results: string | null
          results_ar: string | null
          results_summary: string | null
          seo_description: string | null
          seo_title: string | null
          services: string[] | null
          slug: string
          solution_ar: string | null
          sort_order: number
          strategy: string | null
          strategy_ar: string | null
          tags: string[] | null
          team_member_ids: string[] | null
          testimonial: Json | null
          thumbnail_url: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          after_url?: string | null
          before_url?: string | null
          category?: string | null
          category_ar?: string | null
          challenge?: string | null
          challenge_ar?: string | null
          client?: string | null
          client_ar?: string | null
          cover_url?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          description_ar?: string | null
          external_url?: string | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          industry?: string | null
          industry_ar?: string | null
          metrics?: Json
          objective?: string | null
          objective_ar?: string | null
          outcome_ar?: string | null
          process?: string | null
          process_ar?: string | null
          project_date?: string | null
          published?: boolean
          results?: string | null
          results_ar?: string | null
          results_summary?: string | null
          seo_description?: string | null
          seo_title?: string | null
          services?: string[] | null
          slug: string
          solution_ar?: string | null
          sort_order?: number
          strategy?: string | null
          strategy_ar?: string | null
          tags?: string[] | null
          team_member_ids?: string[] | null
          testimonial?: Json | null
          thumbnail_url?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          after_url?: string | null
          before_url?: string | null
          category?: string | null
          category_ar?: string | null
          challenge?: string | null
          challenge_ar?: string | null
          client?: string | null
          client_ar?: string | null
          cover_url?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          description_ar?: string | null
          external_url?: string | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          industry?: string | null
          industry_ar?: string | null
          metrics?: Json
          objective?: string | null
          objective_ar?: string | null
          outcome_ar?: string | null
          process?: string | null
          process_ar?: string | null
          project_date?: string | null
          published?: boolean
          results?: string | null
          results_ar?: string | null
          results_summary?: string | null
          seo_description?: string | null
          seo_title?: string | null
          services?: string[] | null
          slug?: string
          solution_ar?: string | null
          sort_order?: number
          strategy?: string | null
          strategy_ar?: string | null
          tags?: string[] | null
          team_member_ids?: string[] | null
          testimonial?: Json | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_type: string
          period_end: string | null
          period_start: string | null
          receipt_url: string | null
          reference: string | null
          salary_record_id: string | null
          salary_request_id: string | null
          status: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          period_end?: string | null
          period_start?: string | null
          receipt_url?: string | null
          reference?: string | null
          salary_record_id?: string | null
          salary_request_id?: string | null
          status?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          period_end?: string | null
          period_start?: string | null
          receipt_url?: string | null
          reference?: string | null
          salary_record_id?: string | null
          salary_request_id?: string | null
          status?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_salary_payments_request"
            columns: ["salary_request_id"]
            isOneToOne: false
            referencedRelation: "salary_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "salary_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          bank_details: string | null
          base_amount: number
          created_at: string
          currency: string
          effective_date: string
          hourly_rate: number | null
          id: string
          next_payment_date: string | null
          notes: string | null
          payment_frequency: string
          payment_method: string
          salary_type: string
          standard_monthly_hours: number | null
          status: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          base_amount: number
          created_at?: string
          currency?: string
          effective_date?: string
          hourly_rate?: number | null
          id?: string
          next_payment_date?: string | null
          notes?: string | null
          payment_frequency?: string
          payment_method?: string
          salary_type?: string
          standard_monthly_hours?: number | null
          status?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          base_amount?: number
          created_at?: string
          currency?: string
          effective_date?: string
          hourly_rate?: number | null
          id?: string
          next_payment_date?: string | null
          notes?: string | null
          payment_frequency?: string
          payment_method?: string
          salary_type?: string
          standard_monthly_hours?: number | null
          status?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_requests: {
        Row: {
          approved_amount: number | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          reason: string
          requested_amount: number
          requested_date: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary_payment_id: string | null
          status: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          reason: string
          requested_amount: number
          requested_date?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_payment_id?: string | null
          status?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          reason?: string
          requested_amount?: number
          requested_date?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_payment_id?: string | null
          status?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_requests_salary_payment_id_fkey"
            columns: ["salary_payment_id"]
            isOneToOne: false
            referencedRelation: "salary_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_requests_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          period_month: string
          salary_payment_id: string | null
          service_revenue: number
          status: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          period_month: string
          salary_payment_id?: string | null
          service_revenue: number
          status?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          period_month?: string
          salary_payment_id?: string | null
          service_revenue?: number
          status?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_salary_payment_id_fkey"
            columns: ["salary_payment_id"]
            isOneToOne: false
            referencedRelation: "salary_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_reels: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          description_ar: string | null
          display_order: number
          id: string
          instagram_shortcode: string
          instagram_url: string
          is_featured: boolean
          is_published: boolean
          slug: string
          thumbnail_url: string
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          description_ar?: string | null
          display_order?: number
          id?: string
          instagram_shortcode: string
          instagram_url: string
          is_featured?: boolean
          is_published?: boolean
          slug: string
          thumbnail_url: string
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          description_ar?: string | null
          display_order?: number
          id?: string
          instagram_shortcode?: string
          instagram_url?: string
          is_featured?: boolean
          is_published?: boolean
          slug?: string
          thumbnail_url?: string
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sponsoring_campaigns: {
        Row: {
          budget_tnd: number
          campaign_name: string
          client_charge_tnd: number
          client_id: string
          client_rate: number
          created_at: string
          created_by: string | null
          date: string
          execution_status: string
          id: string
          invoice_id: string | null
          margin_tnd: number
          notes: string | null
          payment_status: string
          period_month: string | null
          platform: string
          project_id: string | null
          purchase_cost_tnd: number
          purchase_rate: number
          updated_at: string
          usd_amount: number
        }
        Insert: {
          budget_tnd: number
          campaign_name: string
          client_charge_tnd: number
          client_id: string
          client_rate?: number
          created_at?: string
          created_by?: string | null
          date?: string
          execution_status?: string
          id?: string
          invoice_id?: string | null
          margin_tnd: number
          notes?: string | null
          payment_status?: string
          period_month?: string | null
          platform?: string
          project_id?: string | null
          purchase_cost_tnd: number
          purchase_rate: number
          updated_at?: string
          usd_amount: number
        }
        Update: {
          budget_tnd?: number
          campaign_name?: string
          client_charge_tnd?: number
          client_id?: string
          client_rate?: number
          created_at?: string
          created_by?: string | null
          date?: string
          execution_status?: string
          id?: string
          invoice_id?: string | null
          margin_tnd?: number
          notes?: string | null
          payment_status?: string
          period_month?: string | null
          platform?: string
          project_id?: string | null
          purchase_cost_tnd?: number
          purchase_rate?: number
          updated_at?: string
          usd_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsoring_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsoring_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsoring_campaigns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsoring_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          billing_day: number | null
          category_id: string | null
          category_name: string
          created_at: string
          currency: string
          id: string
          name: string
          next_billing_date: string | null
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          billing_cycle?: string
          billing_day?: number | null
          category_id?: string | null
          category_name?: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          next_billing_date?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          billing_cycle?: string
          billing_day?: number | null
          category_id?: string | null
          category_name?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_handoffs: {
        Row: {
          assigner_approved_at: string | null
          assigner_id: string
          created_at: string
          from_assignee_id: string
          id: string
          new_assignee_accepted_at: string | null
          project_id: string
          rejected_at: string | null
          rejected_by_id: string | null
          rejection_reason: string | null
          request_reason: string
          requested_by_id: string
          status: string
          task_id: string
          to_assignee_id: string
          updated_at: string
        }
        Insert: {
          assigner_approved_at?: string | null
          assigner_id: string
          created_at?: string
          from_assignee_id: string
          id?: string
          new_assignee_accepted_at?: string | null
          project_id: string
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          request_reason: string
          requested_by_id: string
          status?: string
          task_id: string
          to_assignee_id: string
          updated_at?: string
        }
        Update: {
          assigner_approved_at?: string | null
          assigner_id?: string
          created_at?: string
          from_assignee_id?: string
          id?: string
          new_assignee_accepted_at?: string | null
          project_id?: string
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          request_reason?: string
          requested_by_id?: string
          status?: string
          task_id?: string
          to_assignee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_handoffs_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_from_assignee_id_fkey"
            columns: ["from_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_rejected_by_id_fkey"
            columns: ["rejected_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_requested_by_id_fkey"
            columns: ["requested_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handoffs_to_assignee_id_fkey"
            columns: ["to_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          availability_status: string
          bio: string | null
          bio_ar: string | null
          created_at: string
          division: string
          email: string | null
          employment_type: string | null
          featured: boolean
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          position: string
          position_ar: string | null
          profile_id: string | null
          published: boolean
          role: string
          socials: Json | null
          sort_order: number
          specialties: string[] | null
          updated_at: string
        }
        Insert: {
          availability_status?: string
          bio?: string | null
          bio_ar?: string | null
          created_at?: string
          division?: string
          email?: string | null
          employment_type?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          position: string
          position_ar?: string | null
          profile_id?: string | null
          published?: boolean
          role?: string
          socials?: Json | null
          sort_order?: number
          specialties?: string[] | null
          updated_at?: string
        }
        Update: {
          availability_status?: string
          bio?: string | null
          bio_ar?: string | null
          created_at?: string
          division?: string
          email?: string | null
          employment_type?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          position?: string
          position_ar?: string | null
          profile_id?: string | null
          published?: boolean
          role?: string
          socials?: Json | null
          sort_order?: number
          specialties?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          client_id: string | null
          client_name: string
          company: string | null
          created_at: string
          featured: boolean
          id: string
          language: string
          photo_url: string | null
          project_id: string | null
          published: boolean
          rating: number
          review: string
          role: string | null
          service: string | null
          short_quote: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          company?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          language?: string
          photo_url?: string | null
          project_id?: string | null
          published?: boolean
          rating?: number
          review: string
          role?: string | null
          service?: string | null
          short_quote?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          company?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          language?: string
          photo_url?: string | null
          project_id?: string | null
          published?: boolean
          rating?: number
          review?: string
          role?: string | null
          service?: string | null
          short_quote?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      work_sessions: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          hourly_cost_rate: number | null
          id: string
          is_billable: boolean | null
          labor_cost: number | null
          profile_id: string | null
          project_id: string | null
          session_type: string
          started_at: string
          status: string
          task_id: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          hourly_cost_rate?: number | null
          id?: string
          is_billable?: boolean | null
          labor_cost?: number | null
          profile_id?: string | null
          project_id?: string | null
          session_type?: string
          started_at?: string
          status?: string
          task_id?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          hourly_cost_rate?: number | null
          id?: string
          is_billable?: boolean | null
          labor_cost?: number | null
          profile_id?: string | null
          project_id?: string | null
          session_type?: string
          started_at?: string
          status?: string
          task_id?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_analyze_account_dependencies: {
        Args: { _user_id: string }
        Returns: Json
      }
      admin_create_account: {
        Args: {
          _create_team_member?: boolean
          _display_name: string
          _division?: string
          _email: string
          _password: string
          _phone?: string
          _position?: string
          _role: string
        }
        Returns: Json
      }
      admin_delete_account: { Args: { _user_id: string }; Returns: Json }
      admin_list_account_audit_logs: {
        Args: { _target_user_id?: string }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          target_email: string
          target_user_id: string
        }[]
      }
      admin_list_accounts: {
        Args: never
        Returns: {
          banned_until: string
          bio: string
          created_at: string
          display_name: string
          division: string
          email: string
          is_active: boolean
          is_super_admin: boolean
          last_sign_in_at: string
          phone: string
          photo_url: string
          published: boolean
          role: string
          socials: Json
          specialties: string[]
          status: string
          team_member_id: string
          team_member_name: string
          team_position: string
          user_id: string
        }[]
      }
      admin_provision_account: {
        Args: {
          _create_team_member?: boolean
          _display_name: string
          _division?: string
          _email: string
          _phone?: string
          _position?: string
          _role: string
          _status?: string
          _user_id: string
        }
        Returns: Json
      }
      admin_reactivate_account: { Args: { _user_id: string }; Returns: Json }
      admin_reset_account_password: {
        Args: { _new_password: string; _user_id: string }
        Returns: Json
      }
      admin_suspend_account: {
        Args: { _reason?: string; _user_id: string }
        Returns: Json
      }
      admin_update_account: {
        Args: {
          _bio: string
          _display_name: string
          _division: string
          _is_active: boolean
          _phone: string
          _position: string
          _published: boolean
          _role: string
          _socials: Json
          _specialties: string[]
          _status?: string
          _user_id: string
        }
        Returns: Json
      }
      count_active_super_admins: { Args: never; Returns: number }
      get_team_member_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sada_access: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      respond_to_task_handoff: {
        Args: { p_action: string; p_handoff_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user" | "super_admin" | "worker"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "todo"
        | "in_progress"
        | "done"
        | "postponed"
        | "paused"
        | "cancelled"
        | "review"
        | "blocked"
        | "revision"
        | "approved"
        | "delivered"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "editor", "user", "super_admin", "worker"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "todo",
        "in_progress",
        "done",
        "postponed",
        "cancelled",
        "review",
        "blocked",
        "revision",
        "approved",
        "delivered",
      ],
    },
  },
} as const
