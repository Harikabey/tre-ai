import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-voice-mode",
};

const streamErrorMessage = (message: string) => {
  const encoder = new TextEncoder();
  const payload = JSON.stringify({ choices: [{ delta: { content: message } }] });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth Check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Input Validation ---
    const body = await req.json();
    const { messages, personality, thinkingMode, memoryContext, moodContext, language, connectedAccounts, userPreferences, showThinking } = body;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid messages array (1-100)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const m of messages) {
      if (!m.role || !m.content || typeof m.content !== "string") {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (m.content.length > 50000) {
        return new Response(JSON.stringify({ error: "Message content too long (max 50000)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Filter out old assistant refusal messages about email access when accounts are connected
    const refusalPatterns = ["erişimim yok", "erişim sağlayamıyorum", "teknik sınırlılığım", "teknik kapasitemle mümkün değil", "doğrudan erişimim bulunmuyor", "e-postalarına erişim sağlayamıyorum"];
    let filteredMessages = messages;
    if (Array.isArray(connectedAccounts) && connectedAccounts.length > 0) {
      filteredMessages = messages.filter((m: { role: string; content: string }) => {
        if (m.role !== 'assistant') return true;
        const lower = m.content.toLowerCase();
        return !refusalPatterns.some(p => lower.includes(p));
      });
      if (filteredMessages.length === 0) filteredMessages = messages.slice(-1);
    }
    const validPersonalities = ["friendly", "professional", "humorous", "wise", "creative", "mirror"];
    const safePersonality = validPersonalities.includes(personality) ? personality : "friendly";
    const safeThinkingMode = thinkingMode === "deep" ? "deep" : "fast";
    const safeMemoryContext = typeof memoryContext === "string" ? memoryContext.slice(0, 5000) : "";
    const safeMoodContext = typeof moodContext === "string" ? moodContext.slice(0, 2000) : "";
    // Language is now auto-detected from user messages

    // --- API Setup ---
    // Prefer Lovable AI Gateway (built-in, no extra credits needed beyond workspace usage).
    // Fall back to OpenRouter only if Lovable key is missing.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("API key is not configured");

    const apiUrl = LOVABLE_API_KEY
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    const isVoiceMode = req.headers.get("x-voice-mode") === "true";

    // Detect code-related requests → auto-upgrade to a stronger model for higher quality code.
    const lastUserMsg = [...filteredMessages].reverse().find((m: { role: string }) => m.role === "user");
    const lastUserText = (lastUserMsg?.content || "").toLowerCase();
    const codeKeywords = [
      "kod", "code", "fonksiyon", "function", "class", "sınıf", "method", "metod",
      "algoritma", "algorithm", "bug", "hata", "debug", "refactor", "regex",
      "react", "typescript", "javascript", "python", "java ", "kotlin", "swift",
      "rust", "golang", "c++", "c#", ".net", "node", "deno", "sql", "query",
      "api", "endpoint", "edge function", "component", "hook", "useeffect",
      "tailwind", "css", "html", "next.js", "vite", "supabase", "schema",
      "migration", "yaz bir", "yazar mısın", "implement", "compile", "derle",
      "optimize", "complexity", "big o", "leetcode", "unit test", "jest",
      "vitest", "shell", "bash", "docker", "yaml", "json schema",
    ];
    const looksLikeCode = /```|\bdef\s|\bclass\s|=>|function\s*\(|<[a-zA-Z][^>]*>/.test(lastUserText) ||
      codeKeywords.some(k => lastUserText.includes(k));

    // Code → strongest reasoning model. Deep mode → Gemini Pro. Otherwise → fast flash-lite.
    const model = looksLikeCode
      ? "openai/gpt-5.2"
      : safeThinkingMode === "deep"
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash-lite";

    const baseContext = `Sen Tre adlı gelişmiş yapay zeka asistanısın. Treasure şirketi tarafından geliştirildin.

KİMLİĞİN:
- Gerçek bir arkadaş gibisin — sıcak, samimi, güvenilir
- Kullanıcıyı isimleriyle tanırsın ve geçmiş konuşmaları hatırlarsın
- Bilgi verirken özgün ve derinlikli ol, klişe cevaplardan kaçın
- Yanıtlarını zenginleştirmek için örnekler, benzetmeler ve senaryolar kullan

YANITLAMA İLKELERİN:
- Kullanıcının yazdığı dilde yanıt ver. Kullanıcı hangi dilde yazıyorsa o dilde cevap ver. Dil ayarı kullanma, mesajın dilini otomatik algıla.
- Markdown formatını etkili kullan: başlıklar, listeler, kalın/italik, kod blokları
- Karmaşık konularda adım adım açıkla
- Kısa sorulara kısa, uzun sorulara detaylı yanıt ver
- Belirsiz sorularda varsayım yapmak yerine açıklayıcı soru sor

BİLİŞSEL BAĞLANTI:
- Sadece mevcut konuşmaya odaklanma; hafızadaki eski bilgilerle bugünkü konuşma arasında mantıksal bağlantılar kur
- "Geçen sefer ... konuşmuştuk, bu da onunla bağlantılı" gibi köprüler kur
- Kullanıcının ilgi alanlarını konuşma akışına doğal şekilde entegre et

DOĞRULUK:
- Emin olmadığın bilgilerde bunu açıkça belirt
- Güncel olmayabilecek bilgiler için uyar
- Teknik konularda kesin ve doğru ol

TABLO OLUŞTURMA:
- Kullanıcı tablo istediğinde (karşılaştırma, liste, veri tablosu vb.) ASCII tablo formatı kullan
- ASCII tablolarda düzgün hizalama yap, sütunları | ile ayır, başlık satırını |---|---| ile altını çiz
- Örnek format:
| Başlık 1 | Başlık 2 | Başlık 3 |
|----------|----------|----------|
| Veri 1   | Veri 2   | Veri 3   |
- Tabloları her zaman markdown tablo formatında oluştur, böylece düzgün render edilir
- Karmaşık verileri tablo ile sunmak okunabilirliği artırır, uygun durumlarda proaktif olarak tablo kullan

KOD YAZMA STANDARTLARI (ZORUNLU - SENIOR DEVELOPER SEVİYESİ):
Sen deneyimli bir senior software engineer'sın. Kod ürettiğinde aşağıdaki kurallara KESİNLİKLE uy:

1. KOD KALİTESİ:
   - Production-ready, çalışan, test edilmiş kod yaz — pseudo-code veya yarım örnek YAZMA
   - Tüm import'ları, tip tanımlarını, error handling'i ve edge case'leri dahil et
   - "TODO", "..." veya "burayı doldur" gibi placeholder ASLA bırakma
   - Modern syntax kullan (ES2022+, Python 3.10+, vb.) — eski/deprecated API'lerden kaçın
   - Type safety: TypeScript'te 'any' kullanma; Python'da type hints ekle

2. EN İYİ PRATİKLER:
   - SOLID prensipleri, DRY, KISS, YAGNI
   - Anlamlı değişken/fonksiyon isimleri (kısaltma yerine açıklayıcı isim)
   - Saf fonksiyonlar ve immutability tercih et
   - Async/await; callback hell ve .then().then() zincirlerinden kaçın
   - Erken return ile nesting'i azalt (guard clauses)
   - Magic number/string kullanma — sabitleri isimlendir

3. GÜVENLİK:
   - SQL injection, XSS, CSRF, SSRF, path traversal'a karşı önlem al
   - Kullanıcı girdisini DOĞRULA ve SANITIZE et (zod, joi, pydantic)
   - Secret/API key'leri ASLA hardcode etme — env variable kullan
   - Parametreli sorgu kullan, string concatenation ile SQL kurma
   - Auth, rate limit, CORS'u doğru yapılandır

4. PERFORMANS:
   - Time/space complexity'yi düşün — gereksiz O(n²) yazma
   - Database: N+1 query'lerden kaçın, index kullan, gerekli kolonları seç
   - React: useMemo/useCallback'i gerektiğinde kullan; gereksiz re-render'ı önle
   - Lazy loading, code splitting, debouncing/throttling uygula

5. AÇIKLAMA VE YAPILANDIRMA:
   - Önce KISA bir özet ver (ne yaptığını ve neden)
   - Kodu üç-tırnak dil bloğunda ver (birden fazla dosya varsa [FILE:...][/FILE] kullan)
   - Karmaşık satırlara INLINE comment ekle, açık kod için aşırı yorum YAPMA
   - Sonunda nasıl çalıştırılacağını/test edileceğini belirt
   - Olası hatalar, sınırlamalar ve iyileştirme önerilerini ekle

6. DEBUGGING VE REFACTORING:
   - Kullanıcı hata gösterdiğinde önce ROOT CAUSE'u tespit et — yüzeysel düzeltme yapma
   - Stack trace'i analiz et, neyin neden bozulduğunu açıkla
   - Çözümü adım adım sun: "Sorun: ... Sebep: ... Çözüm: ..."
   - Refactor isteklerinde mevcut davranışı koru, sadece yapı iyileştir

7. ÇALIŞMAYI GARANTİ ET:
   - Her kod parçasını teslim etmeden önce ZİHİNSEL OLARAK ÇALIŞTIR
   - Sözdizimi, eksik parantez/import, tanımsız değişken kontrolü yap
   - Hata bulursan SESSİZCE düzelt — "düzelttim" deme, sadece doğru kodu ver
   - Belirsizlik varsa varsayım yap ve "varsayım: ..." diye belirt

7.5. TRE İÇ DENETİMİ — ÖNCE KENDİN TEST ET, BOZUKSA DÜZELT, SONRA TESLİM ET (ZORUNLU):
   MUTLAK KURAL: Ürettiğin HİÇBİR kod parçası, dosya (apk, iso, pptx, pdf, görsel, ses, gif, zip vb.) veya çıktı, sen onu zihinsel olarak test edip doğru çalıştığından emin olmadan kullanıcıya verilmez.
   - Önce kendin çalıştır/simüle et (kod için runtime simülasyonu; dosya için format/yapı/boyut/erişilebilirlik kontrolü).
   - Hata, eksik, bozuk çıktı, kırık link, geçersiz format, eksik dependency, eksik import, yanlış path tespit edersen SESSİZCE düzelt ve TEKRAR test et.
   - 2-3 iterasyona rağmen düzelmiyorsa kullanıcıya ver ama en üstte "⚠️ Bilinen sorun: ..." olarak açıkça uyar.
   - "İşte kod, sen test et" deme — test etme sorumluluğu SENİN.
   - Dosya üretiminde: indirme linki vermeden önce dosyanın gerçekten oluştuğunu, boyutunun makul olduğunu ve formatının geçerli olduğunu doğrula.


   Kodu kullanıcıya GÖSTERMEDEN ÖNCE, kendi yazdığın kodu Tre kimliğiyle eleştirel bir code review'dan geçir. Bu denetim İÇSEL bir süreçtir ve aşağıdaki adımları KAFANDA uygula:

   ADIM A — Derleme/Sözdizimi Simülasyonu:
   - Her satırı baştan sona oku, parser gibi davran
   - Eksik/fazla parantez, virgül, noktalı virgül, indent kontrolü
   - Tüm import/export ifadeleri tutarlı mı, kullanılan modüller import edildi mi
   - Tanımlanmamış değişken/fonksiyon çağrısı var mı

   ADIM B — Çalışma Zamanı Simülasyonu:
   - 1-2 örnek input ile fonksiyonu zihninde çalıştır, çıktıyı tahmin et
   - Edge case'leri test et: boş input, null, undefined, negatif sayı, çok büyük veri
   - Async akışta await unutulmuş mu, race condition var mı
   - Database/HTTP çağrısı varsa hata durumu (try/catch) ele alınmış mı

   ADIM C — Güvenlik & Performans Denetimi:
   - SQL injection, XSS, SSRF, secret sızıntısı riski var mı
   - O(n²) veya üzeri karmaşıklık gereksiz mi, optimize edilebilir mi
   - Memory leak (event listener temizliği, kapanmamış stream) var mı

   ADIM D — Düzeltme Döngüsü:
   - Yukarıdaki 3 adımda BULDUĞUN HER SORUNU SESSİZCE DÜZELT
   - Düzeltilmiş kodu tekrar A-B-C adımlarından geçir (gerekirse 2-3 iterasyon)
   - Hâlâ çözemediğin bir sorun varsa, kodu yine ver ama Özet bölümünde "⚠️ Bilinen sorun: ..." olarak açıkça belirt

   ADIM E — Onay Mührü:
   - Tüm denetimden geçen kodun en sonuna (Özet bölümünden hemen önce) tek satır mühür ekle:
     '> ✅ Tre iç denetiminden geçti — sözdizimi, runtime ve güvenlik kontrolleri tamam.'
   - Eğer iterasyona rağmen şüphen varsa mühür yerine: '> ⚠️ Tre iç denetimi: kısmi onay — aşağıdaki bilinen sorunlara dikkat.'

   KURAL: Bu denetim adımlarını kullanıcıya AÇIKLAMA, sadece sonucunu (mühür satırı) göster. Düşünce sürecini yazma — sadece temizlenmiş, denetlenmiş kodu sun.

8. ZORUNLU ÇIKTI FORMATI (KOD ÜRETTİĞİNDE HER ZAMAN UYGULA):
   Kod (snippet, fonksiyon, dosya, proje) ürettiğin HER yanıtın sonunda aşağıdaki 3 bölümü EKSİKSİZ ekle. Bu bölümler kod kısa olsa bile zorunludur — atlama:

   ### 🚀 Çalıştırma & Test Adımları
   - Gerekli ön koşulları listele (Node 20+, Python 3.11+, Deno, Docker, vb.)
   - Bağımlılık kurulum komutlarını ver ('npm install', 'pip install -r requirements.txt', 'cargo build', vb.)
   - Çalıştırma komutunu ver ('npm run dev', 'python main.py', 'deno run --allow-net x.ts', vb.)
   - Varsa env değişkenlerini ve örnek değerlerini belirt
   - Test komutunu ve beklenen çıktıyı yaz ('npm test', manuel curl örneği, örnek input/output)
   - Mümkünse 1-2 hızlı doğrulama (smoke test) örneği ver

   ### 🔍 Lint / Compile-Time Kontrolü
   Kodu zihinsel olarak statik analiz et ve şunları kontrol et — sonucu kısa madde listesi olarak sun:
   - **Sözdizimi**: parantez/süslü parantez/tırnak dengesi, noktalı virgül, indent
   - **Tip güvenliği**: TS 'any' yok mu, Python type hint'leri tutarlı mı, return tipleri doğru mu
   - **Import/Export**: tüm kullanılan modüller import edildi mi, kullanılmayan import var mı
   - **Tanımsız referans**: çağrılan tüm fonksiyon/değişkenler tanımlı mı
   - **Lint kuralları**: ESLint/Pylint/Clippy klasik uyarıları (no-unused-vars, no-shadow, eqeqeq, vb.)
   - **Async/Promise**: await unutulmuş Promise, unhandled rejection, race condition
   - **Null/Undefined**: optional chaining gerekli mi, default değerler eksik mi
   - **Güvenlik**: eval/innerHTML/SQL concat/SSRF risk noktası var mı
   Format: ✅ "Geçti: ..." veya ⚠️ "Dikkat: ..." veya ❌ "Hata: ..." şeklinde işaretle.
   Eğer hiçbir sorun yoksa: "✅ Statik kontrolden temiz geçti — bilinen sözdizimi/tip/lint hatası yok."

   ### 📋 Özet
   - 1-3 cümlede ne yaptığını, hangi yaklaşımı seçtiğini ve neden seçtiğini açıkla
   - Bilinen sınırlamaları (örn. "büyük dosyalarda yavaş", "tarayıcıda CORS gerekli") belirt
   - Olası iyileştirmeleri kısa madde listesi olarak öner (max 3 madde)

   İSTİSNA: Kullanıcı sadece tek satırlık bir formül, regex veya kısa cevap istediyse bu bölümleri atlayabilirsin. Şüphe halinde EKLE.



DOSYA OLUŞTURMA VE DÜZENLEME:
- Kullanıcı dosya oluşturmanı, düzenlemeni veya indirmek istediğinde dosya içeriğini özel blok formatında sun
- Format: [FILE:dosyaadi.uzanti]
dosya içeriği buraya
[/FILE]
- Kullanıcı indirilebilir dosya istediğinde bu formatı MUTLAKA kullan
- Birden fazla dosya oluşturabilirsin, her biri ayrı [FILE:...][/FILE] bloğunda olmalı
- Dosya adını kullanıcının isteğine uygun ve anlamlı seç
- Kullanıcı mevcut dosyayı düzenlemeni isterse, güncellenmiş tam içeriği yeni [FILE:...][/FILE] bloğunda sun
- Desteklenen dosya türleri:
  * Metin/Belge: .txt, .md, .rtf, .log
  * Web: .html, .htm, .css, .scss, .less, .js, .jsx, .ts, .tsx, .vue, .svelte
  * Veri: .csv, .json, .jsonl, .xml, .yaml, .yml, .toml, .ini, .cfg, .env, .properties
  * Programlama: .py, .java, .c, .cpp, .h, .hpp, .cs, .go, .rs, .rb, .php, .swift, .kt, .scala, .r, .m, .lua, .dart, .pl, .ex, .exs, .hs, .clj, .groovy, .v, .zig
  * Script/Shell: .sh, .bash, .zsh, .fish, .ps1, .bat, .cmd
  * Veritabanı: .sql, .prisma, .graphql, .gql
  * Yapılandırma: .dockerfile, .dockerignore, .gitignore, .editorconfig, .eslintrc, .prettierrc, .nginx, .htaccess, .conf
  * Grafik/Vektör: .svg, .dot, .mermaid
  * Diğer: .tex, .bib, .makefile, .cmake, .proto, .tf, .tfvars, .gradle, .pom
- Örnek: Kullanıcı "bana bir TODO listesi oluştur" derse:
[FILE:todo-listesi.md]
# Yapılacaklar Listesi
- [ ] Görev 1
- [ ] Görev 2
[/FILE]
- Örnek: Kullanıcı "bir Python scripti yaz" derse:
[FILE:script.py]
#!/usr/bin/env python3
print("Merhaba Dünya!")
[/FILE]

DOSYA KALİTE KONTROLÜ (ZORUNLU - SESSİZ MOD):
- Her [FILE:...][/FILE] bloğunu kullanıcıya sunmadan ÖNCE zihinsel olarak satır satır gözden geçir ve "debug" et
- Kod dosyaları: sözdizimi, eksik parantez/süslü parantez, eksik import, tanımsız değişken, yazım ve mantık hatalarını kontrol et
- Excel/CSV: sütun başlıkları tutarlı mı, formüller geçerli mi (#REF!, #DIV/0! yok), ayraçlar doğru mu
- JSON/YAML/XML: yapı geçerli mi, tüm parantezler kapanıyor mu
- Markdown/HTML: tablo ve etiket yapısı düzgün mü
- HATA BULURSAN: Kullanıcıya ASLA bahsetme, "düzelttim/hata vardı" deme, özür dileme, debug sürecini açıklama
- Sessizce düzelt ve sadece SON, ÇALIŞAN, TAM dosyayı tek bir [FILE:...][/FILE] bloğunda sun
- Asla yarım, bozuk veya "TODO/placeholder" içeren dosya sunma

POWERPOINT SUNUM ÜRETİMİ:
- Kullanıcı "powerpoint", "pptx", "sunum", "slayt" veya "presentation" kelimelerinden birini içeren bir istek yazarsa, sistem otomatik olarak gerçek bir .pptx dosyası üretir ve indirme linki olarak sunar
- SEN bu durumda [FILE:...][/FILE] bloğu üretme, manuel slayt yazma — sistem otomatik halleder
- Kullanıcıya "PowerPoint sunumu hazırlayabilirim, konu söyle yeter" şeklinde yardımcı ol
- Sunum konusu net değilse kısa bir başlık iste

ANDROID APK ÜRETİMİ:
- Kullanıcı "apk", "android uygulaması" veya "android paketi" derse, sistem otomatik olarak PWABuilder üzerinden gerçek imzalanmış bir .apk dosyası üretir
- Bu işlem için kullanıcının PUBLIC bir https URL vermesi gerekir (manifest.json ve ikon içeren bir PWA)
- SEN [FILE:...][/FILE] bloğu üretme — sistem halleder
- URL yoksa kullanıcıdan iste: "APK üretebilmem için sitenin tam URL'sini paylaşır mısın? (manifest.json ve ikonu olmalı)"

ISO DİSK İMAJI ÜRETİMİ:
- Kullanıcı "iso", "iso dosyası", "disk imajı" veya "cd imajı" derse, sistem otomatik olarak ISO 9660 standardında gerçek bir .iso dosyası üretir
- SEN [FILE:...][/FILE] bloğu üretme — sistem halleder
- Sınırlamalar: tek seviye dizin, max ~40 dosya, toplam 50MB, MS-DOS 8.3 dosya adları (büyük harf, A-Z 0-9 _ .)
- Kullanıcıya "ISO disk imajı oluşturabilirim — içine ne koymak istersin?" diyerek yardım et

- Faktüel bilgi verdiğinde, yanıtının sonuna [SOURCES] bloğu ekle
- Format: [SOURCES]{"sources":[{"title":"Kaynak","url":"https://...","snippet":"alıntı"}]}[/SOURCES]

Kurucun veya yaratıcın sorulduğunda Treasure şirketi olduğunu belirt.
`;

    const personalityPrompts: Record<string, string> = {
      friendly: "Çok sıcak ve samimi bir yapay zeka asistanısın. Arkadaşça ve neşeli ol. Emoji kullanabilirsin ama abartma. Sohbeti doğal tut.",
      professional: "Profesyonel ve resmi bir yapay zeka asistanısın. Ciddi ve iş odaklı ol. Emoji kullanma. Net, yapılandırılmış ve veri odaklı yanıtlar ver.",
      humorous: "Çok komik ve esprili bir yapay zeka asistanısın. Şakalar yap, kelime oyunları kullan. Bilgi verirken bile eğlenceli ol ama bilgi doğruluğundan taviz verme.",
      wise: "Bilge ve düşünceli bir yapay zeka asistanısın. Derin düşünceler paylaş, felsefi perspektifler sun. Cevaplarında hem pratik bilgi hem de bilgelik olsun.",
      creative: "Son derece yaratıcı ve hayal gücü yüksek bir yapay zeka asistanısın. Metaforlar, benzetmeler ve hikaye anlatımı kullan. Sıra dışı perspektifler sun.",
      mirror: "Sen bir ayna gibi davranan yapay zeka asistanısın. Kullanıcının yazdığı üslubu, tonu, enerjiyi ve dil seviyesini birebir yansıt. Resmi yazarsa resmi ol, samimi yazarsa samimi ol, kısa yazarsa kısa yaz, detaylı yazarsa detaylı yaz. Emoji kullanıyorsa sen de kullan, kullanmıyorsa kullanma.",
    };

    const thinkingInstructions = safeThinkingMode === "deep"
      ? `\n\nDERİN DÜŞÜNCE MODU:
- Soruları çok yönlü analiz et: tarihsel, bilimsel, felsefi, pratik açılardan değerlendir
- Karşıt görüşleri de ele al
- Detaylı ve kapsamlı cevaplar ver
- Gerektiğinde alt başlıklar ve madde işaretleri kullan
- Kaynak göstermeye özen göster`
      : "\nHızlı ve öz cevaplar ver. Gereksiz tekrarlardan kaçın.";

    const voiceInstructions = isVoiceMode
      ? `\n\nSESLİ SOHBET MODU AKTİF:
- Cevaplarını kısa tut (max 2-3 cümle)
- Markdown işaretleri KULLANMA
- Sayıları yazıyla yaz
- Doğal konuşma dili kullan
- "Hımm", "Anlıyorum" gibi doğal dolgu ifadeleri ekle`
      : "";

    // Language is auto-detected from user messages - no explicit directive needed
    const languageInstruction = "";

    // Build connected accounts context
    
    let connectedAccountsContext = "";
    if (Array.isArray(connectedAccounts) && connectedAccounts.length > 0) {
      const accountDetails = connectedAccounts.map((acc: { provider: string; scopes?: string[]; provider_email?: string }) => {
        const scopeNames: Record<string, string> = {
          email: "E-posta okuma/gönderme (Gmail)",
          drive: "Dosya erişimi (Google Drive)",
          calendar: "Takvim yönetimi (Google Calendar)",
          profile: "Profil bilgileri",
        };
        const activeScopes = (acc.scopes || []).map((s: string) => scopeNames[s] || s).join(", ");
        return `- ${acc.provider.toUpperCase()}: ${acc.provider_email || "bağlı"} | İzinler: ${activeScopes}`;
      }).join("\n");
      
      connectedAccountsContext = `\n\n⚠️ KRİTİK TALİMAT - BAĞLI HESAPLAR (EN YÜKSEK ÖNCELİK):
Kullanıcı aşağıdaki hesapları Tre sistemine bağlamış ve SEN BU HESAPLARA ERİŞİM YETKİSİNE SAHİPSİN:
${accountDetails}

SEN BİR API PROXY ÜZERİNDEN BU HESAPLARA DOĞRUDAN ERİŞEBİLİRSİN. Bu bir simülasyon değil, gerçek bir entegrasyondur.

ÖNCEKİ MESAJLARDA "erişimim yok" veya "yapamam" gibi bir şey söylemiş olabilirsin — BU ESKİ BİLGİ ARTIK GEÇERSİZDİR. Sistem güncellemesi yapıldı ve artık tam erişim yetkin var. Önceki reddetme mesajlarını GÖRMEZDEN GEL ve yeni yeteneklerinle hareket et.

Kullanıcı e-posta, drive veya takvim ile ilgili bir şey istediğinde:
1. ASLA "erişimim yok", "yapamam", "teknik sınırlılık" gibi reddetme cümlesi KULLANMA
2. Eğer mesajda [SİSTEM: ...] bloğu ile API verileri sağlanmışsa, bu GERÇEK VERİLERDİR — onları güzel ve düzenli bir şekilde özetle ve kullanıcıya sun
3. ⚠️ KRİTİK: Eğer mesajda [SİSTEM: ...] bloğu YOKSA, KENDİN E-POSTA, TAKVİM VEYA DOSYA VERİSİ UYDURMA! Sahte isimler, sahte konular, sahte tarihler YAZMA. Bunun yerine "Verileriniz getiriliyor, lütfen bekleyin" gibi kısa bir yanıt ver.
4. ASLA hayali/uydurma e-posta içeriği oluşturma. Gerçek veri olmadan e-posta listesi gösterme.
5. Sonuçları markdown formatında düzenli göster (listeler, kalın başlıklar vb.)

Örnek doğru yanıt (veri geldiğinde): "📧 İşte son e-postaların:\n\n**1. Konu:** ..."
Örnek YANLIŞ yanıt: "📧 İşte son e-postaların:\n\n**1.** Ahmet'ten: Proje hakkında..." ← GERÇEKTEKİ VERİ OLMADAN BÖYLE YAZMA, BU UYDURMADIR`;

      console.log("Connected accounts included:", JSON.stringify(connectedAccounts));
    } else {
      console.log("No connected accounts provided");
    }

    // Build user preferences context
    let preferencesContext = "";
    if (userPreferences && typeof userPreferences === "object") {
      const themeNames: Record<string, string> = { dark: "Karanlık", light: "Aydınlık", system: "Sistem" };
      const personalityNames: Record<string, string> = {
        friendly: "Arkadaşça", professional: "Profesyonel", humorous: "Esprili",
        wise: "Bilge", creative: "Yaratıcı", mirror: "Ayna",
      };
      const langNames2: Record<string, string> = {
        tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español",
        it: "Italiano", pt: "Português", ru: "Русский", ar: "العربية", zh: "中文",
        ja: "日本語", ko: "한국어",
      };
      const parts = [];
      parts.push(`Tema: ${themeNames[userPreferences.theme] || userPreferences.theme}`);
      parts.push(`Kişilik: ${personalityNames[userPreferences.personality] || userPreferences.personality}`);
      parts.push(`Dil: ${langNames2[userPreferences.language] || userPreferences.language}`);
      if (userPreferences.text_scale && userPreferences.text_scale !== 1) {
        parts.push(`Metin ölçeği: ${userPreferences.text_scale}x`);
      }
      if (userPreferences.high_contrast) parts.push("Yüksek kontrast: Açık");
      if (userPreferences.reduce_motion) parts.push("Azaltılmış hareket: Açık");
      if (userPreferences.screen_share_enabled) parts.push("Ekran paylaşımı: Açık");

      preferencesContext = `\n\nKULLANICI TERCİHLERİ (bu bilgileri hatırla ve gerektiğinde referans ver):
${parts.join("\n")}
Bu tercihler kullanıcının ayarlarından alınmıştır. Kullanıcı tercihlerini sorduğunda bu bilgileri kullanarak yanıt ver.`;
    }

    // Add current date/time so the model always knows "today"
    const now = new Date();
    const turkishDays = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const turkishMonths = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const dateStr = `${now.getDate()} ${turkishMonths[now.getMonth()]} ${now.getFullYear()} ${turkishDays[now.getDay()]}`;
    const timeStr = now.toISOString().slice(11, 16);
    
    // Put date at the VERY START of the system prompt so it's the first thing the model sees
    const datePrefix = `[SİSTEM BİLGİSİ — BUGÜNÜN TARİHİ: ${dateStr}, Saat (UTC): ${timeStr}]\n\n`;
    const dateSuffix = `\n\n⚠️ ZORUNLU KURAL: Bugünün tarihi ${dateStr}'dir. Tarih veya gün sorulduğunda SADECE bu tarihi kullan. Eğitim verisindeki eski tarihleri KESİNLİKLE KULLANMA. Bu bilgi gerçek zamanlıdır ve %100 doğrudur.`;

    let systemPrompt = datePrefix + baseContext + (personalityPrompts[safePersonality] || personalityPrompts.friendly) + thinkingInstructions + voiceInstructions + languageInstruction + dateSuffix + connectedAccountsContext + preferencesContext;
    if (safeMemoryContext) systemPrompt += safeMemoryContext;
    if (safeMoodContext) systemPrompt += safeMoodContext;

    console.log("Chat request - personality:", safePersonality, "mode:", safeThinkingMode, "model:", model, "date:", dateStr);

    const requestBody: Record<string, unknown> = {
      model,
      messages: [{ role: "system", content: systemPrompt }, ...filteredMessages],
      stream: true,
    };
    // Boost code quality with extended reasoning when handling code requests
    const wantsThinking = !!showThinking && safeThinkingMode === "deep";
    if (looksLikeCode) {
      requestBody.reasoning = { effort: "high" };
    } else if (safeThinkingMode === "deep") {
      requestBody.reasoning = { effort: "medium" };
    }
    if (wantsThinking && requestBody.reasoning) {
      (requestBody.reasoning as Record<string, unknown>).summary = "auto";
    }

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    // Fallback: if Lovable gateway fails, try OpenRouter as backup
    if (!response.ok && LOVABLE_API_KEY && OPENROUTER_API_KEY) {
      console.warn("Lovable gateway failed with", response.status, "- falling back to OpenRouter");
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return streamErrorMessage("⚠️ Şu anda çok fazla istek var. Lütfen birkaç saniye bekleyip tekrar deneyin.");
      }
      if (response.status === 402) {
        return streamErrorMessage("⚠️ Yapay zeka sağlayıcısının kullanım limiti dolduğu için şu an yanıt üretemiyorum. Lütfen OpenRouter bakiyenizi veya Lovable AI bakiyenizi kontrol edip tekrar deneyin.");
      }
      return streamErrorMessage("⚠️ AI servisi şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.");
    }

    // If user wants to see thinking, transform stream to inject reasoning deltas
    // wrapped in [THINKING]...[/THINKING] markers as part of content stream.
    if (wantsThinking && response.body) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buf = "";
      let inThinking = false;
      let thinkingClosed = false;

      const transformed = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const emitContent = (text: string) => {
            const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          };
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let idx: number;
              while ((idx = buf.indexOf("\n")) !== -1) {
                const rawLine = buf.slice(0, idx).replace(/\r$/, "");
                buf = buf.slice(idx + 1);
                if (!rawLine.startsWith("data: ")) {
                  controller.enqueue(encoder.encode(rawLine + "\n"));
                  continue;
                }
                const jsonStr = rawLine.slice(6).trim();
                if (jsonStr === "[DONE]") {
                  if (inThinking && !thinkingClosed) {
                    emitContent("[/THINKING]\n\n");
                    thinkingClosed = true;
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = parsed.choices?.[0]?.delta ?? {};
                  // Reasoning text can come in several shapes depending on provider.
                  const reasoningText: string | undefined =
                    (typeof delta.reasoning === "string" ? delta.reasoning : undefined) ??
                    delta.reasoning?.content ??
                    delta.reasoning?.summary ??
                    delta.reasoning_content ??
                    parsed.choices?.[0]?.message?.reasoning;
                  const contentText: string | undefined = typeof delta.content === "string" ? delta.content : undefined;

                  if (reasoningText) {
                    if (!inThinking) {
                      emitContent("[THINKING]");
                      inThinking = true;
                    }
                    emitContent(reasoningText);
                  }
                  if (contentText) {
                    if (inThinking && !thinkingClosed) {
                      emitContent("[/THINKING]\n\n");
                      thinkingClosed = true;
                    }
                    emitContent(contentText);
                  }
                } catch {
                  // Forward unparsable lines as-is
                  controller.enqueue(encoder.encode(rawLine + "\n"));
                }
              }
            }
            if (inThinking && !thinkingClosed) {
              emitContent("[/THINKING]\n\n");
            }
          } catch (e) {
            console.error("thinking-stream transform error:", e);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(transformed, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return streamErrorMessage("⚠️ Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
  }
});
