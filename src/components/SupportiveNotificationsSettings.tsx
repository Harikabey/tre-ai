import { Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useSupportiveNotifications,
  type SupportiveNotificationType,
} from '@/hooks/useSupportiveNotifications';

interface SupportiveNotificationsSettingsProps {
  canSendNotifications: boolean;
}

const notificationTypes: {
  key: SupportiveNotificationType;
  title: string;
  description: string;
}[] = [
  {
    key: 'streakReminder',
    title: '🔥 Seri Hatırlatıcı',
    description: 'Serin tehlikedeyse nazik bir hatırlatma alırsın. Günde en fazla 1 kez.',
  },
  {
    key: 'missYou',
    title: '💭 Seni Özledim',
    description: "2 gün boyunca Tre'ye girmezsen, Tre seni özler ve hatırlatır.",
  },
  {
    key: 'journey',
    title: '🚀 Yolculuk',
    description: "Mesaj sayın arttıkça Tre seni motive eder. 'X mesajlık yolculuk, devam edelim mi?'",
  },
  {
    key: 'socialProof',
    title: '📊 İlerleme Raporu',
    description: 'Haftalık mesaj sayını gösterir, geçen haftayla karşılaştırır.',
  },
  {
    key: 'curiosity',
    title: '🔍 Merak',
    description: 'Tre bazen bir konuyu merak eder ve seninle konuşmak ister.',
  },
  {
    key: 'easterEgg',
    title: '🥚 Gizli Sürprizler',
    description: 'Bazı gizli kodlar yazdığında sürpriz mesajlar alırsın.',
  },
];

export function SupportiveNotificationsSettings({ canSendNotifications }: SupportiveNotificationsSettingsProps) {
  const { settings, updateSetting, toggleMaster } = useSupportiveNotifications();
  const childrenDisabled = !settings.masterEnabled || !canSendNotifications;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>💬 Destekleyici Bildirimler</CardTitle>
        <CardDescription>
          Tre'nin seni motive etmesi için nazik hatırlatmalar. İstediğin zaman kapatabilirsin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!canSendNotifications && (
          <p className="text-sm text-destructive" role="status">
            Destekleyici bildirimleri yönetmek için önce Bildirimler bölümünden bildirim izni vermen gerekir.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div className="min-w-0">
            <Label htmlFor="supportive-master" className="text-sm font-medium text-foreground">
              Tüm Destekleyici Bildirimler
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Tüm destekleyici bildirim türlerini birlikte açıp kapatır.
            </p>
          </div>
          <Switch
            id="supportive-master"
            checked={settings.masterEnabled}
            onCheckedChange={toggleMaster}
            disabled={!canSendNotifications}
            aria-label="Tüm Destekleyici Bildirimler"
          />
        </div>

        <div className="space-y-1">
          {notificationTypes.map(({ key, title, description }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg p-3">
              <div className="min-w-0">
                <Label htmlFor={`supportive-${key}`} className="text-sm font-medium text-foreground">
                  {title}
                </Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <Switch
                id={`supportive-${key}`}
                checked={settings[key]}
                onCheckedChange={(checked) => updateSetting(key, checked)}
                disabled={childrenDisabled}
                aria-label={title}
              />
            </div>
          ))}
        </div>

        <Separator />

        <section className="space-y-3" aria-labelledby="quiet-hours-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label id="quiet-hours-title" htmlFor="quiet-hours-enabled" className="text-sm font-medium text-foreground">
                🌙 Sessiz Saatler
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu saatler arasında hiçbir destekleyici bildirim gelmez.
              </p>
            </div>
            <Switch
              id="quiet-hours-enabled"
              checked={settings.quietHoursEnabled}
              onCheckedChange={(checked) => updateSetting('quietHoursEnabled', checked)}
              disabled={childrenDisabled}
              aria-label="Sessiz Saatleri Etkinleştir"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-start">Başlangıç</Label>
              <Input
                id="quiet-hours-start"
                type="time"
                value={settings.quietHoursStart}
                onChange={(event) => updateSetting('quietHoursStart', event.currentTarget.value)}
                disabled={childrenDisabled || !settings.quietHoursEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-end">Bitiş</Label>
              <Input
                id="quiet-hours-end"
                type="time"
                value={settings.quietHoursEnd}
                onChange={(event) => updateSetting('quietHoursEnd', event.currentTarget.value)}
                disabled={childrenDisabled || !settings.quietHoursEnabled}
              />
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-2" aria-labelledby="daily-limit-title">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Label id="daily-limit-title" htmlFor="supportive-daily-limit" className="text-sm font-medium text-foreground">
                Günlük Bildirim Limiti
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Günde en fazla kaç destekleyici bildirim almak istersin?
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Günlük bildirim limiti hakkında bilgi"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Değer 1 ile 10 arasında olmalıdır.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="supportive-daily-limit"
            type="number"
            min={1}
            max={10}
            step={1}
            value={settings.dailyLimit}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) updateSetting('dailyLimit', value);
            }}
            disabled={childrenDisabled}
            className="max-w-32"
          />
        </section>

        <p className="text-xs text-muted-foreground">
          Tüm bildirimler için cihaz ayarlarından izin vermen gerekir.
        </p>
      </CardContent>
    </Card>
  );
}
