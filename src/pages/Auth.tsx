import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Mail, Lock, User, ArrowLeft, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { TermsOfServiceDialog } from '@/components/TermsOfServiceDialog';
import { getTranslations } from '@/utils/translations';
import { LANGUAGES } from '@/types/language';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('ai_chatbot_language') || 'tr');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = getTranslations(lang);

  const emailSchema = z.string().email(t.invalidEmailMsg);
  const passwordSchema = z.string().min(6, t.passwordTooShortMsg);

  const validateInputs = () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t.validationErrorTitle,
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  const handleLangChange = (val: string) => {
    localStorage.setItem('ai_chatbot_language', val);
    setLang(val);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      let message = t.signInFailedMsg;
      if (error.message.includes('Invalid login credentials')) {
        message = t.invalidCredentialsMsg;
      } else if (error.message.includes('Email not confirmed')) {
        message = t.emailNotConfirmedMsg;
      }
      toast({
        title: t.error,
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t.welcomeBackTitle,
        description: t.welcomeBackDesc,
      });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    if (!termsAccepted) {
      toast({
        title: t.termsRequiredTitle,
        description: t.termsRequiredDesc,
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(email, password, username);
    setIsLoading(false);

    if (error) {
      let message = t.signUpFailedMsg;
      if (error.message.includes('already registered')) {
        message = t.emailAlreadyRegisteredMsg;
      }
      toast({
        title: t.error,
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t.accountCreatedTitle,
        description: t.accountCreatedDesc,
      });
      navigate('/');
    }
  };

  // Popular languages shown in the compact selector
  const popularCodes = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'ja', 'ko', 'hi', 'nl', 'pl'];
  const popularLanguages = popularCodes
    .map((c) => LANGUAGES.find((l) => l.code === c))
    .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="absolute left-4 top-4">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>

          <div className="absolute right-4 top-4">
            <Select value={lang} onValueChange={handleLangChange}>
              <SelectTrigger
                aria-label={t.selectLanguageLabel}
                className="h-9 w-auto min-w-[110px] gap-1.5 rounded-full border-border/60 bg-background/60 px-3 text-xs"
              >
                <Globe className="h-3.5 w-3.5 opacity-70" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {popularLanguages.map((l) => (
                  <SelectItem key={l.code} value={l.code} className="text-xs">
                    {l.nativeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 mt-6">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Tre</CardTitle>
          <CardDescription>{t.authTagline}</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">{t.signInTab}</TabsTrigger>
              <TabsTrigger value="signup">{t.signUpTab}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t.emailLabel}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t.passwordLabel}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t.signingInBtn : t.signInBtn}
                  </Button>
                </div>
                <div className="text-center">
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    {t.forgotPasswordLink}
                  </Link>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">{t.usernameLabel}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder={t.usernamePlaceholder}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t.emailLabel}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t.passwordLabel}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2 mt-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    {t.termsPrefix}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      {t.termsLinkText}
                    </button>
                    {t.termsSuffix}
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                  {isLoading ? t.signingUpBtn : t.signUpBtn}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <TermsOfServiceDialog open={showTerms} onOpenChange={setShowTerms} />
    </div>
  );
};

export default Auth;
