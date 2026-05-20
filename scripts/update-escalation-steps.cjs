const fs = require('fs');
const path = require('path');

const localesDir = 'C:/Users/Devin/peptid-tracker/src/i18n/locales';
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newKeys = {
  de: {
    ob_step_16_title: 'Dosiserhöhung',
    ob_step_16_subtitle: 'Schritt 16 · Eskalation',
    ob_step_16_description: 'Tippe auf "+", um eine Dosiserhöhung für diesen Zyklus hinzuzufügen.',
    ob_step_16_tap: 'Tippe auf "+"',
    ob_step_17_title: 'Erhöhung eintragen',
    ob_step_17_subtitle: 'Schritt 17 · Formular',
    ob_step_17_description: 'Gib ein, um wie viel die Dosis steigt und ab wann (Datum, Tage oder Wochen nach Start).',
    ob_step_18_title: 'Erhöhung speichern',
    ob_step_18_subtitle: 'Schritt 18 · Bestätigen',
    ob_step_18_description: 'Speichere die Dosiserhöhung – sie erscheint im Kalender farbig markiert.',
    ob_step_18_tap: 'Tippe auf "Speichern"',
  },
  en: {
    ob_step_16_title: 'Dose Escalation',
    ob_step_16_subtitle: 'Step 16 · Escalation',
    ob_step_16_description: 'Tap "+" to add a dose escalation for this cycle.',
    ob_step_16_tap: 'Tap "+"',
    ob_step_17_title: 'Enter Increase',
    ob_step_17_subtitle: 'Step 17 · Form',
    ob_step_17_description: 'Enter how much the dose increases and when (date, days or weeks after start).',
    ob_step_18_title: 'Save Escalation',
    ob_step_18_subtitle: 'Step 18 · Confirm',
    ob_step_18_description: 'Save the dose escalation – it will appear color-coded in the calendar.',
    ob_step_18_tap: 'Tap "Save"',
  },
  es: {
    ob_step_16_title: 'Escalada de dosis',
    ob_step_16_subtitle: 'Paso 16 · Escalada',
    ob_step_16_description: 'Pulsa "+" para agregar una escalada de dosis a este ciclo.',
    ob_step_16_tap: 'Pulsa "+"',
    ob_step_17_title: 'Registrar aumento',
    ob_step_17_subtitle: 'Paso 17 · Formulario',
    ob_step_17_description: 'Indica cuánto aumenta la dosis y cuándo (fecha, días o semanas tras el inicio).',
    ob_step_18_title: 'Guardar escalada',
    ob_step_18_subtitle: 'Paso 18 · Confirmar',
    ob_step_18_description: 'Guarda la escalada de dosis – aparecerá marcada en el calendario.',
    ob_step_18_tap: 'Pulsa "Guardar"',
  },
  fr: {
    ob_step_16_title: 'Escalade de dose',
    ob_step_16_subtitle: 'Étape 16 · Escalade',
    ob_step_16_description: 'Appuyez sur "+" pour ajouter une escalade de dose à ce cycle.',
    ob_step_16_tap: 'Appuyez sur "+"',
    ob_step_17_title: "Saisir l'augmentation",
    ob_step_17_subtitle: 'Étape 17 · Formulaire',
    ob_step_17_description: "Indiquez de combien la dose augmente et à partir de quand (date, jours ou semaines après le début).",
    ob_step_18_title: "Enregistrer l'escalade",
    ob_step_18_subtitle: 'Étape 18 · Confirmer',
    ob_step_18_description: "Enregistrez l'escalade de dose – elle apparaîtra en couleur dans le calendrier.",
    ob_step_18_tap: 'Appuyez sur "Enregistrer"',
  },
  it: {
    ob_step_16_title: 'Aumento del dosaggio',
    ob_step_16_subtitle: 'Passo 16 · Escalation',
    ob_step_16_description: 'Tocca "+" per aggiungere un aumento del dosaggio a questo ciclo.',
    ob_step_16_tap: 'Tocca "+"',
    ob_step_17_title: 'Inserisci aumento',
    ob_step_17_subtitle: 'Passo 17 · Modulo',
    ob_step_17_description: "Inserisci di quanto aumenta il dosaggio e quando (data, giorni o settimane dall'inizio).",
    ob_step_18_title: 'Salva aumento',
    ob_step_18_subtitle: 'Passo 18 · Conferma',
    ob_step_18_description: "Salva l'aumento del dosaggio – apparirà evidenziato nel calendario.",
    ob_step_18_tap: 'Tocca "Salva"',
  },
  pt: {
    ob_step_16_title: 'Escalonamento de dose',
    ob_step_16_subtitle: 'Passo 16 · Escalonamento',
    ob_step_16_description: 'Toque em "+" para adicionar um escalonamento de dose a este ciclo.',
    ob_step_16_tap: 'Toque em "+"',
    ob_step_17_title: 'Inserir aumento',
    ob_step_17_subtitle: 'Passo 17 · Formulário',
    ob_step_17_description: 'Insira quanto a dose aumenta e quando (data, dias ou semanas após o início).',
    ob_step_18_title: 'Salvar escalonamento',
    ob_step_18_subtitle: 'Passo 18 · Confirmar',
    ob_step_18_description: 'Salve o escalonamento de dose – ele aparecerá marcado no calendário.',
    ob_step_18_tap: 'Toque em "Salvar"',
  },
  ru: {
    ob_step_16_title: 'Эскалация дозы',
    ob_step_16_subtitle: 'Шаг 16 · Эскалация',
    ob_step_16_description: 'Нажмите "+", чтобы добавить эскалацию дозы для этого цикла.',
    ob_step_16_tap: 'Нажмите "+"',
    ob_step_17_title: 'Введите увеличение',
    ob_step_17_subtitle: 'Шаг 17 · Форма',
    ob_step_17_description: 'Укажите, насколько увеличивается доза и когда (дата, дни или недели после начала).',
    ob_step_18_title: 'Сохранить эскалацию',
    ob_step_18_subtitle: 'Шаг 18 · Подтвердить',
    ob_step_18_description: 'Сохраните эскалацию дозы – она появится в календаре с цветовой маркировкой.',
    ob_step_18_tap: 'Нажмите "Сохранить"',
  },
  tr: {
    ob_step_16_title: 'Doz artışı',
    ob_step_16_subtitle: 'Adım 16 · Eskalasyon',
    ob_step_16_description: 'Bu döngüye doz artışı eklemek için "+" düğmesine dokunun.',
    ob_step_16_tap: '"+" düğmesine dokunun',
    ob_step_17_title: 'Artışı girin',
    ob_step_17_subtitle: 'Adım 17 · Form',
    ob_step_17_description: 'Dozun ne kadar artacağını ve ne zaman başlayacağını girin (tarih, gün veya hafta).',
    ob_step_18_title: 'Artışı kaydet',
    ob_step_18_subtitle: 'Adım 18 · Onayla',
    ob_step_18_description: 'Doz artışını kaydedin – takvimde renkli olarak görünecektir.',
    ob_step_18_tap: '"Kaydet" düğmesine dokunun',
  },
  ar: {
    ob_step_16_title: 'زيادة الجرعة',
    ob_step_16_subtitle: 'خطوة 16 · التصعيد',
    ob_step_16_description: 'اضغط على "+" لإضافة زيادة في الجرعة لهذه الدورة.',
    ob_step_16_tap: 'اضغط على "+"',
    ob_step_17_title: 'أدخل الزيادة',
    ob_step_17_subtitle: 'خطوة 17 · النموذج',
    ob_step_17_description: 'أدخل مقدار زيادة الجرعة ومتى تبدأ (تاريخ أو أيام أو أسابيع بعد البداية).',
    ob_step_18_title: 'حفظ الزيادة',
    ob_step_18_subtitle: 'خطوة 18 · تأكيد',
    ob_step_18_description: 'احفظ زيادة الجرعة – ستظهر ملونة في التقويم.',
    ob_step_18_tap: 'اضغط على "حفظ"',
  },
  hi: {
    ob_step_16_title: 'खुराक वृद्धि',
    ob_step_16_subtitle: 'चरण 16 · वृद्धि',
    ob_step_16_description: 'इस चक्र में खुराक वृद्धि जोड़ने के लिए "+" दबाएं।',
    ob_step_16_tap: '"+" दबाएं',
    ob_step_17_title: 'वृद्धि दर्ज करें',
    ob_step_17_subtitle: 'चरण 17 · फ़ॉर्म',
    ob_step_17_description: 'खुराक कितनी बढ़ेगी और कब से (तारीख, दिन या सप्ताह) दर्ज करें।',
    ob_step_18_title: 'वृद्धि सहेजें',
    ob_step_18_subtitle: 'चरण 18 · पुष्टि करें',
    ob_step_18_description: 'खुराक वृद्धि सहेजें – यह कैलेंडर में रंग के साथ दिखेगी।',
    ob_step_18_tap: '"सहेजें" दबाएं',
  },
  id: {
    ob_step_16_title: 'Eskalasi Dosis',
    ob_step_16_subtitle: 'Langkah 16 · Eskalasi',
    ob_step_16_description: 'Ketuk "+" untuk menambahkan eskalasi dosis pada siklus ini.',
    ob_step_16_tap: 'Ketuk "+"',
    ob_step_17_title: 'Masukkan Peningkatan',
    ob_step_17_subtitle: 'Langkah 17 · Formulir',
    ob_step_17_description: 'Masukkan berapa besar dosis meningkat dan kapan (tanggal, hari, atau minggu setelah mulai).',
    ob_step_18_title: 'Simpan Eskalasi',
    ob_step_18_subtitle: 'Langkah 18 · Konfirmasi',
    ob_step_18_description: 'Simpan eskalasi dosis – akan muncul berwarna di kalender.',
    ob_step_18_tap: 'Ketuk "Simpan"',
  },
  ja: {
    ob_step_16_title: '用量増加',
    ob_step_16_subtitle: 'ステップ 16 · エスカレーション',
    ob_step_16_description: '"+" をタップして、このサイクルに用量増加を追加します。',
    ob_step_16_tap: '"+" をタップ',
    ob_step_17_title: '増加を入力',
    ob_step_17_subtitle: 'ステップ 17 · フォーム',
    ob_step_17_description: '用量がどれだけ増加するか、いつから（日付、開始からの日数または週数）を入力します。',
    ob_step_18_title: '増加を保存',
    ob_step_18_subtitle: 'ステップ 18 · 確認',
    ob_step_18_description: '用量増加を保存します – カレンダーにカラーマークで表示されます。',
    ob_step_18_tap: '「保存」をタップ',
  },
  ko: {
    ob_step_16_title: '용량 증가',
    ob_step_16_subtitle: '단계 16 · 에스컬레이션',
    ob_step_16_description: '"+"를 탭하여 이 사이클에 용량 증가를 추가합니다.',
    ob_step_16_tap: '"+" 탭',
    ob_step_17_title: '증가량 입력',
    ob_step_17_subtitle: '단계 17 · 양식',
    ob_step_17_description: '용량이 얼마나 증가하는지, 언제부터인지(날짜, 시작 후 일수 또는 주수) 입력합니다.',
    ob_step_18_title: '증가 저장',
    ob_step_18_subtitle: '단계 18 · 확인',
    ob_step_18_description: '용량 증가를 저장합니다 – 달력에 색상으로 표시됩니다.',
    ob_step_18_tap: '"저장" 탭',
  },
  zh: {
    ob_step_16_title: '剂量递增',
    ob_step_16_subtitle: '步骤 16 · 递增',
    ob_step_16_description: '点击"+"为本周期添加剂量递增。',
    ob_step_16_tap: '点击"+"',
    ob_step_17_title: '输入增量',
    ob_step_17_subtitle: '步骤 17 · 表单',
    ob_step_17_description: '输入剂量增加多少以及从何时开始（日期、天数或开始后的周数）。',
    ob_step_18_title: '保存递增',
    ob_step_18_subtitle: '步骤 18 · 确认',
    ob_step_18_description: '保存剂量递增 – 它将在日历中以颜色标记显示。',
    ob_step_18_tap: '点击"保存"',
  },
};

// Rename map: process high-to-low to avoid key collisions
const renameMap = [
  ['ob_step_20', 'ob_step_23'],
  ['ob_step_19', 'ob_step_22'],
  ['ob_step_18', 'ob_step_21'],
  ['ob_step_17', 'ob_step_20'],
  ['ob_step_16', 'ob_step_19'],
];

for (const file of files) {
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const [oldPrefix, newPrefix] of renameMap) {
    const keysToRename = Object.keys(obj).filter(k => k.startsWith(oldPrefix + '_'));
    for (const key of keysToRename) {
      const newKey = key.replace(oldPrefix, newPrefix);
      obj[newKey] = obj[key];
      delete obj[key];
    }
  }

  const langKeys = newKeys[lang] || newKeys.en;
  for (const [k, v] of Object.entries(langKeys)) {
    obj[k] = v;
  }

  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
  console.log('Updated:', file);
}
console.log('Done!');
