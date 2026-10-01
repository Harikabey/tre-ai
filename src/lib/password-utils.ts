// FILE: src/lib/password-utils.ts
export interface PasswordChecks {
  minLength: boolean;
  recommendedLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  noEmailPart: boolean;
  noCommonPatterns: boolean;
}

export interface PasswordEvaluation {
  score: number;
  label: string;
  color: string;
  checks: PasswordChecks;
}

const commonPatterns = [
  '123456',
  'qwerty',
  'asdfgh',
  'password',
  'admin',
  'fenerbahce',
  'istanbul',
];

export const evaluatePassword = (password: string, email?: string): PasswordEvaluation => {
  const emailPart = email?.split('@')[0]?.trim().toLowerCase() ?? '';
  const normalizedPassword = password.toLowerCase();
  const checks: PasswordChecks = {
    minLength: password.length >= 6,
    recommendedLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+=\x5b\x5d{};':"\\|,.<>/?-]/.test(password),
    noEmailPart: !emailPart || !normalizedPassword.includes(emailPart),
    noCommonPatterns: !commonPatterns.some((pattern) => normalizedPassword.includes(pattern)),
  };

  const strengthChecks = [
    checks.recommendedLength,
    checks.hasUppercase,
    checks.hasLowercase,
    checks.hasNumber,
    checks.hasSpecial,
  ];
  const passedStrengthChecks = strengthChecks.filter(Boolean).length;
  let score = checks.minLength
    ? Math.max(1, passedStrengthChecks === 5 ? 4 : Math.min(passedStrengthChecks, 3))
    : 0;

  if (!checks.noEmailPart || !checks.noCommonPatterns) score = Math.min(score, 1);

  const labels = ['Çok Zayıf', 'Zayıf', 'Orta', 'Güçlü', 'Çok Güçlü'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];

  return {
    score,
    label: labels[score],
    color: colors[score],
    checks,
  };
};

export const isPasswordAcceptable = (evaluation: PasswordEvaluation): boolean =>
  evaluation.checks.minLength &&
  evaluation.checks.noEmailPart &&
  evaluation.checks.noCommonPatterns;