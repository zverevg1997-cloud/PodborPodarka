export interface GiftIdea {
  name: string;
  reason: string;
  searchQuery: string;
}

export interface RecommendRequestBody {
  profileId: string;
  occasion: string;
  budget?: string;
  timeframe?: string;
  city?: string;
  mood?: string;
}

export interface ProfileInput {
  name: string;
  gender?: string;
  age?: number;
  relationship?: string;
  job?: string;
  interests?: string;
}
