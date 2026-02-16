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
    PostgrestVersion: "14.1"
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
      access_requests: {
        Row: {
          created_at: string
          domain: string | null
          email: string
          full_name: string | null
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["access_request_status"]
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          email: string
          full_name?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          email?: string
          full_name?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_replies: {
        Row: {
          badge_type: string | null
          body: string
          comment_id: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_type?: string | null
          body: string
          comment_id: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_type?: string | null
          body?: string
          comment_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          badge_type: string | null
          body: string
          created_at: string
          id: string
          module_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_type?: string | null
          body: string
          created_at?: string
          id?: string
          module_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_type?: string | null
          body?: string
          created_at?: string
          id?: string
          module_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enrollment_type: Database["public"]["Enums"]["enrollment_type"]
          id: string
          password_hash: string | null
          staleness_threshold_days: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrollment_type?: Database["public"]["Enums"]["enrollment_type"]
          id?: string
          password_hash?: string | null
          staleness_threshold_days?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrollment_type?: Database["public"]["Enums"]["enrollment_type"]
          id?: string
          password_hash?: string | null
          staleness_threshold_days?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      csm_tenant_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csm_tenant_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csm_tenant_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csm_tenant_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          course_id: string
          deadline: string
          exam_id: string
          feedback: string | null
          file_url: string
          graded_at: string | null
          graded_by: string | null
          id: string
          score: number | null
          submitted_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          deadline: string
          exam_id: string
          feedback?: string | null
          file_url: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          submitted_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          deadline?: string
          exam_id?: string
          feedback?: string | null
          file_url?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          submitted_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          allowed_file_types: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          exam_file_url: string | null
          id: string
          max_file_size: number | null
          module_id: string
          passing_score: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_file_types?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes: number
          exam_file_url?: string | null
          id?: string
          max_file_size?: number | null
          module_id: string
          passing_score: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_file_types?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          exam_file_url?: string | null
          id?: string
          max_file_size?: number | null
          module_id?: string
          passing_score?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_questions: {
        Row: {
          course_id: string
          created_at: string
          id: string
          module_id: string | null
          question_text: string
          responded_at: string | null
          responded_by: string | null
          response_text: string | null
          status: Database["public"]["Enums"]["expert_question_status"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          module_id?: string | null
          question_text: string
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: Database["public"]["Enums"]["expert_question_status"]
          tenant_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          module_id?: string | null
          question_text?: string
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: Database["public"]["Enums"]["expert_question_status"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_questions_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_quiz_references: {
        Row: {
          external_quiz_id: string
          external_quiz_url: string
          id: string
          module_id: string
          passing_score: number | null
        }
        Insert: {
          external_quiz_id: string
          external_quiz_url: string
          id?: string
          module_id: string
          passing_score?: number | null
        }
        Update: {
          external_quiz_id?: string
          external_quiz_url?: string
          id?: string
          module_id?: string
          passing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_quiz_references_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      external_quiz_results: {
        Row: {
          completed_at: string | null
          external_quiz_id: string
          id: string
          passed: boolean | null
          raw_response: Json | null
          score: number | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          external_quiz_id: string
          id?: string
          passed?: boolean | null
          raw_response?: Json | null
          score?: number | null
          tenant_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          external_quiz_id?: string
          id?: string
          passed?: boolean | null
          raw_response?: Json | null
          score?: number | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_quiz_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_quiz_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          course_id: string
          created_at: string
          description: string
          id: string
          internal_notes: string | null
          issue_type: Database["public"]["Enums"]["issue_type"]
          module_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["issue_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description: string
          id?: string
          internal_notes?: string | null
          issue_type: Database["public"]["Enums"]["issue_type"]
          module_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string
          id?: string
          internal_notes?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"]
          module_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lecturer_course_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          can_edit: boolean
          can_grade: boolean
          course_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          can_edit?: boolean
          can_grade?: boolean
          course_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          can_edit?: boolean
          can_grade?: boolean
          course_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecturer_course_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecturer_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecturer_course_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_audio: {
        Row: {
          duration_seconds: number | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string
          module_id: string
        }
        Insert: {
          duration_seconds?: number | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string
          module_id: string
        }
        Update: {
          duration_seconds?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_audio_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_downloads: {
        Row: {
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          module_id: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          module_id: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_downloads_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_files: {
        Row: {
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          module_id: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          module_id: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_files_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_markdown: {
        Row: {
          content: string
          id: string
          module_id: string
        }
        Insert: {
          content: string
          id?: string
          module_id: string
        }
        Update: {
          content?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_markdown_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_pdfs: {
        Row: {
          file_name: string
          file_url: string
          id: string
          module_id: string
          page_count: number | null
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          module_id: string
          page_count?: number | null
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          module_id?: string
          page_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_pdfs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_videos: {
        Row: {
          bunny_library_id: number
          bunny_video_id: string
          duration: number | null
          encoding_status: number
          id: string
          module_id: string
          original_filename: string | null
          thumbnail_url: string | null
        }
        Insert: {
          bunny_library_id: number
          bunny_video_id: string
          duration?: number | null
          encoding_status?: number
          id?: string
          module_id: string
          original_filename?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          bunny_library_id?: number
          bunny_video_id?: string
          duration?: number | null
          encoding_status?: number
          id?: string
          module_id?: string
          original_filename?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_videos_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration_minutes: number
          id: string
          lecture_id: string
          module_type: Database["public"]["Enums"]["module_type"]
          significant_update_at: string | null
          sort_order: number
          staleness_postponed_until: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          lecture_id: string
          module_type: Database["public"]["Enums"]["module_type"]
          significant_update_at?: string | null
          sort_order?: number
          staleness_postponed_until?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          lecture_id?: string
          module_type?: Database["public"]["Enums"]["module_type"]
          significant_update_at?: string | null
          sort_order?: number
          staleness_postponed_until?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
          is_tenant_admin: boolean
          keycloak_idp_alias: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          is_tenant_admin?: boolean
          keycloak_idp_alias?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_tenant_admin?: boolean
          keycloak_idp_alias?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_answers: {
        Row: {
          attempt_id: string
          id: string
          question_id: string
          user_answer: string | null
        }
        Insert: {
          attempt_id: string
          id?: string
          question_id: string
          user_answer?: string | null
        }
        Update: {
          attempt_id?: string
          id?: string
          question_id?: string
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          attempt_number: number
          id: string
          passed: boolean | null
          quiz_id: string
          score: number | null
          started_at: string
          submitted_at: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          attempt_number: number
          id?: string
          passed?: boolean | null
          quiz_id: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          id?: string
          passed?: boolean | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string | null
          explanation: string | null
          id: string
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_answer?: string | null
          explanation?: string | null
          id?: string
          points?: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_answer?: string | null
          explanation?: string | null
          id?: string
          points?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_attempts: number | null
          module_id: string
          passing_score: number
          randomize_answers: boolean
          randomize_questions: boolean
          show_correct_answers: boolean
          time_limit: number | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_attempts?: number | null
          module_id: string
          passing_score: number
          randomize_answers?: boolean
          randomize_questions?: boolean
          show_correct_answers?: boolean
          time_limit?: number | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_attempts?: number | null
          module_id?: string
          passing_score?: number
          randomize_answers?: boolean
          randomize_questions?: boolean
          show_correct_answers?: boolean
          time_limit?: number | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_history: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          sent_by: string
          sent_to: string
          tenant_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          sent_by: string
          sent_to: string
          tenant_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          sent_by?: string
          sent_to?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_history_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_history_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_history_sent_to_fkey"
            columns: ["sent_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_courses: {
        Row: {
          course_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          course_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          course_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          is_master: boolean
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          is_master?: boolean
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          is_master?: boolean
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          lecture_id: string
          marked_by: Database["public"]["Enums"]["marked_by_type"] | null
          module_id: string
          notes: string | null
          status: Database["public"]["Enums"]["progress_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          lecture_id: string
          marked_by?: Database["public"]["Enums"]["marked_by_type"] | null
          module_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          lecture_id?: string
          marked_by?: Database["public"]["Enums"]["marked_by_type"] | null
          module_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      issues_safe: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          issue_type: Database["public"]["Enums"]["issue_type"] | null
          module_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["issue_status"] | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"] | null
          module_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"] | null
          module_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_options_safe: {
        Row: {
          id: string | null
          option_text: string | null
          question_id: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string | null
          option_text?: string | null
          question_id?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string | null
          option_text?: string | null
          question_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions_safe: {
        Row: {
          id: string | null
          points: number | null
          question_text: string | null
          question_type:
            | Database["public"]["Enums"]["quiz_question_type"]
            | null
          quiz_id: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string | null
          points?: number | null
          question_text?: string | null
          question_type?:
            | Database["public"]["Enums"]["quiz_question_type"]
            | null
          quiz_id?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string | null
          points?: number | null
          question_text?: string | null
          question_type?:
            | Database["public"]["Enums"]["quiz_question_type"]
            | null
          quiz_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_orphaned_auth_users: { Args: never; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      enroll_with_password: {
        Args: { p_course_id: string; p_password: string }
        Returns: string
      }
      get_matching_question_terms: {
        Args: { p_question_ids: string[] }
        Returns: Json
      }
      get_quiz_results: {
        Args: { p_attempt_id: string }
        Returns: {
          correct_answer: string
          explanation: string
          options: Json
          points: number
          question_id: string
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          user_answer: string
        }[]
      }
      grade_quiz_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      jwt_claim: { Args: { claim: string }; Returns: string }
      jwt_claim_array: { Args: { claim: string }; Returns: string[] }
      password_verification_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected"
      enrollment_type: "invite_only" | "password_protected" | "open"
      expert_question_status: "pending" | "answered" | "closed"
      issue_status: "open" | "investigating" | "resolved" | "closed"
      issue_type: "content_error" | "technical" | "accessibility" | "other"
      marked_by_type: "user" | "system" | "admin"
      module_type:
        | "video"
        | "pdf"
        | "markdown"
        | "quiz"
        | "exam"
        | "external_quiz"
        | "audio"
        | "download"
      notification_type:
        | "course_assigned"
        | "new_module"
        | "progress_reset"
        | "exam_graded"
        | "question_answered"
        | "reminder"
        | "exam_deadline"
        | "new_expert_question"
        | "new_exam_submission"
        | "new_issue"
        | "content_staleness"
        | "new_access_request"
        | "issue_resolved"
        | "exam_reset"
        | "access_request_reviewed"
      progress_status: "not_started" | "in_progress" | "completed"
      quiz_question_type:
        | "single_choice"
        | "multiple_choice"
        | "true_false"
        | "fill_blank"
        | "matching"
        | "short_answer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_request_status: ["pending", "approved", "rejected"],
      enrollment_type: ["invite_only", "password_protected", "open"],
      expert_question_status: ["pending", "answered", "closed"],
      issue_status: ["open", "investigating", "resolved", "closed"],
      issue_type: ["content_error", "technical", "accessibility", "other"],
      marked_by_type: ["user", "system", "admin"],
      module_type: [
        "video",
        "pdf",
        "markdown",
        "quiz",
        "exam",
        "external_quiz",
        "audio",
        "download",
      ],
      notification_type: [
        "course_assigned",
        "new_module",
        "progress_reset",
        "exam_graded",
        "question_answered",
        "reminder",
        "exam_deadline",
        "new_expert_question",
        "new_exam_submission",
        "new_issue",
        "content_staleness",
        "new_access_request",
        "issue_resolved",
        "exam_reset",
        "access_request_reviewed",
      ],
      progress_status: ["not_started", "in_progress", "completed"],
      quiz_question_type: [
        "single_choice",
        "multiple_choice",
        "true_false",
        "fill_blank",
        "matching",
        "short_answer",
      ],
    },
  },
} as const
