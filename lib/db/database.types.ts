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
      activity_logs: {
        Row: {
          action: string
          id: number
          ip_address: string | null
          team_id: number
          timestamp: string
          user_id: number | null
        }
        Insert: {
          action: string
          id?: number
          ip_address?: string | null
          team_id: number
          timestamp?: string
          user_id?: number | null
        }
        Update: {
          action?: string
          id?: number
          ip_address?: string | null
          team_id?: number
          timestamp?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: number
          team_id: number
          title: string | null
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          team_id: number
          title?: string | null
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          team_id?: number
          title?: string | null
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: number
          name: string
          owner: string
          product_features: Json | null
          team_id: number
          updated_at: string
          urls: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name: string
          owner: string
          product_features?: Json | null
          team_id: number
          updated_at?: string
          urls?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name?: string
          owner?: string
          product_features?: Json | null
          team_id?: number
          updated_at?: string
          urls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_categories: {
        Row: {
          color: string
          created_at: string
          id: number
          name: string
          team_id: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: number
          name: string
          team_id: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: number
          name?: string
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_category_assignments: {
        Row: {
          category_id: number
          contact_id: number
          created_at: string
          id: number
          team_id: number
        }
        Insert: {
          category_id: number
          contact_id: number
          created_at?: string
          id?: number
          team_id: number
        }
        Update: {
          category_id?: number
          contact_id?: number
          created_at?: string
          id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contact_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_organizations: {
        Row: {
          contact_id: number
          created_at: string
          id: number
          organization_id: number
          team_id: number
        }
        Insert: {
          contact_id: number
          created_at?: string
          id?: number
          organization_id: number
          team_id: number
        }
        Update: {
          contact_id?: number
          created_at?: string
          id?: number
          organization_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_organizations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_organizations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          action_committed: boolean
          assigned_user_id: number | null
          background: string | null
          city: string | null
          congressional_district: string | null
          county: string | null
          created_at: string
          districts_updated_at: string | null
          email: string | null
          email_secondary: string | null
          engagement_level: string
          id: number
          name: string
          organization_id: number | null
          phone: string | null
          phone_secondary: string | null
          preferred_contact_method: string | null
          regions: string[] | null
          state: string | null
          state_assembly_district: string | null
          state_senate_district: string | null
          street: string | null
          team_id: number
          updated_at: string
          user_id: number
          zip: string | null
        }
        Insert: {
          action_committed?: boolean
          assigned_user_id?: number | null
          background?: string | null
          city?: string | null
          congressional_district?: string | null
          county?: string | null
          created_at?: string
          districts_updated_at?: string | null
          email?: string | null
          email_secondary?: string | null
          engagement_level?: string
          id?: number
          name: string
          organization_id?: number | null
          phone?: string | null
          phone_secondary?: string | null
          preferred_contact_method?: string | null
          regions?: string[] | null
          state?: string | null
          state_assembly_district?: string | null
          state_senate_district?: string | null
          street?: string | null
          team_id: number
          updated_at?: string
          user_id: number
          zip?: string | null
        }
        Update: {
          action_committed?: boolean
          assigned_user_id?: number | null
          background?: string | null
          city?: string | null
          congressional_district?: string | null
          county?: string | null
          created_at?: string
          districts_updated_at?: string | null
          email?: string | null
          email_secondary?: string | null
          engagement_level?: string
          id?: number
          name?: string
          organization_id?: number | null
          phone?: string | null
          phone_secondary?: string | null
          preferred_contact_method?: string | null
          regions?: string[] | null
          state?: string | null
          state_assembly_district?: string | null
          state_senate_district?: string | null
          street?: string | null
          team_id?: number
          updated_at?: string
          user_id?: number
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          block_number: string | null
          category: string | null
          collection_id: number
          created_at: string
          description: string | null
          id: number
          last_updated: string
          team_id: number
          title: string | null
          updated_by: number
          vector: string | null
        }
        Insert: {
          block_number?: string | null
          category?: string | null
          collection_id: number
          created_at?: string
          description?: string | null
          id?: number
          last_updated?: string
          team_id: number
          title?: string | null
          updated_by: number
          vector?: string | null
        }
        Update: {
          block_number?: string | null
          category?: string | null
          collection_id?: number
          created_at?: string
          description?: string | null
          id?: number
          last_updated?: string
          team_id?: number
          title?: string | null
          updated_by?: number
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_blocks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_blocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          email: string
          id: number
          invited_at: string
          invited_by: number
          role: string
          status: string
          supabase_user_id: string | null
          team_id: number
        }
        Insert: {
          email: string
          id?: number
          invited_at?: string
          invited_by: number
          role: string
          status?: string
          supabase_user_id?: string | null
          team_id: number
        }
        Update: {
          email?: string
          id?: number
          invited_at?: string
          invited_by?: number
          role?: string
          status?: string
          supabase_user_id?: string | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      legislative_bills: {
        Row: {
          alert_note: string | null
          alert_type: string | null
          badge_label: string | null
          bill_id: string
          bill_id_param: string | null
          coauthors: string | null
          committee_action_date: string | null
          committee_hearing_date: string | null
          committee_location: string | null
          committee_motion: string | null
          committee_vote_result: string | null
          created_at: string | null
          highlight: string | null
          history_actions: Json | null
          house_location: string | null
          id: number
          last_amended_date: string | null
          last_scraped: string | null
          lead_authors: string | null
          letter_notes: string | null
          letter_status: string | null
          letter_status_label: string | null
          policy_deadline: string | null
          principal_coauthors: string | null
          source_url: string | null
          stages: Json | null
          team_id: number
          tier: string | null
          title: string
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          alert_note?: string | null
          alert_type?: string | null
          badge_label?: string | null
          bill_id: string
          bill_id_param?: string | null
          coauthors?: string | null
          committee_action_date?: string | null
          committee_hearing_date?: string | null
          committee_location?: string | null
          committee_motion?: string | null
          committee_vote_result?: string | null
          created_at?: string | null
          highlight?: string | null
          history_actions?: Json | null
          house_location?: string | null
          id?: number
          last_amended_date?: string | null
          last_scraped?: string | null
          lead_authors?: string | null
          letter_notes?: string | null
          letter_status?: string | null
          letter_status_label?: string | null
          policy_deadline?: string | null
          principal_coauthors?: string | null
          source_url?: string | null
          stages?: Json | null
          team_id: number
          tier?: string | null
          title: string
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_note?: string | null
          alert_type?: string | null
          badge_label?: string | null
          bill_id?: string
          bill_id_param?: string | null
          coauthors?: string | null
          committee_action_date?: string | null
          committee_hearing_date?: string | null
          committee_location?: string | null
          committee_motion?: string | null
          committee_vote_result?: string | null
          created_at?: string | null
          highlight?: string | null
          history_actions?: Json | null
          house_location?: string | null
          id?: number
          last_amended_date?: string | null
          last_scraped?: string | null
          lead_authors?: string | null
          letter_notes?: string | null
          letter_status?: string | null
          letter_status_label?: string | null
          policy_deadline?: string | null
          principal_coauthors?: string | null
          source_url?: string | null
          stages?: Json | null
          team_id?: number
          tier?: string | null
          title?: string
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legislative_bills_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      legislative_events: {
        Row: {
          badge_label: string | null
          created_at: string | null
          date_label: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: number
          team_id: number
          title: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          badge_label?: string | null
          created_at?: string | null
          date_label?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: number
          team_id: number
          title: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          badge_label?: string | null
          created_at?: string | null
          date_label?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: number
          team_id?: number
          title?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legislative_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          contact_id: number
          created_at: string
          id: number
          meeting_id: number
          team_id: number
        }
        Insert: {
          contact_id: number
          created_at?: string
          id?: number
          meeting_id: number
          team_id: number
        }
        Update: {
          contact_id?: number
          created_at?: string
          id?: number
          meeting_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          date: string
          id: number
          location: string | null
          name: string
          notes: string | null
          team_id: number
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          location?: string | null
          name: string
          notes?: string | null
          team_id: number
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          location?: string | null
          name?: string
          notes?: string | null
          team_id?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: number
          content: string
          created_at: string
          id: number
          role: string
          team_id: number
          user_id: number
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string
          id?: number
          role: string
          team_id: number
          user_id: number
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string
          id?: number
          role?: string
          team_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_ones: {
        Row: {
          contact_id: number
          created_at: string
          date: string
          id: number
          notes: string | null
          organizer_name: string | null
          team_id: number
          updated_at: string
          user_id: number | null
        }
        Insert: {
          contact_id: number
          created_at?: string
          date: string
          id?: number
          notes?: string | null
          organizer_name?: string | null
          team_id: number
          updated_at?: string
          user_id?: number | null
        }
        Update: {
          contact_id?: number
          created_at?: string
          date?: string
          id?: number
          notes?: string | null
          organizer_name?: string | null
          team_id?: number
          updated_at?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_ones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          assigned_user_id: number | null
          city: string | null
          created_at: string
          description: string | null
          engagement_level: string
          id: number
          name: string
          priority_follow_up: boolean
          regions: string[]
          size: string | null
          state: string | null
          status: string
          street: string | null
          team_id: number
          team_leader_id: number | null
          type: string | null
          updated_at: string
          user_id: number
          website: string | null
          zip: string | null
        }
        Insert: {
          assigned_user_id?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          engagement_level?: string
          id?: number
          name: string
          priority_follow_up?: boolean
          regions?: string[]
          size?: string | null
          state?: string | null
          status?: string
          street?: string | null
          team_id: number
          team_leader_id?: number | null
          type?: string | null
          updated_at?: string
          user_id: number
          website?: string | null
          zip?: string | null
        }
        Update: {
          assigned_user_id?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          engagement_level?: string
          id?: number
          name?: string
          priority_follow_up?: boolean
          regions?: string[]
          size?: string | null
          state?: string | null
          status?: string
          street?: string | null
          team_id?: number
          team_leader_id?: number | null
          type?: string | null
          updated_at?: string
          user_id?: number
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          a: string | null
          created_at: string | null
          gp: string | null
          id: string
          l: string
          lat: number | null
          lon: number | null
          n: string | null
          s: string | null
          sm: string | null
          ts: string | null
          u: number | null
        }
        Insert: {
          a?: string | null
          created_at?: string | null
          gp?: string | null
          id?: string
          l: string
          lat?: number | null
          lon?: number | null
          n?: string | null
          s?: string | null
          sm?: string | null
          ts?: string | null
          u?: number | null
        }
        Update: {
          a?: string | null
          created_at?: string | null
          gp?: string | null
          id?: string
          l?: string
          lat?: number | null
          lon?: number | null
          n?: string | null
          s?: string | null
          sm?: string | null
          ts?: string | null
          u?: number | null
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          prompt: string
          team_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          prompt: string
          team_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          prompt?: string
          team_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_prompts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_integrations: {
        Row: {
          api_key: string | null
          config: Json
          created_at: string | null
          id: number
          provider: string
          team_id: number
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          config?: Json
          created_at?: string | null
          id?: number
          provider: string
          team_id: number
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          config?: Json
          created_at?: string | null
          id?: number
          provider?: string
          team_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_integrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: number
          joined_at: string
          role: string
          team_id: number
          user_id: number
        }
        Insert: {
          id?: number
          joined_at?: string
          role: string
          team_id: number
          user_id: number
        }
        Update: {
          id?: number
          joined_at?: string
          role?: string
          team_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          ai_model: string
          ai_provider: string
          created_at: string
          example_data_industry: string | null
          id: number
          include_unrated_historical: boolean | null
          min_historical_evaluation_rank: number | null
          min_historical_similarity: string | null
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          plan_name: string | null
          stripe_customer_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          used_example_data: boolean | null
        }
        Insert: {
          ai_model?: string
          ai_provider?: string
          created_at?: string
          example_data_industry?: string | null
          id?: number
          include_unrated_historical?: boolean | null
          min_historical_evaluation_rank?: number | null
          min_historical_similarity?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          plan_name?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          used_example_data?: boolean | null
        }
        Update: {
          ai_model?: string
          ai_provider?: string
          created_at?: string
          example_data_industry?: string | null
          id?: number
          include_unrated_historical?: boolean | null
          min_historical_evaluation_rank?: number | null
          min_historical_similarity?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          plan_name?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          used_example_data?: boolean | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          id: number
          name: string | null
          password_hash: string | null
          role: string
          supabase_auth_id: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: number
          name?: string | null
          password_hash?: string | null
          role?: string
          supabase_auth_id?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: number
          name?: string | null
          password_hash?: string | null
          role?: string
          supabase_auth_id?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_active_team_id: { Args: never; Returns: number }
      get_app_user_id: { Args: never; Returns: number }
      get_auth_user_id: { Args: never; Returns: string }
      is_team_member: { Args: { check_team_id: number }; Returns: boolean }
      search_similar_blocks: {
        Args: { p_limit?: number; p_query_vector: string; p_team_id: number }
        Returns: {
          block_number: string
          category: string
          collection_id: number
          description: string
          id: number
          similarity: number
          title: string
        }[]
      }
      update_block_embedding: {
        Args: { p_block_id: number; p_vector: string }
        Returns: undefined
      }
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
