# TreOS Terminal

TreOS Terminal, Textual tabanlı bir terminal sohbet uygulamasıdır. Doğal dildeki istekleri Groq veya OpenRouter'a gönderir, önerilen işlemleri onayınızdan önce listeler ve yalnızca `y` onayıyla çalıştırır.

## Kurulum

```bash
pip install -r requirements.txt
```

## Çalıştırma

```bash
python main.py
```

İlk açılışta API anahtarınızı ve sağlayıcınızı seçin.

## Windows EXE derleme

```bash
pip install pyinstaller
pyinstaller --onefile --name treos-terminal main.py
```

Üretilen dosya `dist/treos-terminal.exe` konumundadır.

## API anahtarı

Anahtar ve sağlayıcı `~/.treos/config.json` dosyasında saklanır; Unix sistemlerinde dosya izinleri `600` olarak ayarlanır. OpenRouter modelini değiştirmek için yapılandırma dosyasına `"model": "sağlayıcı/model"` alanı ekleyebilirsiniz. Anahtar uygulama koduna gömülmez ve TreOS sunucusuna gönderilmez; seçtiğiniz model sağlayıcısına API isteğiyle gönderilir.

Kaydedilmiş anahtarı silmek için:

```bash
python main.py --reset-key
```

## Güvenlik

Önerilen her işlem çalıştırılmadan önce listelenir ve açık `y` onayı gerekir. Kara listedeki bazı tehlikeli komutlar ve sistem dizinlerine yazma girişimleri reddedilir. Bu kontroller tüm riskleri yakalayamaz; komutları onaylamadan önce dikkatlice inceleyin. API anahtarınızı paylaşmayın.

## Kurulum rehberi

[Kurulum rehberini görüntüleyin](docs/terminal-kurulum.md).
