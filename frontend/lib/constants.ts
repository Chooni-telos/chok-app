export const LEVEL_LABELS: Record<string, string> = {
  dull: "무딘 촉",
  rookie: "촉 새내기",
  sharp: "예리한 촉",
  genius: "촉 천재",
  god: "신들린 촉",
  cursed: "고장난 촉",
};

export const LEVEL_COLORS: Record<string, string> = {
  dull: "text-slate-400",
  rookie: "text-green-500",
  sharp: "text-blue-500",
  genius: "text-purple-500",
  god: "text-amber-500",
  cursed: "text-red-500",
};

export const LEVEL_BG_COLORS: Record<string, string> = {
  dull: "from-slate-100 to-slate-50",
  rookie: "from-green-100 to-green-50",
  sharp: "from-blue-100 to-blue-50",
  genius: "from-purple-100 to-purple-50",
  god: "from-amber-100 to-yellow-50",
  cursed: "from-red-100 to-red-50",
};

export const LEVEL_RING_COLORS: Record<string, string> = {
  dull: "ring-slate-300",
  rookie: "ring-green-400",
  sharp: "ring-blue-400",
  genius: "ring-purple-400",
  god: "ring-amber-400",
  cursed: "ring-red-400",
};

export const LEVEL_EMOJI: Record<string, string> = {
  dull: "😶",
  rookie: "🌱",
  sharp: "⚡",
  genius: "🧠",
  god: "👁️",
  cursed: "💀",
};

export const LEVEL_DESC: Record<string, string> = {
  dull: "촉이 아직 깨어나지 않았어요",
  rookie: "촉의 씨앗이 싹트기 시작!",
  sharp: "날카로운 예감이 적중한다",
  genius: "남다른 예지력의 소유자",
  god: "미래가 보이는 경지",
  cursed: "반대로 가면 맞는 전설의 촉",
};

export const CATEGORIES = ["전체", "시사", "스포츠", "엔터테인먼트", "경제테크", "도파민"] as const;
