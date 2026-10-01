// FILE: src/components/PasswordStrengthMeter.tsx
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { evaluatePassword } from '@/lib/password-utils';

interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
  showErrors?: boolean;
}

const rules = [
  { key: 'minLength', label: 'En az 6 karakter' },
  { key: 'recommendedLength', label: 'En az 12 karakter (önerilen)' },
  { key: 'hasUppercase', label: 'En az bir büyük harf' },
  { key: 'hasLowercase', label: 'En az bir küçük harf' },
  { key: 'hasNumber', label: 'En az bir rakam' },
  { key: 'hasSpecial', label: 'En az bir özel karakter (!@#$%...)' },
  { key: 'noEmailPart', label: 'E-posta adresinizi içermemeli' },
  { key: 'noCommonPatterns', label: 'Yaygın şifre kalıpları içermemeli (123456, qwerty vb.)' },
] as const;

const PasswordStrengthMeter = ({ password, email, showErrors = false }: PasswordStrengthMeterProps) => {
  const evaluation = evaluatePassword(password, email);
  const isStrong = evaluation.score >= 3 && evaluation.checks.noEmailPart && evaluation.checks.noCommonPatterns;

  return (
    <section className="space-y-3" aria-label="Şifre güvenliği">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Şifre Gücü</span>
          <span className="font-medium text-foreground">{evaluation.label}</span>
        </div>
        <div
          className="grid grid-cols-4 gap-1.5"
          role="meter"
          aria-label={`Şifre gücü: ${evaluation.label}`}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={evaluation.score}
        >
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-colors ${index < evaluation.score ? evaluation.color : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2" aria-label="Şifre kuralları">
        {rules.map((rule) => {
          const passed = password.length > 0 && evaluation.checks[rule.key];
          const Icon = passed ? CheckCircle2 : XCircle;

          return (
            <li
              key={rule.key}
              className={`flex min-w-0 items-start gap-2 ${
                passed ? 'text-green-600 dark:text-green-400' : showErrors ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="break-words">{rule.label}</span>
            </li>
          );
        })}
      </ul>

      {password.length > 0 && (
        <p
          className={`flex items-start gap-1.5 text-xs ${isStrong ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
          role="status"
        >
          {isStrong ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {isStrong ? 'Şifreniz güçlü.' : 'Şifreniz zayıf. Daha güçlü bir şifre seçin.'}
          </span>
        </p>
      )}
    </section>
  );
};

export default PasswordStrengthMeter;