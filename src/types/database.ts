export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Listing = {
  id: string
  owner_id: string
  title: string
  city: string
  country: string
  pet_type: 'cat' | 'dog' | 'bird' | 'other'
  pet_name: string
  pet_details: string
  pet_care_needs: string[]
  house_type: 'apartment' | 'house' | 'farm' | 'studio' | null
  offers: string[]
  house_rules: string[]
  starts_on: string
  ends_on: string
  description: string
  photo_url: string | null
  photo_urls: string[]
  status: 'active' | 'closed'
  created_at: string
}

export type SitterApplication = {
  id: string
  sitter_id: string
  destinations: string[]
  starts_on: string
  ends_on: string
  party_type: 'single' | 'couple' | 'family'
  languages: string[]
  experience: string[]
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

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
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
        Pick<Profile, 'id'> & Partial<Pick<Profile, 'display_name' | 'avatar_url'>>,
        Partial<Pick<Profile, 'display_name' | 'avatar_url'>>
      >
      listings: Table<
        Listing,
        Omit<Listing, 'id' | 'created_at'>,
        Partial<Omit<Listing, 'id' | 'owner_id' | 'created_at'>>
      >
      sitter_applications: Table<
        SitterApplication,
        Omit<SitterApplication, 'id' | 'created_at'>,
        never
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
