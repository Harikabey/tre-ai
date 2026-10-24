// FILE: src/components/ModelSelectionSettings.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModelSelection, type ModelProvider } from '@/hooks/useModelSelection';
import { useLocalModel } from '@/hooks/useLocalModel';
import { useWebGPU } from '@/hooks/useWebGPU';

const modelOptions: {
  value: ModelProvider;
  title: string;
  description: string;
}[] = [
  {
    value: 'default',
    title: 'Varsayılan (Bulut)',
    description: "Tre'nin kendi altyapısı. Ücretsiz, hızlı.",
  },
  {
    value: 'byok',
    title: 'Kendi Anahtarın (BYOK)',
    description: 'Kendi Groq veya OpenRouter API anahtarını kullan.',
  },
  {
    value: 'local',
    title: 'Yerel Motor',
    description: 'Modeli cihazına indir, sohbetlerini çevrimdışı çalıştır.',
  },
];

export function ModelSelectionSettings() {
  const {
    provider,
    apiKey,
    apiProvider,
    setProvider,
    setApiKey,
    setApiProvider,
    isConfigured,
  } = useModelSelection();
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const { isSupported, browserName, errorMessage } = useWebGPU();
  const {
    isLoading: isModelLoading,
    progress,
    isReady,
    error: modelError,
    loadModel,
  } = useLocalModel();

  const handleSave = () => {
    setApiKey(keyDraft.trim());
    setProvider(provider);
    setApiProvider(apiProvider);
    toast.success('Model seçimi kaydedildi.');
  };

  const handleLoadModel = async () => {
    try {
      await loadModel();
      toast.success('Yerel model hazır.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yerel model yüklenemedi.');
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>🤖 AI Motoru</CardTitle>
        <CardDescription>Tre'nin hangi yapay zeka sağlayıcısını kullanacağını seç.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <RadioGroup
          value={provider}
          onValueChange={(value) => {
            if (value === 'default' || value === 'byok' || value === 'local') {
              setProvider(value);
            }
          }}
          className="gap-3"
          aria-label="AI motoru seçimi"
        >
          {modelOptions.map((option) => (
            <Label
              key={option.value}
              htmlFor={`model-provider-${option.value}`}
              className={`flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 ${
                option.value === 'local' && !isSupported
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer'
              }`}
            >
              <RadioGroupItem
                id={`model-provider-${option.value}`}
                value={option.value}
                disabled={option.value === 'local' && !isSupported}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        {!isSupported && (
          <Alert variant="destructive">
            <AlertTitle>{browserName} tarayıcısında yerel motor kullanılamıyor</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {provider === 'local' && isSupported && (
          <div className="space-y-3 rounded-lg border border-border/50 p-4">
            <p className="text-sm text-muted-foreground">
              Llama 3.2 1B modeli yaklaşık 600 MB boyutundadır. İndirme sırasında internet bağlantısı gerekir.
            </p>
            {isModelLoading ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Model indiriliyor ve yükleniyor…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} aria-label={`Model indirme ilerlemesi: yüzde ${progress}`} />
              </>
            ) : isReady ? (
              <p className="text-sm font-medium text-primary" role="status">Model Hazır</p>
            ) : (
              <Button type="button" onClick={() => void handleLoadModel()}>
                Modeli İndir
              </Button>
            )}
            {modelError && (
              <Alert variant="destructive">
                <AlertTitle>Model yüklenemedi</AlertTitle>
                <AlertDescription>{modelError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {provider === 'byok' && (
          <div className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="space-y-2">
              <Label htmlFor="model-api-provider">Sağlayıcı</Label>
              <Select
                value={apiProvider}
                onValueChange={(value) => {
                  if (value === 'groq' || value === 'openrouter') {
                    setApiProvider(value);
                  }
                }}
              >
                <SelectTrigger id="model-api-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-api-key">API Anahtarı</Label>
              <Input
                id="model-api-key"
                type="password"
                autoComplete="off"
                placeholder="gsk_... veya sk-or-v1-..."
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.currentTarget.value)}
              />
            </div>

            {!isConfigured && !keyDraft.trim() && (
              <Alert>
                <AlertTitle>Anahtar gerekli</AlertTitle>
                <AlertDescription>BYOK kullanmak için geçerli bir API anahtarı gir.</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTitle>Güvenlik notu</AlertTitle>
              <AlertDescription>
                API anahtarın bu cihazın localStorage alanında saklanır. Sohbet sırasında Tre sunucusu
                üzerinden seçtiğin sağlayıcıya iletilir; anahtarını yalnızca güvendiğin cihazlarda kullan.
              </AlertDescription>
            </Alert>

            <Button type="button" onClick={handleSave} disabled={!keyDraft.trim()}>
              Kaydet
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
