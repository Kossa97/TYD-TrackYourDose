import type { FaqCategory } from '../types'

/** Turkish FAQ */
export const trCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Başlangıç ve gezinme',
    items: [
      {
        q: 'Peptid Tracker nedir?',
        a: 'Peptid Tracker, araştırma amaçlı kişisel bir uygulamadır. Peptitlerinizi yönetebilir, alım döngüleri planlayabilir, dozları kaydedebilir, dozaj hesaplayabilir, günlükte etkileri not edebilir ve değerlendirmeler yazabilirsiniz—hepsi tek bir yerde.',
      },
      {
        q: 'Bölümler arasında nasıl gezinirim?',
        a: 'Ekranın altında 5 simgeli bir gezinme çubuğu vardır: Stok, Peptitler, Ana Sayfa (ortada), Takvim ve Profil. Diğer tüm alanlara ortadaki Ana Sayfa ekranından ulaşırsınız.',
      },
      {
        q: 'Ana Sayfa ekranı nedir?',
        a: [
          'Ana Sayfa ekranı (gezinmedeki orta düğme) merkezinizdir:',
          '• Üstte 3 hızlı istatistik görürsünüz: Aktif döngüler, Stoktaki flakonlar, Peptitlerim',
          '• Altında uygulamanın 8 alanı için kutucuklar vardır',
          '• Bir kutucuğa dokunarak doğrudan oraya gidebilirsiniz',
        ],
      },
      {
        q: 'Uygulamanın tüm alanları nelerdir?',
        a: [
          '📅 Takvim – günlük kayıt, dozları onaylama ve döngü özeti',
          '📦 Stok – hammadde envanteri, flakonları saklama ve yönetme',
          '🧪 Peptitler – rekonstitüe peptitler ve döngü oluşturma',
          '🧮 Hesaplayıcı – şırınga ölçeğiyle doz hesaplayıcı',
          '📓 Günlük – etkileri ve yan etkileri kaydetme',
          '⭐ Değerlendirmeler – tek tek peptitler için deneyim raporları',
          '👤 Profil – hesap bilgileri, herkese açık profil ve paylaşım bağlantısı',
          '❓ SSS – bu yardım sayfası',
        ],
      },
      {
        q: 'Nasıl çıkış yaparım?',
        a: '“Profil”e gidin ve sağ üstteki kırmızı “Çıkış yap” düğmesine dokunun.',
      },
      {
        q: 'Verilerim güvenli şekilde saklanıyor mu?',
        a: 'Evet. Tüm veriler Supabase veritabanında saklanır. Her kullanıcı yalnızca kendi verilerini görür—bu, Satır Düzeyinde Güvenlik (RLS) ile zorunlu kılınır. Parti dosyaları (PDF/görsel) ayrı bir depolama alanında tutulur ve yalnızca size erişilebilir.',
      },
      {
        q: 'Uygulamayı telefonuma yükleyebilir miyim?',
        a: [
          'Evet! Peptid Tracker bir PWA’dır (Progressive Web App):',
          'iPhone/Safari: Paylaş simgesi → “Ana Ekrana Ekle” → “Ekle”',
          'Android/Chrome: Üç nokta → “Uygulamayı yükle” veya “Ana ekrana ekle”',
          'Uygulama tarayıcı çerçevesi olmadan çalışır ve yerel bir uygulama gibi hissettirir.',
        ],
      },
      {
        q: 'Nereden başlamalıyım?',
        a: [
          'Önerilen sıra:',
          '1. “Peptitler” → “+ Yeni” → peptit oluşturun (ad, etken madde, rekonstitüsyon, stok)',
          '2. Peptit kartında doğrudan “Döngü ekle”',
          '3. Birim ve konsantrasyon hesaplamak için “Hesaplayıcı”yı kullanın',
          '4. “Takvim”i açın – döngü mor arka planla görünür',
          '5. Bir döngü gününe dokunun → dozu kaydedin ve onaylayın',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Takvim ve kayıt',
    items: [
      {
        q: 'Takvim ne gösterir?',
        a: [
          'Takvim size bir bakışta genel bir görünüm sunar:',
          '🟣 Mor arka plan = o gün için aktif döngü planlandı',
          '🔵 Mavi nokta = o gün için bir doz kaydedildi',
          '🔵 Açık mavi halka = bugün',
          '🟠 Turuncu ok simgesi = o günde bir doz artışı aktif',
        ],
      },
      {
        q: 'Bir dozu nasıl kaydederim?',
        a: [
          '1. Takvimde bir güne dokunun',
          '2. Aktif döngüler alttaki gün panelinde kart olarak görünür',
          '3. Bir döngüye dokunun → kayıt formu önceden doldurulmuş açılır',
          '4. Gerekirse dozu, yöntemi veya saati ayarlayın',
          '5. “Kaydet”e dokunun',
        ],
      },
      {
        q: 'Doz onayı nedir?',
        a: [
          'Kaydettikten sonra her dozu onaylayabilirsiniz:',
          '✅ “Alındı” – kayıt yeşil işaretlenir',
          '❌ “Alınmadı” – kayıt kırmızı işaretlenir ve erteleme seçenekleri görünür',
          'Onaylayana kadar her iki düğme de kayıt kartında görünür.',
        ],
      },
      {
        q: 'Erteleme (snooze) nedir?',
        a: [
          '“Alınmadı”ya dokunduğunuzda erteleme düğmeleri görünür:',
          '⏰ 15 dk – 15 dakika sonra hatırlatma',
          '⏰ 30 dk – 30 dakika sonra hatırlatma',
          '⏰ 1 sa – 1 saat sonra hatırlatma',
          '⏰ 2 sa – 2 saat sonra hatırlatma',
          'Süre dolduğunda peptit ve dozu gösteren bir bildirim çıkar.',
        ],
      },
      {
        q: 'Takvimdeki turuncu ok ne anlama gelir?',
        a: 'Turuncu ok (📈 artış aktif), o gün döngünüzdeki bir doz artışının geçerli olduğunu gösterir. Gün panelinde gösterilen doz zaten artırılmış toplam dozdur.',
      },
      {
        q: 'Aylar arasında nasıl geçiş yaparım?',
        a: 'Ay adının solundaki/sağındaki oklara dokunun.',
      },
      {
        q: 'Kaydedilmiş bir dozu silebilir miyim?',
        a: 'Evet. Gün panelinde her kaydın sağında bir ✕ düğmesi vardır → dokunun ve onaylayın.',
      },
      {
        q: 'Döngüm olmasına rağmen neden mor arka plan yok?',
        a: [
          'Olası nedenler:',
          '• Döngü “Pasif” → Peptitler → döngü → anahtarı açın',
          '• Yanlış ay gösteriliyor → döngünün başlangıç ayına gidin',
          '• Başlangıç/bitiş tarihleri bu ayı kapsamıyor',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Peptitler ve stok',
    items: [
      {
        q: 'Yeni bir peptit nasıl oluştururum?',
        a: [
          '1. Sağ üstte “+ Yeni”ye dokunun',
          '2. Bir ad girin veya “Bilinen”den seçin',
          '3. Etken madde ve rekonstitüsyonu doldurun (mg/flakon, sıvı, şırınga)',
          '4. Stok, parti bilgisi ve dozajı girin',
          '5. İsteğe bağlı: analiz belgesinin PDF veya görselini yükleyin',
          '6. “Kaydet”e dokunun',
        ],
      },
      {
        q: 'Peptit kartındaki animasyonlu flakon ne gösterir?',
        a: [
          'Stok girdiyseniz kartın solunda animasyonlu bir flakon görünür:',
          '🟢 Yeşil = stok %50’den fazla',
          '🟡 Sarı = stok %25–50',
          '🔴 Kırmızı = stok %25’ten az – yakında tükeniyor',
          'Sıvı animasyonlu hareket eder. Telefonda flakon cihaz yönüne göre eğilir.',
        ],
      },
      {
        q: 'Peptit kartındaki bilgi düğmesi (not simgesi) nedir?',
        a: [
          'Not simgesi (📄) kaydedilen tüm verileri içeren bir bilgi sayfası açar:',
          '• Doz ve uygulama yolu',
          '• Etken madde, sıvı hacmi, şırınga',
          '• Rekonstitüsyon tarihi ve geri sayımlı son kullanma tarihi',
          '• Stok ve ilerleme çubuğu',
          '• Parti numarası ve kaynak',
          '• Analiz belgesi: görseller satır içi, PDF’ler bağlantı olarak',
          '• Notlar',
        ],
      },
      {
        q: 'Stok yönetimi nedir?',
        a: [
          'Kaç flakonunuz olduğunu girebilirsiniz:',
          '• “Eldeki flakonlar” = mevcut stok',
          '• İlk kayıtta bu değer %100 temel olarak hatırlanır',
          '• Karttaki ilerleme çubuğu tüketimi renkli gösterir',
          '• Son kullanma tarihi rekonstitüsyon tarihi + raf ömründen hesaplanır',
        ],
      },
      {
        q: 'Parti bilgisi nedir?',
        a: [
          'Parti bilgisi peptidinizin nereden geldiğini belgeler:',
          '• Parti numarası = üretici lot kimliği',
          '• Kaynak = üretici veya tedarikçi (ör. “Peptide Sciences”)',
          '• Analiz belgesi = PDF veya görsel yükleyin (COA, laboratuvar raporu, fatura)',
          'Bu bilgiler peptit bilgi sayfasında da görünür.',
        ],
      },
      {
        q: '“Eklenen sıvı (mL)” ne anlama gelir?',
        a: 'Flakona eklediğiniz su miktarıdır (ör. BAC suyu, NaCl veya enjeksiyonluk su). Daha fazla sıvı daha düşük konsantrasyon demektir. Tipik değerler 1–2 mL’dir.',
      },
      {
        q: 'Şırınga alanları “mL” ve “birim” ne anlama gelir?',
        a: [
          'Bu iki alan şırınganızı tanımlar:',
          '• mL = toplam şırınga hacmi (ör. 1 mL)',
          '• Birim = maksimum ölçek işaretleri (ör. U-100 şırıngada 100)',
          '→ Bundan: birim/mL = mililitre başına işaret sayısı',
          'Standart U-100 insülin şırıngası: 1 mL / 100 birim = 100 birim/mL',
        ],
      },
      {
        q: 'Rekonstitüsyondan sonra raf ömrü nedir?',
        a: [
          'Peptit çözüldükten sonra sınırlı süre stabil kalır (buzdolabında):',
          '10–14 gün = kısa ömürlü peptitler',
          '21–28 gün = rekonstitüe peptitler için tipik',
          '42–90 gün = özellikle stabil peptitler',
          'Son kullanma tarihi rekonstitüsyon tarihi + seçilen günlerden hesaplanır ve renkli gösterilir.',
        ],
      },
      {
        q: 'Peptit kartından döngüyü nasıl eklerim?',
        a: 'Her peptit kartının sağ altında mor “Döngü ekle” düğmesi vardır. Dokunun—önce peptidi genişletmenize gerek yok.',
      },
      {
        q: 'Alttaki ok ve döngü sayısı ne gösterir?',
        a: 'Sol alttaki küçük ok (ör. “▼ 2 döngü”) döngü görünümünü açar veya kapatır. Bu peptit için kaç döngü olduğunu bir bakışta görürsünüz.',
      },
      {
        q: 'Peptit nasıl aranır?',
        a: 'Peptitler oluşturulduktan sonra üstte bir arama alanı görünür. Ad yazın—liste otomatik filtrelenir. Yanındaki açılır menüyle A→Z veya Z→A sıralayabilirsiniz.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Hesaplayıcı',
    items: [
      {
        q: 'Hesaplayıcı ne yapabilir?',
        a: [
          'Girdilerinizden hesaplayıcı şunları hesaplar:',
          '• Çekilecek birimler – şırıngada kaç işaret',
          '• Konsantrasyon – hazır çözeltinin mg/mL değeri',
          '• Şırınga doluluk – şırınganın yüzde kaçını çektiğiniz',
          '• Flakon başına doz – bir flakondan kaç enjeksiyon alırsınız',
        ],
      },
      {
        q: 'Şırınga ölçeği nedir?',
        a: [
          'Üstteki renkli ölçek kaç birim çekeceğinizi görsel olarak gösterir:',
          '• Çubuk soldan (mavi) sağa (mor → pembe) dolar',
          '• Beyaz çizgi tam noktayı işaretler',
          '• Üstteki büyük sayı birimleri gösterir',
          'Dozunuzun şırıngaya sığıp sığmadığını hemen görürsünüz.',
        ],
      },
      {
        q: 'Hesaplayıcı hangi girdilere ihtiyaç duyar?',
        a: [
          '• Şırınga boyutu – hazır seçenek (ör. 1 mL / 100 birim) veya özel değerler',
          '• Flakon başına etken madde – flakondaki mg (ör. 10 mg)',
          '• Eklenen sıvı – kaç mL eklediğiniz (ör. 2 mL)',
          '• Doz – hedef dozunuz birimle (mcg, mg, IU)',
        ],
      },
      {
        q: 'Hangi şırınga hazır ayarları var?',
        a: [
          '• 1 mL · 100 birim (U-100) – standart insülin şırıngası',
          '• 0,5 mL · 50 birim (U-100) – küçük insülin şırıngası',
          '• 0,3 mL · 30 birim (U-100) – çok küçük şırınga',
          '• 2 mL · 200 birim (U-100) – daha büyük şırınga',
          '• 1 mL · 40 birim (U-40) – eski U-40 şırıngası',
          'Veya: özel mL ve birim girin.',
        ],
      },
      {
        q: 'Örnek – hesaplama nasıl çalışır?',
        a: [
          'Örnek: BPC-157, 5 mg flakon, 2 mL su, 500 mcg doz, U-100 şırınga',
          '→ Konsantrasyon: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Hacim: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Birim: 0,200 mL × 100 birim/mL = 20 birim',
          '→ Doz/flakon: 5000 mcg ÷ 500 mcg = 10 doz',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Döngüler',
    items: [
      {
        q: 'Döngü nedir?',
        a: 'Döngü, bir peptit için yapılandırılmış bir alım planıdır. Doz, yöntem, sıklık, zaman aralığı, isteğe bağlı alım saati ve hatırlatıcıları tanımlar.',
      },
      {
        q: 'Döngüyü nasıl oluştururum?',
        a: [
          '1. Peptit kartında “+ Döngü ekle”ye (mor düğme) dokunun',
          '2. Ad, doz, sıklık ve tarihleri doldurun',
          '3. İsteğe bağlı: alım saati ve hatırlatıcıları ayarlayın',
          '4. “Kaydet”e dokunun',
          'Döngü otomatik olarak takvimde görünür!',
        ],
      },
      {
        q: 'Hangi sıklık seçenekleri var?',
        a: [
          '• Günlük · Günde iki kez · Gün aşırı',
          '• 5 gün açık / 2 gün kapalı (5on/2off)',
          '• Pzt–Cum · Haftalık',
          '• Her X günde bir – özel aralık',
          '• Haftanın günlerini seç – örn. yalnızca Pzt, Çar, Cum',
        ],
      },
      {
        q: 'Aktif/Pasif anahtarı ne anlama gelir?',
        a: 'Aktif = döngü takvimde görünür (mor günler). Pasif = döngü duraklatıldı, takvimde görünmez. Döngünün sağındaki anahtara dokunarak değiştirin.',
      },
      {
        q: 'Alım saati nedir?',
        a: [
          'İsteğe bağlı – günün saatini belirler:',
          '🌅 Sabah = 08:00 · ☀️ Öğle = 12:00 · 🌙 Akşam = 20:00 · 🕐 Özel saat',
          'Hatırlatıcılar için kullanılır. İsteğe bağlıdır—boş bırakabilirsiniz.',
        ],
      },
      {
        q: 'Hatırlatıcılar nasıl çalışır?',
        a: [
          'Hatırlatıcılar çoklu seçimdir—birden fazlasını seçebilirsiniz:',
          '• 1 gün önce – alımdan 24 saat önce hatırlatma',
          '• 2 sa önce – 2 saat önceden',
          '• Alım anında – ayarlanan saatte tam olarak',
          'Kaydettiğinizde uygulama bildirim izni ister.',
          'Önemli: yalnızca uygulama açıkken çalışır.',
        ],
      },
      {
        q: 'Bir peptit için birden fazla döngü olabilir mi?',
        a: 'Evet, istediğiniz kadar. Tüm aktif döngüler takvimde görünür. Örn. sabah + akşam veya farklı dozaj aşamaları için kullanışlıdır.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Doz artışları',
    items: [
      {
        q: 'Doz artışı nedir?',
        a: 'Bir döngü içinde planlanmış doz yükseltmesidir. Örnek: 200 mcg ile başlayın, 2 hafta sonra +100 mcg, 4 hafta sonra bir +100 mcg daha. Birden fazla aşama mümkündür.',
      },
      {
        q: 'Doz artışını nasıl eklerim?',
        a: [
          '1. Peptidi genişletin → döngüyü bulun → “Doz artışları” bölümü',
          '2. “+ Ekle”ye dokunun',
          '3. Artış miktarı ve birimini girin',
          '4. Başlangıç seçin: sabit tarih / X gün sonra / X hafta sonra',
          '5. İsteğe bağlı not ekleyin → Kaydet',
        ],
      },
      {
        q: 'Doz artışı takvimde gösterilir mi?',
        a: [
          'Evet! Bir artış geçerli olduğunda:',
          '• Gün panelinde turuncu 📈 “Aşama X aktif” gösterir',
          '• Gösterilen doz zaten artırılmış toplam dozdur (temel + artış)',
          '• Artış simgesi takvim açıklamasında görünür',
        ],
      },
      {
        q: 'Başlangıç seçenekleri ne anlama gelir?',
        a: [
          '• Sabit tarih – artışın hangi günden itibaren geçerli olduğu',
          '• X gün sonra – döngü başlangıcından X gün sonra',
          '• X hafta sonra – döngü başlangıcından eşdeğer gün sayısı sonra',
        ],
      },
      {
        q: 'Birden fazla aşama olabilir mi?',
        a: 'Evet, istediğiniz kadar. #1, #2, #3 olarak numaralandırılır. Tüm aktif aşamalar toplanır.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Günlük',
    items: [
      {
        q: 'Günlük nedir?',
        a: 'Peptitlerinizin etkilerini ve yan etkilerini burada belgelersiniz. Hangi etkilerin ne zaman, ne kadar güçlü ve ne kadar sürdüğünü görmek için kalıpları fark etmenize yardımcı olur.',
      },
      {
        q: 'Etki ile yan etki arasındaki fark nedir?',
        a: [
          '✅ Etki (yeşil) = istenen sonuç (uyku, iyileşme, enerji...)',
          '⚠️ Yan etki (turuncu) = istenmeyen sonuç (ağrı, yorgunluk...)',
        ],
      },
      {
        q: 'Durum seçenekleri ne anlama gelir?',
        a: [
          '🔘 Beklemede – henüz gerçekleşmedi',
          '✅ Gerçekleşti – aktif olarak mevcut',
          '⏳ Hâlâ devam ediyor – sürüyor',
          '✅ Geçti – bitti',
          'Formu açmadan durumu doğrudan kartta değiştirin.',
        ],
      },
      {
        q: 'Yoğunluk ölçeği (1–5) nedir?',
        a: [
          '1 = Zar zor fark edilir · 2 = Hafif · 3 = Orta · 4 = Güçlü · 5 = Çok güçlü',
        ],
      },
      {
        q: 'Günlükte nasıl filtreler ve ararım?',
        a: [
          '• Sekmeler: Tümü / Etkiler / Yan etkiler',
          '• Arama: açıklama ve peptit adına göre filtreler',
          '• Sıralama: tarih (yeni/eski), yoğunluk (yüksek/düşük)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Değerlendirmeler',
    items: [
      {
        q: 'Değerlendirmeler nedir?',
        a: 'Tek tek peptitler için kişisel deneyim raporlarıdır. Yıldızlar (1–5), genel deneyim (iyi/orta/kötü), artılar ve eksiler ile ayrıntılı bir yazı içerir.',
      },
      {
        q: 'Değerlendirme nasıl oluştururum?',
        a: [
          '1. “Değerlendirmeler”de “+ Yeni”ye dokunun',
          '2. Peptit seçin → yıldız verin → deneyim seçin',
          '3. Başlık girin (zorunlu) → isteğe bağlı rapor, artılar, eksiler',
          '4. Kaydet',
        ],
      },
      {
        q: 'Değerlendirmeleri nasıl arar ve sıralarım?',
        a: [
          '• Arama: başlık ve peptit adı',
          '• Sıralama: en yeni / en eski / puan yüksek / puan düşük',
        ],
      },
      {
        q: 'Değerlendirmeleri profilimde paylaşabilir miyim?',
        a: 'Evet. “Profil”de “Değerlendirmeler” anahtarını açın—herkese açık profil bağlantınızda görünürler.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profil ve paylaşım',
    items: [
      {
        q: 'Profilime neler girebilirim?',
        a: [
          '• Kullanıcı adı (paylaşım bağlantısı için) – zorunlu',
          '• Görünen ad, yaş, cinsiyet, kilo, boy',
          '• Kişisel notlar (yalnızca sizin için)',
          '• Herkese açık biyografi (paylaşılan profilde gösterilir)',
        ],
      },
      {
        q: 'Herkese açık profili nasıl etkinleştiririm?',
        a: [
          '1. Kullanıcı adını girin ve profili kaydedin',
          '2. Ana “Profili paylaş” anahtarını açın',
          '3. Tek tek alanları etkinleştirin (Peptitler / Takvim / Günlük / Değerlendirmeler)',
          '4. Kaydet → bağlantı görünür ve kopyalanabilir',
        ],
      },
      {
        q: 'Hangi içerikleri paylaşabilirim?',
        a: [
          'Her alanın kendi anahtarı vardır:',
          '🧪 Peptitler · 📅 Takvim ve döngüler · 📖 Günlük · ⭐ Değerlendirmeler',
          'Örneğin yalnızca değerlendirmeleri paylaşıp geri kalanını gizli tutabilirsiniz.',
        ],
      },
      {
        q: 'Paylaşımı istediğim zaman kapatabilir miyim?',
        a: 'Evet. Ana “Profili paylaş” anahtarını kapatın → kaydedin. Bağlantı hemen “Bu profil gizli” gösterir.',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Hatırlatıcılar ve erteleme',
    items: [
      {
        q: 'Hatırlatıcıları nasıl ayarlarım?',
        a: [
          '1. Döngü oluşturun veya düzenleyin',
          '2. Alım saatini ayarlayın (sabah/öğle/akşam/özel)',
          '3. “Hatırlatıcı” altında bir veya daha fazla seçenek seçin (çoklu seçim)',
          '4. Kaydet → uygulama bildirim izni ister',
        ],
      },
      {
        q: 'Birden fazla hatırlatma zamanı seçebilir miyim?',
        a: 'Evet. Örneğin “1 gün önce” ve “Alım anında”yı aynı anda etkinleştirebilirsiniz. Onay işaretleri hangilerinin aktif olduğunu gösterir.',
      },
      {
        q: 'Hatırlatıcı ile erteleme arasındaki fark nedir?',
        a: [
          'Hatırlatıcı (döngüde) = alımdan önce planlanmış bildirim',
          'Erteleme (takvimde) = dozu “Alınmadı” işaretledikten sonra takip hatırlatması (15 dk / 30 dk / 1 sa / 2 sa)',
        ],
      },
      {
        q: 'Neden hatırlatma almıyorum?',
        a: [
          '• Bildirim izni reddedildi → telefon ayarlarından etkinleştirin',
          '• Hatırlatma saatinde uygulama açık değildi',
          '• Bugünkü hatırlatma saati zaten geçti',
          '• Döngü “Pasif”',
        ],
      },
      {
        q: 'Hatırlatıcılar uygulama kapalıyken çalışır mı?',
        a: 'Şu an hayır. Bildirimler tarayıcı tabanlıdır ve açık bir uygulama (sekme veya PWA) gerektirir. Arka planda iletim için bir push servisi gerekir.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Teknik ve gizlilik',
    items: [
      {
        q: 'Neden “Kaydetme hatası” görüyorum?',
        a: [
          '• İnternet bağlantısı yok',
          '• Zorunlu alanlar eksik',
          '• Oturum süresi doldu → çıkış yapıp tekrar giriş yapın',
          '• PDF yükleme: depolama alanı henüz kurulmadı → Supabase’de SQL çalıştırın',
        ],
      },
      {
        q: 'Neden PDF yükleyemiyorum?',
        a: [
          '“batch-files” depolama alanı Supabase’de bir kez kurulmalıdır:',
          '1. supabase.com → projeniz → SQL Editor → yeni sekme',
          '2. “supabase-inventory.sql” dosyasındaki SQL’i yapıştırıp çalıştırın',
          'Sonrasında yüklemeler hemen çalışır.',
        ],
      },
      {
        q: 'Çıkış yaptığımda verilerime ne olur?',
        a: 'Verileriniz sunucuda kalır. Sonraki girişte tüm kayıtlar hâlâ oradadır.',
      },
      {
        q: 'Uygulamayı kaldırırsam veriler silinir mi?',
        a: 'Hayır. Veriler sunucuda (Supabase) saklanır—cihazdan bağımsızdır. Herhangi bir cihazda tekrar giriş yapmanız yeterlidir.',
      },
      {
        q: 'Uygulama tıbbi kullanım için uygun mu?',
        a: 'Hayır. Yalnızca araştırma ve belgeleme amaçlıdır. Tıbbi tavsiye yerine geçmez. Her zaman bir doktora danışın.',
      },
      {
        q: 'Uygulamayı tablette veya ikinci bir cihazda kullanabilir miyim?',
        a: [
          'Evet. Her şey bulutta olduğu için uygulama istediğiniz kadar cihazda çalışır:',
          '1. Tarayıcıda aynı URL’yi açın',
          '2. Aynı hesapla giriş yapın',
          '3. Tüm veriler anında kullanılabilir',
          'Kod erişimi (geliştirme) için: GitHub’daki depoyu klonlayın.',
        ],
      },
    ],
  },
]
