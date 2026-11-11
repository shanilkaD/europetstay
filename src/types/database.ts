export type Profile = {
  id: string
  full_name?: string
  display_name: string
  avatar_url: string | null
  user_role?: 'owner' | 'sitter' | null
  sitter_type?: 'local' | 'travelling' | 'both'
  id_verified?: boolean
  references_count?: number
  avg_rating?: number
  total_reviews?: number
  created_at: string
  updated_at: string
}

export type FeePeriod = 'per_day' | 'per_week' | 'per_stay'

export type Listing = {
  id: string
  owner_id: string
  listing_type: 'need_sitter' | 'offer_sitting'
  title: string
  city: string
  country: string
  pet_type: 'cat' | 'dog' | 'bird' | 'other' | 'both'
  pet_types?: string[]
  pet_name: string | null
  pet_age: string
  pet_breed: string
  pet_details: string
  pet_care_needs: string[]
  can_care_for: string[]
  experience_years: string
  special_skills: string[]
  smoker: 'smoker' | 'non_smoker' | null
  sitter_type: 'single' | 'couple' | 'family' | null
  bring_own_pet: 'no' | 'dog' | 'cat' | null
  languages: string[]
  house_type: 'apartment' | 'house' | 'farm' | 'studio' | null
  offers: string[]
  sitter_fee_amount: number | null
  sitter_fee_currency: string
  sitter_fee_period: FeePeriod
  owner_payment_amount: number | null
  owner_payment_currency: string
  owner_payment_period: FeePeriod
  in_person_meet_required: boolean
  house_rules: string[]
  starts_on: string
  ends_on: string
  description: string
  photo_url: string | null
  photo_urls: string[]
  status: 'live' | 'booked' | 'completed' | 'cancelled'
  created_at: string
}

export type SitterApplication = {
  id: string
  sitter_id: string
  animals: string[]
  party_type: 'single' | 'couple' | 'family'
  languages: string[]
  experience: string[]
  experience_years: string
  pet_experience: string
  about: string
  photo_url: string
  created_at: string
}

export type Conversation = {
  id: string
  listing_id: string
  owner_id: string
  sitter_id: string
  created_at: string
}

export type ListingPrivateDetails = {
  listing_id: string
  owner_id: string
  medical_needs: string
  vet_name: string
  vet_phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
  who_pays_vet: 'owner' | 'shared'
  updated_at: string
}

export type SitterVerificationSubmission = {
  sitter_id: string
  id_document_path: string | null
  reference_name: string
  reference_contact: string
  agreed_to_rules: boolean
  updated_at: string
}

export type ConversationRead = {
  conversation_id: string
  user_id: string
  last_read_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export type Review = {
  id: string
  listing_id: string
  reviewer_id: string
  reviewed_id: string
  rating: number
  comment: string
  created_at: string
}

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, 'id'> & Partial<Pick<Profile, 'full_name' | 'display_name' | 'avatar_url' | 'user_role' | 'sitter_type' | 'id_verified' | 'references_count' | 'avg_rating' | 'total_reviews'>>,
        Partial<Pick<Profile, 'full_name' | 'display_name' | 'avatar_url' | 'user_role' | 'sitter_type' | 'id_verified' | 'references_count' | 'avg_rating' | 'total_reviews'>>
      >
      listings: Table<
        Listing,
        Omit<Listing, 'id' | 'created_at'>,
        Partial<Omit<Listing, 'id' | 'owner_id' | 'created_at'>>
      >
      sitter_applications: Table<
        SitterApplication,
        Omit<SitterApplication, 'id' | 'created_at'>,
        Partial<Omit<SitterApplication, 'id' | 'sitter_id' | 'created_at'>>
      >
      conversations: Table<
        Conversation,
        Omit<Conversation, 'id' | 'created_at'>,
        never
      >
      messages: Table<
        Message,
        Omit<Message, 'id' | 'created_at'>,
        never
      >
      listing_private_details: Table<
        ListingPrivateDetails,
        Omit<ListingPrivateDetails, 'updated_at' | 'who_pays_vet'> & Partial<Pick<ListingPrivateDetails, 'who_pays_vet'>>,
        Partial<Omit<ListingPrivateDetails, 'listing_id' | 'owner_id' | 'updated_at'>>
      >
      sitter_verification_submissions: Table<
        SitterVerificationSubmission,
        Omit<SitterVerificationSubmission, 'updated_at' | 'agreed_to_rules'> & Partial<Pick<SitterVerificationSubmission, 'agreed_to_rules'>>,
        Partial<Omit<SitterVerificationSubmission, 'sitter_id' | 'updated_at'>>
      >
      conversation_reads: Table<
        ConversationRead,
        ConversationRead,
        Pick<ConversationRead, 'last_read_at'>
      >
      reviews: Table<
        Review,
        Omit<Review, 'id' | 'created_at'>,
        never
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
