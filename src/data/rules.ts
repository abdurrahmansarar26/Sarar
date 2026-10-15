export interface DivisibilityRule {
  divisor: number;
  title: string;
  question: string;
  tip: string;
  shortTip: string;
  check: (n: number) => boolean;
  explain: (n: number) => string;
}

export const DIVISIBILITY_RULES: Record<number, DivisibilityRule> = {
  2: {
    divisor: 2,
    title: "2 ile Bölünebilme",
    question: "2 ile KALANSIZ BÖLÜNEN sayıya çarp!",
    tip: "Birler basamağı çift sayı (0, 2, 4, 6, 8) olan sayılar 2 ile kalansız bölünür.",
    shortTip: "Son rakamı çift (0, 2, 4, 6, 8) olmalı!",
    check: (n) => n % 2 === 0,
    explain: (n) => {
      const lastDigit = Math.abs(n) % 10;
      const isEven = lastDigit % 2 === 0;
      return `Son basamağı ${lastDigit} (${isEven ? "Çift ✓" : "Tek ✗"})`;
    },
  },
  3: {
    divisor: 3,
    title: "3 ile Bölünebilme",
    question: "3 ile TAM BÖLÜNEBİLEN sayı hangisi?",
    tip: "Rakamları toplamı 3 veya 3'ün katı olan sayılar 3 ile kalansız bölünür.",
    shortTip: "Rakamları toplamı 3'ün katı olmalı!",
    check: (n) => n % 3 === 0,
    explain: (n) => {
      const digits = String(Math.abs(n)).split("").map(Number);
      const sum = digits.reduce((a, b) => a + b, 0);
      const isDiv = sum % 3 === 0;
      return `Rakamları toplamı: ${digits.join("+")} = ${sum} (${isDiv ? "3'ün katı ✓" : "3'ün katı değil ✗"})`;
    },
  },
  4: {
    divisor: 4,
    title: "4 ile Bölünebilme",
    question: "4'e KALANSIZ BÖLÜNEN sayıya yönel!",
    tip: "Son iki basamağı '00' veya 4'ün katı olan sayılar 4 ile kalansız bölünür.",
    shortTip: "Son iki basamağı 4'ün katı (veya 00) olmalı!",
    check: (n) => n % 4 === 0,
    explain: (n) => {
      const lastTwo = Math.abs(n) % 100;
      const isDiv = lastTwo % 4 === 0;
      return `Son iki basamağı ${lastTwo.toString().padStart(2, "0")} (${isDiv ? "4'ün katı ✓" : "4'ün katı değil ✗"})`;
    },
  },
  5: {
    divisor: 5,
    title: "5 ile Bölünebilme",
    question: "5 ile TAM BÖLÜNEN sayıya çarparak hızlan!",
    tip: "Birler basamağı 0 veya 5 olan tüm sayılar 5 ile kalansız bölünür.",
    shortTip: "Son basamağı 0 veya 5 olmalı!",
    check: (n) => n % 5 === 0,
    explain: (n) => {
      const lastDigit = Math.abs(n) % 10;
      const isDiv = lastDigit === 0 || lastDigit === 5;
      return `Son basamağı ${lastDigit} (${isDiv ? "0 veya 5 ✓" : "5 ile bölünmez ✗"})`;
    },
  },
  6: {
    divisor: 6,
    title: "6 ile Bölünebilme",
    question: "6'ya TAM BÖLÜNEBİLEN sayıyı yakala!",
    tip: "Bir sayı hem 2'ye hem de 3'e kalansız bölünebiliyorsa 6'ya da tam bölünür.",
    shortTip: "Hem ÇİFT olmalı, hem de rakamları toplamı 3'ün katı olmalı!",
    check: (n) => n % 6 === 0,
    explain: (n) => {
      const isEven = n % 2 === 0;
      const sum = String(Math.abs(n)).split("").reduce((a, b) => a + Number(b), 0);
      const isSum3 = sum % 3 === 0;
      if (isEven && isSum3) return `Hem çift hem rakamlar toplamı (${sum}) 3'ün katı ✓`;
      if (!isEven) return `Çift değil (2'ye bölünmez) ✗`;
      return `Çift ama rakamları toplamı (${sum}) 3'ün katı değil ✗`;
    },
  },
  9: {
    divisor: 9,
    title: "9 ile Bölünebilme",
    question: "9 ile KALANSIZ BÖLÜNEN sayıya çarp!",
    tip: "Rakamları toplamı 9 veya 9'un katı olan sayılar 9 ile kalansız bölünür.",
    shortTip: "Rakamları toplamı 9 veya 9'un katı olmalı!",
    check: (n) => n % 9 === 0,
    explain: (n) => {
      const digits = String(Math.abs(n)).split("").map(Number);
      const sum = digits.reduce((a, b) => a + b, 0);
      const isDiv = sum % 9 === 0;
      return `Rakamları toplamı: ${digits.join("+")} = ${sum} (${isDiv ? "9'un katı ✓" : "9'un katı değil ✗"})`;
    },
  },
  10: {
    divisor: 10,
    title: "10 ile Bölünebilme",
    question: "10 ile TAM BÖLÜNEBİLEN sayıya çarp!",
    tip: "Birler basamağı 0 olan sayılar 10 ile kalansız bölünür.",
    shortTip: "Son basamağı mutlaka 0 olmalı!",
    check: (n) => n % 10 === 0,
    explain: (n) => {
      const lastDigit = Math.abs(n) % 10;
      const isDiv = lastDigit === 0;
      return `Son basamağı ${lastDigit} (${isDiv ? "0 olduğu için bölünür ✓" : "0 değil ✗"})`;
    },
  },
};

export const RULE_KEYS = [2, 3, 4, 5, 6, 9, 10];

export interface WaveQuestion {
  divisor: number;
  rule: DivisibilityRule;
  options: {
    value: number;
    isCorrect: boolean;
    explanation: string;
    lane: number; // 0, 1, 2
  }[];
  correctLane: number;
}

/**
 * Generate a valid 3-lane wave question where exactly ONE lane has the correct number
 */
export function generateWaveQuestion(previousDivisor?: number, isHardMode = false): WaveQuestion {
  // Pick random rule, prefer different from previous
  let candidates = RULE_KEYS;
  if (previousDivisor && candidates.length > 1) {
    candidates = candidates.filter((d) => d !== previousDivisor);
  }
  const divisor = candidates[Math.floor(Math.random() * candidates.length)];
  const rule = DIVISIBILITY_RULES[divisor];

  // Number range:
  // Normal mode: 2-digit to smaller 3-digit (12 to 450)
  // Hard mode: 3-digit to 4-digit (100 to 1800)
  const minVal = isHardMode ? 100 : 18;
  const maxVal = isHardMode ? 1500 : 420;

  // 1. Generate one correct number
  let correctNum = 0;
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    const mult = Math.floor(Math.random() * (Math.floor(maxVal / divisor) - Math.ceil(minVal / divisor) + 1)) + Math.ceil(minVal / divisor);
    const candidate = mult * divisor;
    if (rule.check(candidate)) {
      correctNum = candidate;
      break;
    }
  }
  if (!correctNum) correctNum = divisor * 12;

  // 2. Generate two distinct WRONG numbers
  const wrongNums: number[] = [];
  attempts = 0;
  while (wrongNums.length < 2 && attempts < 200) {
    attempts++;
    // Generate a plausible number near the correct one or plausible distractors
    // Often changing by +1, +2, or close offset so students actually have to test rule!
    const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 8) + 1);
    let candidate = correctNum + offset;
    if (candidate < minVal || candidate > maxVal) {
      candidate = Math.floor(Math.random() * (maxVal - minVal)) + minVal;
    }
    if (!rule.check(candidate) && candidate !== correctNum && !wrongNums.includes(candidate)) {
      wrongNums.push(candidate);
    }
  }

  // Fallbacks if loop exhausted
  while (wrongNums.length < 2) {
    const fallback = correctNum + wrongNums.length + 1;
    if (!rule.check(fallback) && !wrongNums.includes(fallback)) {
      wrongNums.push(fallback);
    }
  }

  // 3. Assign to 3 lanes randomly
  const correctLane = Math.floor(Math.random() * 3);
  const lanes = [0, 1, 2];
  const otherLanes = lanes.filter((l) => l !== correctLane);

  const options: WaveQuestion["options"] = [];
  options.push({
    value: correctNum,
    isCorrect: true,
    explanation: rule.explain(correctNum),
    lane: correctLane,
  });

  options.push({
    value: wrongNums[0],
    isCorrect: false,
    explanation: rule.explain(wrongNums[0]),
    lane: otherLanes[0],
  });

  options.push({
    value: wrongNums[1],
    isCorrect: false,
    explanation: rule.explain(wrongNums[1]),
    lane: otherLanes[1],
  });

  options.sort((a, b) => a.lane - b.lane);

  return {
    divisor,
    rule,
    options,
    correctLane,
  };
}
