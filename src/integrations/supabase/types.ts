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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      command_requests: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          idempotency_key: string
          response: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          idempotency_key: string
          response?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          idempotency_key?: string
          response?: Json | null
        }
        Relationships: []
      }
      commercial_document_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          failure_code: string | null
          id: string
          order_id: string
          organization_id: string
          request_id: string
          requested_by: string
          status: string
          storage_path: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          failure_code?: string | null
          id?: string
          order_id: string
          organization_id: string
          request_id: string
          requested_by: string
          status?: string
          storage_path: string
          version: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          failure_code?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          request_id?: string
          requested_by?: string
          status?: string
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_document_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_document_sequences: {
        Row: {
          document_type: Database["public"]["Enums"]["document_type"]
          fiscal_year: string
          last_number: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          document_type: Database["public"]["Enums"]["document_type"]
          fiscal_year: string
          last_number?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          document_type?: Database["public"]["Enums"]["document_type"]
          fiscal_year?: string
          last_number?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_documents: {
        Row: {
          content_sha256: string
          document_number: string | null
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json
          order_id: string | null
          organization_id: string
          storage_path: string
          supersedes_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          version: number
        }
        Insert: {
          content_sha256: string
          document_number?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          organization_id: string
          storage_path: string
          supersedes_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          version?: number
        }
        Update: {
          content_sha256?: string
          document_number?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          organization_id?: string
          storage_path?: string
          supersedes_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_organization_id: string
          context: Database["public"]["Enums"]["conversation_context"]
          created_at: string
          dispute_id: string | null
          id: string
          order_id: string | null
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string | null
        }
        Insert: {
          buyer_organization_id: string
          context: Database["public"]["Enums"]["conversation_context"]
          created_at?: string
          dispute_id?: string | null
          id?: string
          order_id?: string | null
          quote_id?: string | null
          rfq_id?: string | null
          seller_organization_id?: string | null
        }
        Update: {
          buyer_organization_id?: string
          context?: Database["public"]["Enums"]["conversation_context"]
          created_at?: string
          dispute_id?: string | null
          id?: string
          order_id?: string | null
          quote_id?: string | null
          rfq_id?: string | null
          seller_organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_organization_id_fkey"
            columns: ["buyer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "rfq_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          description: string
          id: string
          opened_at: string
          opened_by_organization_id: string
          order_id: string
          request_id: string | null
          resolution: Json | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          type: string
          updated_at: string
        }
        Insert: {
          description: string
          id?: string
          opened_at?: string
          opened_by_organization_id: string
          order_id: string
          request_id?: string | null
          resolution?: Json | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          type: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: string
          opened_at?: string
          opened_by_organization_id?: string
          order_id?: string
          request_id?: string | null
          resolution?: Json | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_organization_id_fkey"
            columns: ["opened_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          id: string
          order_id: string | null
          product_id: string
          quantity_after: number
          reason: string
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: string
          order_id?: string | null
          product_id: string
          quantity_after: number
          reason: string
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          order_id?: string | null
          product_id?: string
          quantity_after?: number
          reason?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_code: string
          credit: number
          currency: string
          debit: number
          event_key: string
          id: string
          order_id: string
          organization_id: string | null
          posted_at: string
          transaction_id: string | null
        }
        Insert: {
          account_code: string
          credit?: number
          currency?: string
          debit?: number
          event_key: string
          id?: string
          order_id: string
          organization_id?: string | null
          posted_at?: string
          transaction_id?: string | null
        }
        Update: {
          account_code?: string
          credit?: number
          currency?: string
          debit?: number
          event_key?: string
          id?: string
          order_id?: string
          organization_id?: string | null
          posted_at?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          request_id: string | null
          sender_id: string | null
          sender_organization_id: string | null
          visibility: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          request_id?: string | null
          sender_id?: string | null
          sender_organization_id?: string | null
          visibility?: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          request_id?: string | null
          sender_id?: string | null
          sender_organization_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_organization_id_fkey"
            columns: ["sender_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_nonessential: boolean
          sms_nonessential: boolean
          updated_at: string
          user_id: string
          whatsapp_nonessential: boolean
        }
        Insert: {
          email_nonessential?: boolean
          sms_nonessential?: boolean
          updated_at?: string
          user_id: string
          whatsapp_nonessential?: boolean
        }
        Update: {
          email_nonessential?: boolean
          sms_nonessential?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_nonessential?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          critical: boolean
          failed_at: string | null
          id: string
          payload: Json
          read_at: string | null
          sent_at: string | null
          template_key: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          critical?: boolean
          failed_at?: string | null
          id?: string
          payload: Json
          read_at?: string | null
          sent_at?: string | null
          template_key: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          critical?: boolean
          failed_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          template_key?: string
          user_id?: string
        }
        Relationships: []
      }
      operational_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgement_notes: string | null
          category: string
          details: Json
          entity_id: string
          entity_type: string
          fingerprint: string
          first_detected_at: string
          id: string
          last_detected_at: string
          last_scan_token: string
          resolved_at: string | null
          severity: string
          status: string
          summary: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          category: string
          details?: Json
          entity_id: string
          entity_type: string
          fingerprint: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          last_scan_token: string
          resolved_at?: string | null
          severity: string
          status?: string
          summary: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          category?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          fingerprint?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          last_scan_token?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          summary?: string
        }
        Relationships: []
      }
      operations_members: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["operations_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["operations_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["operations_role"]
          user_id?: string
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          created_at: string
          description: string
          gst_rate: number
          hsn_code: string | null
          id: string
          line_total: number | null
          order_id: string
          product_id: string | null
          quantity: number
          seller_sku: string | null
          unit_of_measure: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          gst_rate: number
          hsn_code?: string | null
          id?: string
          line_total?: number | null
          order_id: string
          product_id?: string | null
          quantity: number
          seller_sku?: string | null
          unit_of_measure: string
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          seller_sku?: string | null
          unit_of_measure?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          additional_charge_amount: number
          buyer_organization_id: string
          created_at: string
          created_by: string
          currency: string
          delivery_address: Json
          discount_amount: number
          freight_amount: number
          grand_total: number | null
          gst_amount: number
          id: string
          inspection_ends_at: string | null
          order_number: string
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          taxable_amount: number
          updated_at: string
        }
        Insert: {
          additional_charge_amount?: number
          buyer_organization_id: string
          created_at?: string
          created_by: string
          currency?: string
          delivery_address: Json
          discount_amount?: number
          freight_amount?: number
          grand_total?: number | null
          gst_amount?: number
          id?: string
          inspection_ends_at?: string | null
          order_number: string
          quote_id?: string | null
          rfq_id?: string | null
          seller_organization_id: string
          status?: Database["public"]["Enums"]["order_status"]
          taxable_amount?: number
          updated_at?: string
        }
        Update: {
          additional_charge_amount?: number
          buyer_organization_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          delivery_address?: Json
          discount_amount?: number
          freight_amount?: number
          grand_total?: number | null
          gst_amount?: number
          id?: string
          inspection_ends_at?: string | null
          order_number?: string
          quote_id?: string | null
          rfq_id?: string | null
          seller_organization_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          taxable_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_organization_id_fkey"
            columns: ["buyer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "rfq_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          display_name: string
          gstin: string | null
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          legal_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          gstin?: string | null
          id?: string
          kind: Database["public"]["Enums"]["organization_kind"]
          legal_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          gstin?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          legal_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          failed_at: string | null
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      payment_provider_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload_sha256: string
          payment_transaction_id: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          provider: string
          provider_reference: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload_sha256: string
          payment_transaction_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider: string
          provider_reference: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload_sha256?: string
          payment_transaction_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider?: string
          provider_reference?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_events_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          amount_refunded: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          order_id: string
          provider: string
          provider_payment_reference: string | null
          provider_reference: string | null
          reconciliation_status: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          webhook_event_id: string | null
        }
        Insert: {
          amount: number
          amount_refunded?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          initiated_by?: string | null
          order_id: string
          provider: string
          provider_payment_reference?: string | null
          provider_reference?: string | null
          reconciliation_status?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          amount?: number
          amount_refunded?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          initiated_by?: string | null
          order_id?: string
          provider?: string
          provider_payment_reference?: string | null
          provider_reference?: string | null
          reconciliation_status?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          eligible_at: string | null
          id: string
          order_id: string
          payment_transaction_id: string | null
          provider_reference: string | null
          released_at: string | null
          seller_organization_id: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          eligible_at?: string | null
          id?: string
          order_id: string
          payment_transaction_id?: string | null
          provider_reference?: string | null
          released_at?: string | null
          seller_organization_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          eligible_at?: string | null
          id?: string
          order_id?: string
          payment_transaction_id?: string | null
          provider_reference?: string | null
          released_at?: string | null
          seller_organization_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          created_at: string
          currency: string
          id: string
          maximum_quantity: number
          minimum_quantity: number
          product_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          maximum_quantity: number
          minimum_quantity: number
          product_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          maximum_quantity?: number
          minimum_quantity?: number
          product_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        Insert: {
          available_quantity?: number
          brand?: string | null
          category_id?: string | null
          certifications?: Json
          country_of_origin?: string | null
          created_at?: string
          custom_quote_threshold?: number | null
          customization_available?: boolean
          description: string
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          lead_time_days: number
          listing_status?: Database["public"]["Enums"]["listing_status"]
          manufacturer?: string | null
          minimum_order_quantity: number
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available?: boolean
          production_capacity?: Json | null
          quantity_increment?: number
          return_eligible?: boolean
          sample_available?: boolean
          sample_price?: number | null
          search_document?: unknown
          seller_sku: string
          shipping_methods?: string[]
          shipping_origin?: Json
          slug: string
          specifications?: Json
          submitted_for_review_at?: string | null
          unit_of_measure: string
          units_per_carton?: number | null
          updated_at?: string
          warranty_terms?: string | null
        }
        Update: {
          available_quantity?: number
          brand?: string | null
          category_id?: string | null
          certifications?: Json
          country_of_origin?: string | null
          created_at?: string
          custom_quote_threshold?: number | null
          customization_available?: boolean
          description?: string
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          lead_time_days?: number
          listing_status?: Database["public"]["Enums"]["listing_status"]
          manufacturer?: string | null
          minimum_order_quantity?: number
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name?: string
          organization_id?: string
          private_label_available?: boolean
          production_capacity?: Json | null
          quantity_increment?: number
          return_eligible?: boolean
          sample_available?: boolean
          sample_price?: number | null
          search_document?: unknown
          seller_sku?: string
          shipping_methods?: string[]
          shipping_origin?: Json
          slug?: string
          specifications?: Json
          submitted_for_review_at?: string | null
          unit_of_measure?: string
          units_per_carton?: number | null
          updated_at?: string
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_versions: {
        Row: {
          additional_charges: number
          created_at: string
          created_by: string
          deviations: Json
          discount_amount: number
          gst_rate: number
          id: string
          lead_time_days: number
          payment_terms: Json
          quantity: number
          quote_id: string
          seller_notes: string | null
          shipping_charge: number
          submitted_at: string | null
          technical_compliance: Json
          unit_price: number
          validity_ends_at: string
          version: number
        }
        Insert: {
          additional_charges?: number
          created_at?: string
          created_by: string
          deviations?: Json
          discount_amount?: number
          gst_rate: number
          id?: string
          lead_time_days: number
          payment_terms?: Json
          quantity: number
          quote_id: string
          seller_notes?: string | null
          shipping_charge?: number
          submitted_at?: string | null
          technical_compliance?: Json
          unit_price: number
          validity_ends_at: string
          version: number
        }
        Update: {
          additional_charges?: number
          created_at?: string
          created_by?: string
          deviations?: Json
          discount_amount?: number
          gst_rate?: number
          id?: string
          lead_time_days?: number
          payment_terms?: Json
          quantity?: number
          quote_id?: string
          seller_notes?: string | null
          shipping_charge?: number
          submitted_at?: string | null
          technical_compliance?: Json
          unit_price?: number
          validity_ends_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "rfq_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          buyer_organization_id: string
          created_at: string
          created_by: string
          id: string
          order_id: string
          rating: number
          seller_organization_id: string
        }
        Insert: {
          body?: string | null
          buyer_organization_id: string
          created_at?: string
          created_by: string
          id?: string
          order_id: string
          rating: number
          seller_organization_id: string
        }
        Update: {
          body?: string | null
          buyer_organization_id?: string
          created_at?: string
          created_by?: string
          id?: string
          order_id?: string
          rating?: number
          seller_organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_organization_id_fkey"
            columns: ["buyer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string
          current_version: number
          id: string
          rfq_id: string
          seller_organization_id: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by: string
          current_version?: number
          id?: string
          rfq_id: string
          seller_organization_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          current_version?: number
          id?: string
          rfq_id?: string
          seller_organization_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quotes_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_supplier_invites: {
        Row: {
          invited_at: string
          rfq_id: string
          seller_organization_id: string
          viewed_at: string | null
        }
        Insert: {
          invited_at?: string
          rfq_id: string
          seller_organization_id: string
          viewed_at?: string | null
        }
        Update: {
          invited_at?: string
          rfq_id?: string
          seller_organization_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_supplier_invites_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_supplier_invites_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          buyer_organization_id: string
          category_id: string | null
          created_at: string
          created_by: string
          customization_requirements: string | null
          delivery_address: Json
          delivery_pin_code: string
          id: string
          payment_term_preferences: Json
          private_label_required: boolean
          product_id: string | null
          quality_requirements: string | null
          quote_deadline: string | null
          required_certifications: Json
          required_delivery_date: string | null
          required_quantity: number
          shipping_responsibility: string
          specifications: Json
          status: Database["public"]["Enums"]["rfq_status"]
          target_unit_price: number | null
          title: string
          unit_of_measure: string
          updated_at: string
          visibility: string
        }
        Insert: {
          buyer_organization_id: string
          category_id?: string | null
          created_at?: string
          created_by: string
          customization_requirements?: string | null
          delivery_address: Json
          delivery_pin_code: string
          id?: string
          payment_term_preferences?: Json
          private_label_required?: boolean
          product_id?: string | null
          quality_requirements?: string | null
          quote_deadline?: string | null
          required_certifications?: Json
          required_delivery_date?: string | null
          required_quantity: number
          shipping_responsibility: string
          specifications?: Json
          status?: Database["public"]["Enums"]["rfq_status"]
          target_unit_price?: number | null
          title: string
          unit_of_measure: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          buyer_organization_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          customization_requirements?: string | null
          delivery_address?: Json
          delivery_pin_code?: string
          id?: string
          payment_term_preferences?: Json
          private_label_required?: boolean
          product_id?: string | null
          quality_requirements?: string | null
          quote_deadline?: string | null
          required_certifications?: Json
          required_delivery_date?: string | null
          required_quantity?: number
          shipping_responsibility?: string
          specifications?: Json
          status?: Database["public"]["Enums"]["rfq_status"]
          target_unit_price?: number | null
          title?: string
          unit_of_measure?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_buyer_organization_id_fkey"
            columns: ["buyer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          organization_id: string | null
          reason: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          organization_id?: string | null
          reason: string
          resolved_at?: string | null
          severity: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          organization_id?: string | null
          reason?: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_flags_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_lines: {
        Row: {
          order_line_id: string
          quantity_damaged: number
          quantity_missing: number
          quantity_shipped: number
          shipment_id: string
        }
        Insert: {
          order_line_id: string
          quantity_damaged?: number
          quantity_missing?: number
          quantity_shipped: number
          shipment_id: string
        }
        Update: {
          order_line_id?: string
          quantity_damaged?: number
          quantity_missing?: number
          quantity_shipped?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          freight_type: string
          id: string
          order_id: string
          proof_of_delivery_path: string | null
          proof_of_dispatch_path: string | null
          request_id: string | null
          seller_organization_id: string
          shipping_mode: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_events: Json
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          freight_type: string
          id?: string
          order_id: string
          proof_of_delivery_path?: string | null
          proof_of_dispatch_path?: string | null
          request_id?: string | null
          seller_organization_id: string
          shipping_mode: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_events?: Json
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          freight_type?: string
          id?: string
          order_id?: string
          proof_of_delivery_path?: string | null
          proof_of_dispatch_path?: string | null
          request_id?: string | null
          seller_organization_id?: string
          shipping_mode?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_events?: Json
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_seller_organization_id_fkey"
            columns: ["seller_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_directory: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_directory_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_metrics: {
        Row: {
          average_response_minutes: number | null
          calculated_at: string
          completed_transaction_value: number
          dispute_rate: number
          on_time_dispatch_rate: number
          order_completion_rate: number
          organization_id: string
          rating: number
          repeat_buyer_rate: number
          verified_since: string | null
        }
        Insert: {
          average_response_minutes?: number | null
          calculated_at?: string
          completed_transaction_value?: number
          dispute_rate?: number
          on_time_dispatch_rate?: number
          order_completion_rate?: number
          organization_id: string
          rating?: number
          repeat_buyer_rate?: number
          verified_since?: string | null
        }
        Update: {
          average_response_minutes?: number | null
          calculated_at?: string
          completed_transaction_value?: number
          dispute_rate?: number
          on_time_dispatch_rate?: number
          order_completion_rate?: number
          organization_id?: string
          rating?: number
          repeat_buyer_rate?: number
          verified_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_cases: {
        Row: {
          business_type: string | null
          cin_or_llpin: string | null
          created_at: string
          id: string
          operating_address: Json | null
          organization_id: string
          pan_last4: string | null
          registered_address: Json | null
          reviewed_at: string | null
          reviewer_notes: string | null
          risk_flags: Json
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          udyam_registration: string | null
          updated_at: string
          verified_until: string | null
        }
        Insert: {
          business_type?: string | null
          cin_or_llpin?: string | null
          created_at?: string
          id?: string
          operating_address?: Json | null
          organization_id: string
          pan_last4?: string | null
          registered_address?: Json | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          risk_flags?: Json
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          udyam_registration?: string | null
          updated_at?: string
          verified_until?: string | null
        }
        Update: {
          business_type?: string | null
          cin_or_llpin?: string | null
          created_at?: string
          id?: string
          operating_address?: Json | null
          organization_id?: string
          pan_last4?: string | null
          registered_address?: Json | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          risk_flags?: Json
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          udyam_registration?: string | null
          updated_at?: string
          verified_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation_command: {
        Args: { token_input: string }
        Returns: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_quote_command: {
        Args: { quote_id_input: string }
        Returns: {
          additional_charge_amount: number
          buyer_organization_id: string
          created_at: string
          created_by: string
          currency: string
          delivery_address: Json
          discount_amount: number
          freight_amount: number
          grand_total: number | null
          gst_amount: number
          id: string
          inspection_ends_at: string | null
          order_number: string
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          taxable_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      acknowledge_operational_incident_command: {
        Args: { incident_id_input: string; notes_input: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgement_notes: string | null
          category: string
          details: Json
          entity_id: string
          entity_type: string
          fingerprint: string
          first_detected_at: string
          id: string
          last_detected_at: string
          last_scan_token: string
          resolved_at: string | null
          severity: string
          status: string
          summary: string
        }
        SetofOptions: {
          from: "*"
          to: "operational_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_product_price_tier_command: {
        Args: {
          maximum_quantity_input: number
          minimum_quantity_input: number
          product_id_input: string
          unit_price_input: number
        }
        Returns: {
          created_at: string
          currency: string
          id: string
          maximum_quantity: number
          minimum_quantity: number
          product_id: string
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "product_price_tiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_inventory_command: {
        Args: {
          delta_input: number
          product_id_input: string
          reason_input: string
          request_id_input: string
        }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_razorpay_payment_event_internal: {
        Args: {
          amount_paise_input: number
          amount_refunded_paise_input: number
          currency_input: string
          event_id_input: string
          event_type_input: string
          payload_sha256_input: string
          payment_reference_input: string
          provider_reference_input: string
        }
        Returns: {
          amount: number
          amount_refunded: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          order_id: string
          provider: string
          provider_payment_reference: string | null
          provider_reference: string | null
          reconciliation_status: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          webhook_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_payment_provider_reference_internal: {
        Args: { provider_reference_input: string; transaction_id_input: string }
        Returns: {
          amount: number
          amount_refunded: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          order_id: string
          provider: string
          provider_payment_reference: string | null
          provider_reference: string | null
          reconciliation_status: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          webhook_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_order_inspection_command: {
        Args: { order_id_input: string }
        Returns: {
          additional_charge_amount: number
          buyer_organization_id: string
          created_at: string
          created_by: string
          currency: string
          delivery_address: Json
          discount_amount: number
          freight_amount: number
          grand_total: number | null
          gst_amount: number
          id: string
          inspection_ends_at: string | null
          order_number: string
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          taxable_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_shipment_delivery_command: {
        Args: { shipment_id_input: string }
        Returns: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          freight_type: string
          id: string
          order_id: string
          proof_of_delivery_path: string | null
          proof_of_dispatch_path: string | null
          request_id: string | null
          seller_organization_id: string
          shipping_mode: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_events: Json
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_business_organization_command: {
        Args: {
          address_input?: Json
          business_type_input?: string
          display_name_input: string
          gstin_input?: string
          kind_input: Database["public"]["Enums"]["organization_kind"]
          legal_name_input: string
        }
        Returns: {
          created_at: string
          display_name: string
          gstin: string | null
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          legal_name: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_invitation_command: {
        Args: {
          email_input: string
          organization_id_input: string
          role_input: Database["public"]["Enums"]["organization_role"]
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_product_command: {
        Args: {
          idempotency_key_input: string
          organization_id_input: string
          payload: Json
        }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_review_command: {
        Args: {
          body_input: string
          order_id_input: string
          rating_input: number
        }
        Returns: {
          body: string | null
          buyer_organization_id: string
          created_at: string
          created_by: string
          id: string
          order_id: string
          rating: number
          seller_organization_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_rfq_command: {
        Args: {
          buyer_organization_id_input: string
          payload: Json
          request_id_input?: string
        }
        Returns: {
          buyer_organization_id: string
          category_id: string | null
          created_at: string
          created_by: string
          customization_requirements: string | null
          delivery_address: Json
          delivery_pin_code: string
          id: string
          payment_term_preferences: Json
          private_label_required: boolean
          product_id: string | null
          quality_requirements: string | null
          quote_deadline: string | null
          required_certifications: Json
          required_delivery_date: string | null
          required_quantity: number
          shipping_responsibility: string
          specifications: Json
          status: Database["public"]["Enums"]["rfq_status"]
          target_unit_price: number | null
          title: string
          unit_of_measure: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "rfqs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_shipment_command: {
        Args: {
          carrier_input: string
          estimated_delivery_input: string
          freight_type_input: string
          lines_input: Json
          order_id_input: string
          request_id_input: string
          shipping_mode_input: string
          tracking_number_input: string
        }
        Returns: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          freight_type: string
          id: string
          order_id: string
          proof_of_delivery_path: string | null
          proof_of_dispatch_path: string | null
          request_id: string | null
          seller_organization_id: string
          shipping_mode: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_events: Json
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_product_price_tier_command: {
        Args: { tier_id_input: string }
        Returns: undefined
      }
      dispatch_shipment_command: {
        Args: { shipment_id_input: string }
        Returns: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          freight_type: string
          id: string
          order_id: string
          proof_of_delivery_path: string | null
          proof_of_dispatch_path: string | null
          request_id: string | null
          seller_organization_id: string
          shipping_mode: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_events: Json
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_commercial_document_internal: {
        Args: { failure_code_input: string; job_id_input: string }
        Returns: undefined
      }
      fail_payment_attempt_internal: {
        Args: { failure_reason_input: string; transaction_id_input: string }
        Returns: {
          amount: number
          amount_refunded: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          order_id: string
          provider: string
          provider_payment_reference: string | null
          provider_reference: string | null
          reconciliation_status: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          webhook_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_commercial_document_internal: {
        Args: {
          content_sha256_input: string
          job_id_input: string
          metadata_input: Json
        }
        Returns: {
          content_sha256: string
          document_number: string | null
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json
          order_id: string | null
          organization_id: string
          storage_path: string
          supersedes_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_all_categories_command: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          name: string
          parent_id: string
          product_count: number
          slug: string
        }[]
      }
      get_operations_health_command: { Args: never; Returns: Json }
      get_or_create_trade_conversation_command: {
        Args: {
          context_input: Database["public"]["Enums"]["conversation_context"]
          reference_id_input: string
        }
        Returns: {
          buyer_organization_id: string
          context: Database["public"]["Enums"]["conversation_context"]
          created_at: string
          dispute_id: string | null
          id: string
          order_id: string | null
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_platform_accounts_command: {
        Args: never
        Returns: {
          account_created_at: string
          email: string
          email_confirmed: boolean
          full_name: string
          last_sign_in_at: string
          operations_roles: string[]
          organization_count: number
          organization_names: string
          user_id: string
        }[]
      }
      get_platform_orders_command: {
        Args: never
        Returns: {
          buyer_name: string
          created_at: string
          grand_total: number
          id: string
          order_number: string
          payment_status: string
          seller_name: string
          shipment_status: string
          status: string
        }[]
      }
      get_platform_organizations_command: {
        Args: never
        Returns: {
          display_name: string
          gstin: string
          kind: string
          legal_name: string
          member_count: number
          organization_created_at: string
          organization_id: string
          status: string
          verification_status: string
        }[]
      }
      get_platform_payments_command: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          id: string
          order_number: string
          provider: string
          provider_reference: string
          reconciliation_status: string
          status: string
          verified_at: string
        }[]
      }
      initiate_payment_attempt_command: {
        Args: { idempotency_key_input: string; order_id_input: string }
        Returns: {
          amount: number
          amount_refunded: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          order_id: string
          provider: string
          provider_payment_reference: string | null
          provider_reference: string | null
          reconciliation_status: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          webhook_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_team_members_command: {
        Args: { organization_id_input: string }
        Returns: {
          email: string
          joined_at: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }[]
      }
      mark_notification_read_command: {
        Args: { notification_id_input: string }
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          critical: boolean
          failed_at: string | null
          id: string
          payload: Json
          read_at: string | null
          sent_at: string | null
          template_key: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      moderate_product_command: {
        Args: {
          approve_input: boolean
          notes_input: string
          product_id_input: string
        }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      open_dispute_command: {
        Args: {
          description_input: string
          order_id_input: string
          organization_id_input: string
          request_id_input: string
          type_input: string
        }
        Returns: {
          description: string
          id: string
          opened_at: string
          opened_by_organization_id: string
          order_id: string
          request_id: string | null
          resolution: Json | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_has_role: { Args: { _roles: string[] }; Returns: boolean }
      publish_rfq_command: {
        Args: { rfq_id_input: string }
        Returns: {
          buyer_organization_id: string
          category_id: string | null
          created_at: string
          created_by: string
          customization_requirements: string | null
          delivery_address: Json
          delivery_pin_code: string
          id: string
          payment_term_preferences: Json
          private_label_required: boolean
          product_id: string | null
          quality_requirements: string | null
          quote_deadline: string | null
          required_certifications: Json
          required_delivery_date: string | null
          required_quantity: number
          shipping_responsibility: string
          specifications: Json
          status: Database["public"]["Enums"]["rfq_status"]
          target_unit_price: number | null
          title: string
          unit_of_measure: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "rfqs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_team_member_command: {
        Args: { organization_id_input: string; user_id_input: string }
        Returns: undefined
      }
      reopen_rejected_product_command: {
        Args: { product_id_input: string }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_commercial_document_internal: {
        Args: {
          actor_id_input: string
          document_type_input: Database["public"]["Enums"]["document_type"]
          order_id_input: string
          organization_id_input: string
          request_id_input: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          failure_code: string | null
          id: string
          order_id: string
          organization_id: string
          request_id: string
          requested_by: string
          status: string
          storage_path: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "commercial_document_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_dispute_command: {
        Args: {
          dispute_id_input: string
          notes_input: string
          outcome_input: string
        }
        Returns: {
          description: string
          id: string
          opened_at: string
          opened_by_organization_id: string
          order_id: string
          request_id: string | null
          resolution: Json | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_verification_case_command: {
        Args: {
          approve_input: boolean
          case_id_input: string
          notes_input: string
        }
        Returns: {
          business_type: string | null
          cin_or_llpin: string | null
          created_at: string
          id: string
          operating_address: Json | null
          organization_id: string
          pan_last4: string | null
          registered_address: Json | null
          reviewed_at: string | null
          reviewer_notes: string | null
          risk_flags: Json
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          udyam_registration: string | null
          updated_at: string
          verified_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verification_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_operational_health_scan_command: { Args: never; Returns: number }
      send_trade_message_command: {
        Args: {
          body_input: string
          conversation_id_input: string
          request_id_input: string
          sender_organization_id_input: string
        }
        Returns: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          request_id: string | null
          sender_id: string | null
          sender_organization_id: string | null
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_order_line_tax_details_command: {
        Args: { hsn_code_input: string; order_line_id_input: string }
        Returns: {
          created_at: string
          description: string
          gst_rate: number
          hsn_code: string | null
          id: string
          line_total: number | null
          order_id: string
          product_id: string | null
          quantity: number
          seller_sku: string | null
          unit_of_measure: string
          unit_price: number
        }
        SetofOptions: {
          from: "*"
          to: "order_lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_product_for_review_command: {
        Args: { product_id_input: string }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quote_version_command: {
        Args: {
          payload: Json
          request_id_input?: string
          rfq_id_input: string
          seller_organization_id_input: string
        }
        Returns: {
          accepted_at: string | null
          created_at: string
          created_by: string
          current_version: number
          id: string
          rfq_id: string
          seller_organization_id: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rfq_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_verification_case_command: {
        Args: { organization_id_input: string }
        Returns: {
          business_type: string | null
          cin_or_llpin: string | null
          created_at: string
          id: string
          operating_address: Json | null
          organization_id: string
          pan_last4: string | null
          registered_address: Json | null
          reviewed_at: string | null
          reviewer_notes: string | null
          risk_flags: Json
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          udyam_registration: string | null
          updated_at: string
          verified_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verification_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_order_command: {
        Args: {
          next_state: Database["public"]["Enums"]["order_status"]
          order_id_input: string
          request_id_input?: string
        }
        Returns: {
          additional_charge_amount: number
          buyer_organization_id: string
          created_at: string
          created_by: string
          currency: string
          delivery_address: Json
          discount_amount: number
          freight_amount: number
          grand_total: number | null
          gst_amount: number
          id: string
          inspection_ends_at: string | null
          order_number: string
          quote_id: string | null
          rfq_id: string | null
          seller_organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          taxable_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_product_draft_command: {
        Args: { payload: Json; product_id_input: string }
        Returns: {
          available_quantity: number
          brand: string | null
          category_id: string | null
          certifications: Json
          country_of_origin: string | null
          created_at: string
          custom_quote_threshold: number | null
          customization_available: boolean
          description: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          lead_time_days: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          manufacturer: string | null
          minimum_order_quantity: number
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          organization_id: string
          private_label_available: boolean
          production_capacity: Json | null
          quantity_increment: number
          return_eligible: boolean
          sample_available: boolean
          sample_price: number | null
          search_document: unknown
          seller_sku: string
          shipping_methods: string[]
          shipping_origin: Json
          slug: string
          specifications: Json
          submitted_for_review_at: string | null
          unit_of_measure: string
          units_per_carton: number | null
          updated_at: string
          warranty_terms: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_category_command: {
        Args: {
          id_input: string
          is_active_input: boolean
          name_input: string
          parent_id_input: string
          slug_input: string
        }
        Returns: string
      }
    }
    Enums: {
      conversation_context:
        | "product_inquiry"
        | "rfq"
        | "quote"
        | "order"
        | "shipment"
        | "dispute"
      dispute_status:
        | "opened"
        | "evidence_collection"
        | "seller_response"
        | "fea_review"
        | "resolution_proposed"
        | "accepted"
        | "escalated"
        | "resolved"
      document_type:
        | "purchase_order"
        | "proforma_invoice"
        | "tax_invoice"
        | "credit_note"
        | "debit_note"
        | "delivery_challan"
        | "packing_list"
        | "shipment_document"
        | "other"
      listing_status: "draft" | "active" | "archived"
      moderation_status: "pending" | "approved" | "rejected"
      notification_channel: "in_app" | "email" | "sms" | "whatsapp"
      operations_role:
        | "verification_reviewer"
        | "catalog_moderator"
        | "payments_reviewer"
        | "dispute_manager"
        | "support_agent"
        | "platform_administrator"
      order_status:
        | "draft"
        | "awaiting_seller_confirmation"
        | "awaiting_payment"
        | "payment_secured"
        | "processing"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "inspection"
        | "completed"
        | "cancelled"
        | "partially_fulfilled"
        | "returned"
        | "disputed"
      organization_kind: "buyer" | "seller" | "both" | "platform"
      organization_role:
        | "owner"
        | "administrator"
        | "procurement_manager"
        | "purchase_approver"
        | "accountant"
        | "sales_manager"
        | "sales_representative"
        | "catalog_manager"
        | "inventory_manager"
        | "warehouse_operator"
        | "viewer"
      payment_status:
        | "initiated"
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "partially_refunded"
        | "refunded"
        | "cancelled"
      payout_status: "held" | "eligible" | "released" | "failed" | "reversed"
      quote_status:
        | "draft"
        | "submitted"
        | "revised"
        | "accepted"
        | "rejected"
        | "expired"
        | "withdrawn"
      rfq_status:
        | "draft"
        | "published"
        | "receiving_quotes"
        | "evaluation"
        | "negotiation"
        | "awarded"
        | "converted"
        | "closed"
        | "cancelled"
      shipment_status:
        | "draft"
        | "ready"
        | "dispatched"
        | "in_transit"
        | "delivered"
        | "exception"
        | "cancelled"
      verification_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "resubmission_required"
        | "expired"
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
  public: {
    Enums: {
      conversation_context: [
        "product_inquiry",
        "rfq",
        "quote",
        "order",
        "shipment",
        "dispute",
      ],
      dispute_status: [
        "opened",
        "evidence_collection",
        "seller_response",
        "fea_review",
        "resolution_proposed",
        "accepted",
        "escalated",
        "resolved",
      ],
      document_type: [
        "purchase_order",
        "proforma_invoice",
        "tax_invoice",
        "credit_note",
        "debit_note",
        "delivery_challan",
        "packing_list",
        "shipment_document",
        "other",
      ],
      listing_status: ["draft", "active", "archived"],
      moderation_status: ["pending", "approved", "rejected"],
      notification_channel: ["in_app", "email", "sms", "whatsapp"],
      operations_role: [
        "verification_reviewer",
        "catalog_moderator",
        "payments_reviewer",
        "dispute_manager",
        "support_agent",
        "platform_administrator",
      ],
      order_status: [
        "draft",
        "awaiting_seller_confirmation",
        "awaiting_payment",
        "payment_secured",
        "processing",
        "ready_to_ship",
        "shipped",
        "delivered",
        "inspection",
        "completed",
        "cancelled",
        "partially_fulfilled",
        "returned",
        "disputed",
      ],
      organization_kind: ["buyer", "seller", "both", "platform"],
      organization_role: [
        "owner",
        "administrator",
        "procurement_manager",
        "purchase_approver",
        "accountant",
        "sales_manager",
        "sales_representative",
        "catalog_manager",
        "inventory_manager",
        "warehouse_operator",
        "viewer",
      ],
      payment_status: [
        "initiated",
        "pending",
        "authorized",
        "captured",
        "failed",
        "partially_refunded",
        "refunded",
        "cancelled",
      ],
      payout_status: ["held", "eligible", "released", "failed", "reversed"],
      quote_status: [
        "draft",
        "submitted",
        "revised",
        "accepted",
        "rejected",
        "expired",
        "withdrawn",
      ],
      rfq_status: [
        "draft",
        "published",
        "receiving_quotes",
        "evaluation",
        "negotiation",
        "awarded",
        "converted",
        "closed",
        "cancelled",
      ],
      shipment_status: [
        "draft",
        "ready",
        "dispatched",
        "in_transit",
        "delivered",
        "exception",
        "cancelled",
      ],
      verification_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "resubmission_required",
        "expired",
      ],
    },
  },
} as const
