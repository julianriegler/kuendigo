export const colors = {
  bg: '#080C18',
  surface: '#111827',
  surface2: '#1C2535',
  border: '#1F2D42',
  textPrimary: '#F0F4FF',
  textSecondary: '#8B95A8',
  textTertiary: '#4A5568',
  accent: '#00D9B0',
  accentDark: '#00A88A',
  danger: '#FF5C5C',
  warning: '#FFB347',
  success: '#00D9B0',
};

export const categories: Record<string, { emoji: string; label: string; color: string }> = {
  streaming:  { emoji: '🎬', label: 'Streaming',  color: '#E50914' },
  music:      { emoji: '🎵', label: 'Musik',       color: '#1DB954' },
  software:   { emoji: '💻', label: 'Software',    color: '#0078D4' },
  fitness:    { emoji: '💪', label: 'Fitness',     color: '#FF6B35' },
  news:       { emoji: '📰', label: 'News',        color: '#6B7280' },
  food:       { emoji: '🍔', label: 'Essen',       color: '#F59E0B' },
  cloud:      { emoji: '☁️',  label: 'Cloud',       color: '#3B82F6' },
  gaming:     { emoji: '🎮', label: 'Gaming',      color: '#8B5CF6' },
  other:      { emoji: '📦', label: 'Sonstiges',   color: '#6B7280' },
};
