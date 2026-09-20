import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface TermsOfServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TermsOfServiceDialog = ({ open, onOpenChange }: TermsOfServiceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">Tre Kullanım Sözleşmesi</DialogTitle>
          <DialogDescription>Son güncelleme: 20 Eylül 2026</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">1. Genel Hükümler</h3>
              <p>
                Bu Kullanım Sözleşmesi ("Sözleşme"), Tre yapay zeka asistanı hizmetini ("Hizmet") kullanmanız için geçerli olan şartları ve koşulları belirler. Hizmete kaydolarak veya Hizmeti kullanarak, bu Sözleşmenin tüm hükümlerini okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan ve taahhüt edersiniz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">2. Hizmet Tanımı</h3>
              <p>
                Tre, Tre Geliştirici Ekibi tarafından geliştirilen yapay zeka destekli çok yönlü bir asistandır. Hizmet aşağıdaki başlıca özellikleri sunar:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
                <li>Metin tabanlı sohbet ve 6 farklı kişilik modu (Arkadaş Canlısı, Profesyonel, Eğlenceli, Bilge, Yaratıcı, Ayna),</li>
                <li>Hızlı ve Derin düşünme modları,</li>
                <li>Görsel üretme, GIF üretme, görsel/PDF/video analizi,</li>
                <li>Canlı kamera analizi ve ekran paylaşımı analizi,</li>
                <li>70+ formatta belge okuma, özetleme ve soru-cevap,</li>
                <li>Web arama ve kaynak (citation) gösterimi,</li>
                <li>114 dil desteği ve mesaj bazında çeviri,</li>
                <li>Sesli sohbet (STT/TTS), tam ekran sesli mod ve "Hey Tre" uyandırma sözcüğü,</li>
                <li>Doğal dille hatırlatıcı kurma ve push bildirimle hatırlatma,</li>
                <li>Google (Gmail/Drive) gibi üçüncü taraf hesap bağlantıları,</li>
                <li>Kişisel hafıza, duygu analizi ve iyileştirme modu,</li>
                <li>APK, ISO, PPTX, ses dosyası üretimi ve sohbeti PDF olarak dışa aktarma,</li>
                <li>Tema, yazı ölçeği, yüksek kontrast, animasyon azaltma ve çoklu dil arayüz.</li>
              </ul>
              <p className="mt-2">Hizmet "olduğu gibi" sunulmakta olup herhangi bir garanti verilmemektedir.</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">3. Kullanıcı Yükümlülükleri</h3>
              <p>Kullanıcı olarak aşağıdaki hususları kabul edersiniz:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
                <li>Hizmeti yalnızca yasal amaçlarla kullanacağınızı,</li>
                <li>Hesap bilgilerinizin gizliliğinden sorumlu olduğunuzu,</li>
                <li>Yanlış, yanıltıcı veya sahte bilgi vermeyeceğinizi,</li>
                <li>Üçüncü şahısların haklarını ihlal etmeyeceğinizi,</li>
                <li>Hizmeti kötüye kullanmayacağınızı, zararlı içerik paylaşmayacağınızı,</li>
                <li>Hizmeti tersine mühendislik, kopyalama veya dağıtma girişiminde bulunmayacağınızı,</li>
                <li>13 yaşından büyük olduğunuzu; 13-18 yaş aralığındaysanız yasal vasi onayı ile kullandığınızı,</li>
                <li>Hizmeti kullanarak ürettiğiniz içeriklerin yasallığından ve doğruluğundan kendinizin sorumlu olduğunu.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">4. Yapay Zeka İçeriği ve Sorumluluk Reddi</h3>
              <p>
                Tre yapay zeka tarafından üretilen yanıtlar, tavsiyeler, analizler ve görseller bilgilendirme amaçlıdır. Yapay zeka tarafından üretilen hiçbir içerik; tıbbi, hukuki, mali, psikolojik veya profesyonel danışmanlık yerine geçmez. Yapay zeka yanıtlarının doğruluğu, eksiksizliği veya güncelliği garanti edilmez. Tre, bir makinedir; hata yapabilir, yanlış anlayabilir veya eksik cevap verebilir. Kullanıcı, yapay zeka tarafından üretilen içeriklere dayanarak aldığı kararlardan ve bu kararların sonuçlarından tamamen kendisi sorumludur. Tre Geliştirici Ekibi, yapay zeka yanıtlarından kaynaklanan doğrudan veya dolaylı hiçbir zarardan sorumlu tutulamaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">5. Gizlilik ve Veri İşleme</h3>
              <p>
                Hizmeti kullanırken sağladığınız kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat kapsamında işlenir. Sohbet geçmişiniz, yüklediğiniz dosyalar, kamera görüntüleri ve sesli komutlar dahil olmak üzere verileriniz; hizmetin sunulması, iyileştirilmesi ve kişiselleştirilmesi amacıyla toplanır ve işlenir. Verileriniz, endüstri standardı şifreleme yöntemleri (AES-256, TLS 1.3) ile korunur. Tre Geliştirici Ekibi, kullanıcı verilerini yasal zorunluluklar dışında üçüncü şahıslarla paylaşmaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">6. Fikri Mülkiyet Hakları</h3>
              <p>
                Tre hizmetinin tüm fikri mülkiyet hakları Tre Geliştirici Ekibi'ne aittir. Yapay zeka tarafından oluşturulan görseller ve içerikler kişisel kullanım amaçlıdır; ticari kullanım için Tre Geliştirici Ekibi'nden yazılı izin alınması gerekir. Kullanıcı tarafından yüklenen içeriklerin telif hakkı sorumluluğu kullanıcıya aittir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">7. Sorumluluk Sınırlandırması</h3>
              <p>
                Tre Geliştirici Ekibi ve Tre hizmeti; hizmetin kesintisiz, hatasız veya güvenli olacağını garanti etmez. Hizmetin kullanımından kaynaklanan doğrudan, dolaylı, arızi, özel, cezai veya sonuç olarak ortaya çıkan hiçbir zarardan (kâr kaybı, veri kaybı, itibar kaybı dahil) sorumlu tutulamaz. Hizmetin kullanılamaması, veri kaybı veya güvenlik ihlali durumlarında sorumluluk kabul etmez.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">8. Tazminat</h3>
              <p>
                Kullanıcı; bu Sözleşmeyi ihlal etmesi, Hizmeti kötüye kullanması veya üçüncü şahısların haklarını ihlal etmesi durumunda, Tre Geliştirici Ekibi'ni, yöneticilerini, çalışanlarını ve temsilcilerini her türlü talep, dava, zarar ve masrafa (avukatlık ücretleri dahil) karşı tazmin edeceğini kabul eder.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">9. Hizmet Değişiklikleri ve Fesih</h3>
              <p>
                Tre Geliştirici Ekibi, herhangi bir zamanda ve herhangi bir sebeple; Hizmeti değiştirme, askıya alma veya sonlandırma hakkını saklı tutar. Önemli değişiklikler için kullanıcıya makul süre öncesinden bildirim yapılır. Kullanıcı hesabını istediği zaman kapatabilir. Sözleşmenin ihlali durumunda hesap askıya alınabilir veya kapatılabilir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">10. Uygulanacak Hukuk ve Uyuşmazlık Çözümü</h3>
              <p>
                Bu Sözleşme, Türkiye Cumhuriyeti kanunlarına tabi olup, bu Sözleşmeden doğan veya bu Sözleşmeyle ilgili her türlü uyuşmazlıkta İstanbul Mahkemeleri ve İcra Daireleri yetkilidir. Tüketici hakem heyetlerine başvuru hakkı saklıdır.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">11. Mücbir Sebepler</h3>
              <p>
                Tre Geliştirici Ekibi; doğal afetler, savaş, terör, salgın hastalık, internet altyapı sorunları, enerji kesintileri ve benzeri mücbir sebeplerden kaynaklanan hizmet aksaklıklarından sorumlu tutulamaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">12. Sözleşme Değişiklikleri</h3>
              <p>
                Tre Geliştirici Ekibi bu Sözleşmeyi istediği zaman güncelleme hakkına sahiptir. Değişiklikler uygulama üzerinden duyurulacaktır. Önemli değişiklikler için kullanıcıdan yeniden onay alınır. Değişiklik sonrasında Hizmeti kullanmaya devam etmeniz, güncellenmiş koşulları kabul ettiğiniz anlamına gelir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">13. Erişilebilirlik</h3>
              <p>
                Tre, tüm kullanıcıların hizmetten eşit şekilde faydalanabilmesi için erişilebilirlik özellikleri sunar. Yüksek kontrast modu, yazı ölçeği ayarlama ve animasyonları azaltma gibi seçenekler kullanıcıların bireysel ihtiyaçlarına göre yapılandırılabilir. Tre Geliştirici Ekibi, erişilebilirlik standartlarını sürekli iyileştirmeyi taahhüt eder.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">14. E-posta ve Üçüncü Taraf Hesap Erişimi</h3>
              <p>
                Kullanıcı, Tre'e Google hesabı gibi üçüncü taraf hesaplarını bağlayarak e-posta okuma, özetleme ve taslak oluşturma gibi ek işlevleri etkinleştirebilir. Bu erişim yalnızca kullanıcının açık onayı ile sağlanır ve kullanıcı istediği zaman erişimi iptal edebilir. Bağlanan hesaplar üzerinden erişilen veriler, yalnızca talep edilen işlevler kapsamında kullanılır ve üçüncü şahıslarla paylaşılmaz. Tre Geliştirici Ekibi, üçüncü taraf hizmetlerinin kesintisiz veya hatasız çalışacağını garanti etmez.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">15. Kullanıcı Hafızası ve Kişiselleştirme</h3>
              <p>
                Tre, kullanıcı deneyimini iyileştirmek amacıyla sohbet geçmişinden öğrenilen bilgileri (ilgi alanları, tercihler, hatıralar) saklayabilir. Bu veriler yalnızca ilgili kullanıcının hesabıyla ilişkilendirilir ve kişiselleştirilmiş yanıtlar sunmak için kullanılır. Kullanıcı, hafıza verilerini istediği zaman görüntüleyebilir ve silebilir. Duygu durumu kayıtları da dahil olmak üzere tüm kullanıcı verileri, kullanıcı talebiyle silinebilir; bu durumda Tre, geçmiş duygusal bağlamı hatırlayamaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">16. İletişim</h3>
              <p>
                Bu Sözleşme veya Hizmet ile ilgili sorularınız için Tre Geliştirici Ekibi'ne uygulama üzerinden ulaşabilirsiniz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">17. Bildirimler ve Hatırlatıcılar</h3>
              <p>
                Kullanıcı, Ayarlar &gt; Bildirimler menüsünden push bildirim iznini etkinleştirebilir. İzin verildiğinde Tre, doğal dille kurulan hatırlatıcıları zamanı geldiğinde web push bildirimi olarak gönderir. Bildirim aboneliği yalnızca kullanıcının cihazında ve tarayıcısında geçerlidir; kullanıcı istediği zaman ayarlardan veya tarayıcı üzerinden aboneliği iptal edebilir. Tre Geliştirici Ekibi, cihaz/tarayıcı kısıtlamaları veya işletim sistemi kaynaklı gecikmelerden sorumlu değildir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">18. Sesli Etkileşim ve "Hey Tre" Uyandırma Sözcüğü</h3>
              <p>
                Sesli sohbet, tam ekran sesli mod ve "Hey Tre" uyandırma sözcüğü özellikleri yalnızca kullanıcı mikrofon iznini verdiğinde ve ilgili ayarı etkinleştirdiğinde çalışır. Uyandırma sözcüğü algılama işlemi cihaz üzerinde yerel olarak yürütülür; kullanıcı komut vermediği sürece ses kaydı sunucuya iletilmez. Kullanıcı bu özellikleri istediği zaman ayarlardan kapatabilir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">19. Canlı Kamera ve Ekran Paylaşımı</h3>
              <p>
                Canlı kamera analizi ve ekran paylaşımı analizi yalnızca kullanıcı tarafından açıkça başlatıldığında çalışır. Bu akışlar kaydedilmez; yalnızca analiz için düzenli aralıklarla kare (frame) alınır ve işlendikten sonra silinir. Kullanıcı, akışı istediği an durdurabilir ve tarayıcı üzerinden kamera/ekran iznini geri çekebilir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">20. Dosya Üretimi ve Dışa Aktarma</h3>
              <p>
                Tre; APK, ISO, PPTX, ses dosyası üretebilir ve sohbet geçmişini (kod ve görseller dahil) PDF olarak dışa aktarabilir. PDF dışa aktarma işlemi tamamen kullanıcı cihazında (istemci tarafında) gerçekleştirilir. Üretilen dosyaların içeriği, kullanım amacı ve üçüncü şahıslarla paylaşımı kullanıcının sorumluluğundadır. Kullanıcı, yasa dışı, zararlı veya üçüncü şahısların haklarını ihlal eden dosyalar üretmek için Hizmeti kullanmamayı kabul eder.
              </p>
            </section>

            <section className="border-t border-border pt-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Bu Sözleşme, kullanıcı ile Tre Geliştirici Ekibi arasındaki anlaşmanın tamamını oluşturur ve önceki tüm yazılı veya sözlü anlaşmaların yerine geçer.
              </p>
            </section>
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
