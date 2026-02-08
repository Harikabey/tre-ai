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
          <DialogTitle className="text-xl">TreFriend Kullanım Sözleşmesi</DialogTitle>
          <DialogDescription>Son güncelleme: 8 Şubat 2026</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">1. Genel Hükümler</h3>
              <p>
                Bu Kullanım Sözleşmesi ("Sözleşme"), TreFriend yapay zeka asistanı hizmetini ("Hizmet") kullanmanız için geçerli olan şartları ve koşulları belirler. Hizmete kaydolarak veya Hizmeti kullanarak, bu Sözleşmenin tüm hükümlerini okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan ve taahhüt edersiniz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">2. Hizmet Tanımı</h3>
              <p>
                TreFriend, Treasure şirketi tarafından geliştirilen yapay zeka destekli bir sohbet asistanıdır. Hizmet; metin tabanlı sohbet, görsel analiz, görsel oluşturma, sesli iletişim, canlı kamera analizi, belge okuma ve duygu analizi gibi özellikler sunar. Hizmet "olduğu gibi" sunulmakta olup herhangi bir garanti verilmemektedir.
              </p>
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
                <li>18 yaşından büyük olduğunuzu veya yasal vasinin onayı ile kullandığınızı.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">4. Yapay Zeka İçeriği ve Sorumluluk Reddi</h3>
              <p>
                TreFriend yapay zeka tarafından üretilen yanıtlar, tavsiyeler, analizler ve görseller bilgilendirme amaçlıdır. Yapay zeka tarafından üretilen hiçbir içerik; tıbbi, hukuki, mali, psikolojik veya profesyonel danışmanlık yerine geçmez. Yapay zeka yanıtlarının doğruluğu, eksiksizliği veya güncelliği garanti edilmez. Kullanıcı, yapay zeka tarafından üretilen içeriklere dayanarak aldığı kararlardan ve bu kararların sonuçlarından tamamen kendisi sorumludur. Treasure şirketi, yapay zeka yanıtlarından kaynaklanan doğrudan veya dolaylı hiçbir zarardan sorumlu tutulamaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">5. Gizlilik ve Veri İşleme</h3>
              <p>
                Hizmeti kullanırken sağladığınız kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat kapsamında işlenir. Sohbet geçmişiniz, yüklediğiniz dosyalar, kamera görüntüleri ve sesli komutlar dahil olmak üzere verileriniz; hizmetin sunulması, iyileştirilmesi ve kişiselleştirilmesi amacıyla toplanır ve işlenir. Treasure şirketi, kullanıcı verilerini yasal zorunluluklar dışında üçüncü şahıslarla paylaşmaz. Verilerinizin güvenliği için endüstri standardı şifreleme ve güvenlik önlemleri uygulanır.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">6. Fikri Mülkiyet Hakları</h3>
              <p>
                TreFriend hizmetinin tüm fikri mülkiyet hakları Treasure şirketine aittir. Yapay zeka tarafından oluşturulan görseller ve içerikler kişisel kullanım amaçlıdır. Kullanıcı tarafından yüklenen içeriklerin telif hakkı sorumluluğu kullanıcıya aittir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">7. Sorumluluk Sınırlandırması</h3>
              <p>
                Treasure şirketi ve TreFriend hizmeti; hizmetin kesintisiz, hatasız veya güvenli olacağını garanti etmez. Hizmetin kullanımından kaynaklanan doğrudan, dolaylı, arızi, özel, cezai veya sonuç olarak ortaya çıkan hiçbir zarardan (kâr kaybı, veri kaybı, itibar kaybı dahil) sorumlu tutulamaz. Hizmetin kullanılamaması, veri kaybı veya güvenlik ihlali durumlarında sorumluluk kabul etmez. Treasure şirketinin toplam sorumluluğu, her durumda kullanıcının son 12 ayda hizmet için ödediği toplam tutarla sınırlıdır.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">8. Tazminat</h3>
              <p>
                Kullanıcı; bu Sözleşmeyi ihlal etmesi, Hizmeti kötüye kullanması veya üçüncü şahısların haklarını ihlal etmesi durumunda, Treasure şirketini, yöneticilerini, çalışanlarını ve temsilcilerini her türlü talep, dava, zarar ve masrafa (avukatlık ücretleri dahil) karşı tazmin edeceğini kabul eder.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">9. Hizmet Değişiklikleri ve Fesih</h3>
              <p>
                Treasure şirketi, herhangi bir zamanda ve herhangi bir sebeple, önceden bildirimde bulunarak veya bulunmaksızın; Hizmeti değiştirme, askıya alma veya sonlandırma hakkını saklı tutar. Kullanıcı hesabını istediği zaman kapatabilir. Sözleşmenin ihlali durumunda Treasure şirketi hesabı askıya alabilir veya kapatabilir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">10. Uygulanacak Hukuk ve Uyuşmazlık Çözümü</h3>
              <p>
                Bu Sözleşme, Türkiye Cumhuriyeti kanunlarına tabi olup, bu Sözleşmeden doğan veya bu Sözleşmeyle ilgili her türlü uyuşmazlıkta İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">11. Mücbir Sebepler</h3>
              <p>
                Treasure şirketi; doğal afetler, savaş, terör, salgın hastalık, internet altyapı sorunları, enerji kesintileri ve benzeri mücbir sebeplerden kaynaklanan hizmet aksaklıklarından sorumlu tutulamaz.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">12. Sözleşme Değişiklikleri</h3>
              <p>
                Treasure şirketi bu Sözleşmeyi istediği zaman güncelleme hakkına sahiptir. Değişiklikler uygulama üzerinden duyurulacaktır. Değişiklik sonrasında Hizmeti kullanmaya devam etmeniz, güncellenmiş koşulları kabul ettiğiniz anlamına gelir.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">13. İletişim</h3>
              <p>
                Bu Sözleşme veya Hizmet ile ilgili sorularınız için bizimle iletişime geçebilirsiniz.
              </p>
            </section>

            <section className="border-t border-border pt-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Bu Sözleşme, kullanıcı ile Treasure şirketi arasındaki anlaşmanın tamamını oluşturur ve önceki tüm yazılı veya sözlü anlaşmaların yerine geçer.
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
