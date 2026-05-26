export interface CardItem {
  id: string;
  title: string;
  category: string;
  status: string;
  closes_at: string;
  result_announce_at: string | null;
  card_type: string;
  choices: string[];
  yes_count: number;
  no_count: number;
  yes_ratio: number;
  choice_counts: Record<string, number>;
  my_vote: string | null;
  duration_tier: string;
  image_url: string | null;
  comment_count: number;
}

export interface CommentItem {
  id: string;
  user_id: string;
  nickname: string | null;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface CardDetail extends CardItem {
  description: string | null;
  event_start_at: string | null;
  settled_at: string | null;
  final_result: string | null;
  created_at: string;
}

export interface UserStats {
  id: string;
  nickname: string | null;
  email: string | null;
  age_group: string | null;
  gender: string | null;
  interests: string[];
  pq_score: number;
  level_code: string;
  total_predictions: number;
  total_votes: number;
  total_wins: number;
  win_rate: number;
  current_streak: number;
  is_cursed: boolean;
  preferred_language: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string | null;
  pq_score: number;
  level_code: string;
  win_rate: number;
}

export interface VoteHistoryItem {
  card_id: string;
  card_title: string;
  choice: string;
  final_result: string | null;
  delta: number | null;
  pq_after: number | null;
  voted_at: string;
  settled: boolean;
}
