// FILE: src/components/ModelSelectionSettings.tsx
import { useEffect, useState } from 'react';
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
import { LOCAL_MODELS, useLocalModel, type LocalModelId } from '@/hooks/useLocalModel';
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
    selectedModelId,
    isLoading: isModelLoading,
    progress,
    isReady,
    error: modelError,
    isCacheChecking,
    isModelCached,
    isLoadingFromCache,
    cacheError,
    loadModel,
    downloadModel,
    clearCacheAndReloadModel,
  } = useLocalModel();

  useEffect(() => {
    if (
      provider === 'local' &&
      isModelCached &&
      !isReady &&
      !isModelLoading &&
      !modelError
    ) {
      void loadModel().catch((error: unknown) => {
        console.error('Önbellekteki yerel model yüklenemedi:', error);
      });
    }
  }, [provider, isModelCached, isReady, isModelLoading, modelError, loadModel]);

  const handleSave = () => {
    setApiKey(keyDraft.trim());
    setProvider(provider);
    setApiProvider(apiProvider);
    toast.success('Model seçimi kaydedildi.');
  };

  const handleLoadModel = async (modelId: LocalModelId) => {
    try {
      await downloadModel(modelId);
      toast.success('Yerel model hazır.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yerel model yüklenemedi.');
    }
  };

  const handleReloadModel = async () => {
    try {
      await clearCacheAndReloadModel();
      toast.success('Yerel model yeniden indirildi ve hazır.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yerel model yeniden indirilemedi.');
    }
  };

  return (
    <>
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              İndirmek istediğin yerel metin modelini seç. İlk indirme sırasında internet bağlantısı gerekir.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LOCAL_MODELS.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <Card
                    key={model.id}
                    className={`border-border/50 bg-secondary/20 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  >
                    <CardHeader className="space-y-1 p-4">
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      <CardDescription className="font-medium">{model.size}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0">
                      <p className="min-h-10 text-sm text-muted-foreground">{model.description}</p>
                      {isSelected && isModelLoading ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>
                              {isLoadingFromCache
                                ? 'Model önbellekten yükleniyor…'
                                : 'Model indiriliyor ve yükleniyor…'}
                            </span>
                            <span>{progress}%</span>
                          </div>
                          <Progress
                            value={progress}
                            aria-label={`Model indirme ilerlemesi: yüzde ${progress}`}
                          />
                        </div>
                      ) : isSelected && isReady ? (
                        <p className="text-sm font-medium text-primary" role="status">Model Hazır</p>
                      ) : isSelected && (isCacheChecking || (isModelCached === null && !cacheError)) ? (
                        <p className="text-sm text-muted-foreground" role="status">
                          Model önbelleği kontrol ediliyor…
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        className="w-full"
                        disabled={isModelLoading || isCacheChecking}
                        onClick={() => void handleLoadModel(model.id)}
                      >
                        {isSelected && isReady ? 'Hazır' : isSelected && isModelCached ? 'Yükle' : 'İndir'}
                      </Button>
                      {isSelected && isModelCached && !isModelLoading && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => void handleReloadModel()}
                        >
                          Önbelleği temizle ve yeniden indir
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {isModelCached === false && !isCacheChecking && (
              <Alert>
                <AlertTitle>Yerel model önbellekte bulunamadı</AlertTitle>
                <AlertDescription>
                  Bu tarayıcıda seçili model kayıtlı değil. Modeli kullanmak için yeniden indirebilirsin.
                </AlertDescription>
              </Alert>
            )}
            {cacheError && (
              <Alert variant="destructive">
                <AlertTitle>Model önbelleği kontrol edilemedi</AlertTitle>
                <AlertDescription>{cacheError}</AlertDescription>
              </Alert>
            )}
            {modelError && (
              <Alert variant="destructive">
                <AlertTitle>
                  {isModelCached ? 'Önbellekteki model yüklenemedi' : 'Model yüklenemedi'}
                </AlertTitle>
                <AlertDescription>
                  {isModelCached
                    ? 'Model verileri bozulmuş olabilir. Önbelleği temizleyip yeniden indirmeyi deneyebilirsin. '
                    : ''}
                  {modelError}
                </AlertDescription>
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
                kullanılmadan doğrudan seçtiğin sağlayıcıya iletilir; anahtarını yalnızca güvendiğin cihazlarda kullan.
              </AlertDescription>
            </Alert>

            <Button type="button" onClick={handleSave} disabled={!keyDraft.trim()}>
              Kaydet
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
    <Card className="mt-4 border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>🖼️ Görsel Motoru</CardTitle>
        <CardDescription>Görsel üretimi, yerel metin modelinden ayrı bir motordur.</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTitle>WebLLM görsel üretemez</AlertTitle>
          <AlertDescription>
            Buradaki Qwen3 seçeneği de dahil olmak üzere yerel WebLLM modelleri metin sohbeti içindir.
            Görsel üretimi için ayrı bir görsel motoru gerekir; bu ayar yerel metin modeli seçiminden bağımsızdır.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
    </>
  );
}
