import type { FaqCategory } from '../types'

/** FAQ in italiano */
export const itCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Primi passi e navigazione',
    items: [
      {
        q: 'Cos\'è Peptid Tracker?',
        a: 'Peptid Tracker è un\'app personale per uso di ricerca. Puoi gestire i tuoi peptidi, pianificare cicli di assunzione, registrare le dosi, calcolare il dosaggio, annotare gli effetti nel diario e scrivere recensioni — tutto in un unico posto.',
      },
      {
        q: 'Come mi sposto tra le sezioni?',
        a: 'In basso sullo schermo c\'è la navigazione con 5 icone: Magazzino, Peptidi, Home (al centro), Calendario e Profilo. Tutte le altre aree si raggiungono dalla schermata Home al centro.',
      },
      {
        q: 'Cos\'è la schermata Home?',
        a: [
          'La schermata Home (pulsante centrale nella navigazione) è il tuo hub:',
          '• In alto vedi 3 statistiche rapide: Cicli attivi, Fiale in magazzino, I miei peptidi',
          '• Sotto ci sono le tessere per tutte le 8 aree dell\'app',
          '• Tocca una tessera per andarci direttamente',
        ],
      },
      {
        q: 'Quali sono tutte le aree dell\'app?',
        a: [
          '📅 Calendario – registro giornaliero, conferma dosi e panoramica cicli',
          '📦 Magazzino – inventario materie prime, conserva e gestisci le fiale',
          '🧪 Peptidi – peptidi ricostituiti e creazione cicli',
          '🧮 Calcolatrice – calcolatore dosi con scala della siringa',
          '📓 Diario – registra effetti ed effetti collaterali',
          '⭐ Recensioni – resoconti di esperienza sui singoli peptidi',
          '👤 Profilo – dati account, profilo pubblico e link di condivisione',
          '❓ FAQ – questa pagina di aiuto',
        ],
      },
      {
        q: 'Come esco dall\'account?',
        a: 'Vai su «Profilo» e tocca il pulsante rosso «Esci» in alto a destra.',
      },
      {
        q: 'I miei dati sono archiviati in modo sicuro?',
        a: 'Sì. Tutti i dati sono salvati in un database Supabase. Ogni utente vede solo i propri dati — questo è garantito con Row Level Security (RLS). I file di lotto (PDF/immagini) sono in un bucket di storage separato e accessibili solo a te.',
      },
      {
        q: 'Posso installare l\'app sul telefono?',
        a: [
          'Sì! Peptid Tracker è una PWA (Progressive Web App):',
          'iPhone/Safari: icona Condividi → «Aggiungi a Home» → «Aggiungi»',
          'Android/Chrome: tre puntini → «Installa app» o «Aggiungi a schermata Home»',
          'L\'app funziona poi senza la barra del browser e sembra un\'app nativa.',
        ],
      },
      {
        q: 'Da dove comincio?',
        a: [
          'Ordine consigliato:',
          '1. «Peptidi» → «+ Nuovo» → crea un peptide (nome, principio attivo, ricostituzione, magazzino)',
          '2. «Aggiungi ciclo» direttamente sulla scheda del peptide',
          '3. Usa «Calcolatrice» per calcolare unità e concentrazione',
          '4. Apri «Calendario» – il ciclo appare con sfondo viola',
          '5. Tocca un giorno del ciclo → registra dose e conferma',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Calendario e registro',
    items: [
      {
        q: 'Cosa mostra il calendario?',
        a: [
          'Il calendario offre una panoramica immediata:',
          '🟣 Sfondo viola = ciclo attivo pianificato per quel giorno',
          '🔵 Punto blu = è stata registrata una dose quel giorno',
          '🔵 Anello celeste = oggi',
          '🟠 Icona freccia arancione = aumento dose attivo quel giorno',
        ],
      },
      {
        q: 'Come registro una dose?',
        a: [
          '1. Tocca un giorno nel calendario',
          '2. I cicli attivi compaiono come schede nel pannello del giorno sotto',
          '3. Tocca un ciclo → si apre il modulo di registrazione già compilato',
          '4. Modifica dose, metodo o orario se serve',
          '5. Tocca «Salva»',
        ],
      },
      {
        q: 'Cos\'è la conferma della dose?',
        a: [
          'Dopo la registrazione puoi confermare ogni dose:',
          '✅ «Assunta» – la voce diventa verde',
          '❌ «Non assunta» – la voce diventa rossa e compaiono le opzioni posticipo',
          'Finché non confermi, entrambi i pulsanti restano sulla scheda della voce.',
        ],
      },
      {
        q: 'Cos\'è il posticipo (snooze)?',
        a: [
          'Se tocchi «Non assunta», compaiono i pulsanti di posticipo:',
          '⏰ 15 min – promemoria tra 15 minuti',
          '⏰ 30 min – promemoria tra 30 minuti',
          '⏰ 1 h – promemoria tra 1 ora',
          '⏰ 2 h – promemoria tra 2 ore',
          'Alla scadenza un toast mostra peptide e dose.',
        ],
      },
      {
        q: 'Cosa significa la freccia arancione nel calendario?',
        a: 'La freccia arancione (📈 aumento attivo) indica che quel giorno si applica un aumento di dose dal ciclo. La dose mostrata nel pannello del giorno è già la dose totale aumentata.',
      },
      {
        q: 'Come cambio mese?',
        a: 'Tocca le frecce a sinistra/destra del nome del mese.',
      },
      {
        q: 'Posso eliminare una dose registrata?',
        a: 'Sì. Nel pannello del giorno c\'è un pulsante ✕ a destra di ogni voce → toccalo e conferma.',
      },
      {
        q: 'Perché non c\'è lo sfondo viola anche se ho un ciclo?',
        a: [
          'Possibili motivi:',
          '• Il ciclo è «Inattivo» → in Peptidi → ciclo → attiva l\'interruttore',
          '• Mese sbagliato → vai al mese di inizio del ciclo',
          '• Le date di inizio/fine escludono questo mese',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Peptidi e magazzino',
    items: [
      {
        q: 'Come creo un nuovo peptide?',
        a: [
          '1. Tocca «+ Nuovo» in alto a destra',
          '2. Inserisci un nome o scegli da «Noti»',
          '3. Compila principio attivo e ricostituzione (mg/fiala, liquido, siringa)',
          '4. Inserisci magazzino, info lotto e dosaggio',
          '5. Opzionale: carica PDF o immagine del documento di analisi',
          '6. Tocca «Salva»',
        ],
      },
      {
        q: 'Cosa mostra la fiala animata sulla scheda del peptide?',
        a: [
          'Se hai inserito il magazzino, a sinistra della scheda compare una fiala animata:',
          '🟢 Verde = più del 50% di scorte rimaste',
          '🟡 Giallo = 25–50% di scorte',
          '🔴 Rosso = meno del 25% – in esaurimento a breve',
          'Il liquido è animato. Su smartphone la fiala si inclina con l\'orientamento del dispositivo.',
        ],
      },
      {
        q: 'Cos\'è il pulsante info (icona nota) sulla scheda del peptide?',
        a: [
          'L\'icona nota (📄) apre un foglio informativo con tutti i dati salvati:',
          '• Dose e via di somministrazione',
          '• Principio attivo, volume liquido, siringa',
          '• Data ricostituzione e scadenza con conto alla rovescia',
          '• Magazzino e barra di avanzamento',
          '• Numero di lotto e fonte',
          '• Documento di analisi: immagini inline, PDF come link',
          '• Note',
        ],
      },
      {
        q: 'Cos\'è la gestione del magazzino?',
        a: [
          'Puoi indicare quante fiale hai:',
          '• «Fiale disponibili» = scorte attuali',
          '• Al primo salvataggio questo valore diventa la baseline al 100%',
          '• La barra di avanzamento sulla scheda mostra il consumo a colori',
          '• La scadenza si calcola da data di ricostituzione + durata di conservazione',
        ],
      },
      {
        q: 'Cosa sono le informazioni sul lotto?',
        a: [
          'Le informazioni sul lotto documentano l\'origine del peptide:',
          '• Numero di lotto = ID lotto del produttore',
          '• Fonte = produttore o fornitore (es. «Peptide Sciences»)',
          '• Documento di analisi = carica PDF o immagine (COA, referto di laboratorio, fattura)',
          'Compare anche nel foglio informativo del peptide.',
        ],
      },
      {
        q: 'Cosa significa «Liquido aggiunto (mL)»?',
        a: 'È quanta acqua (es. acqua batteriostatica, NaCl o acqua sterile per iniezione) aggiungi alla fiala. Più liquido significa concentrazione più bassa. Valori tipici: 1–2 mL.',
      },
      {
        q: 'Cosa significano i campi siringa «mL» e «unità»?',
        a: [
          'Questi due campi descrivono la tua siringa:',
          '• mL = volume totale della siringa (es. 1 mL)',
          '• Unità = tacche massime sulla scala (es. 100 su siringa U-100)',
          '→ Da qui: unità/mL = tacche per millilitro',
          'Siringa insulinica U-100 standard: 1 mL / 100 unità = 100 unità/mL',
        ],
      },
      {
        q: 'Cos\'è la durata di conservazione dopo la ricostituzione?',
        a: [
          'Dopo aver sciolto il peptide resta stabile per un tempo limitato (in frigo):',
          '10–14 giorni = peptidi a breve vita',
          '21–28 giorni = tipico per peptidi ricostituiti',
          '42–90 giorni = peptidi particolarmente stabili',
          'La scadenza si calcola da data di ricostituzione + giorni selezionati e viene mostrata a colori.',
        ],
      },
      {
        q: 'Come aggiungo un ciclo dalla scheda del peptide?',
        a: 'Ogni scheda peptide ha in basso a destra il pulsante viola «Aggiungi ciclo». Toccalo — non serve espandere prima il peptide.',
      },
      {
        q: 'Cosa indica la freccia con il conteggio cicli in basso?',
        a: 'La piccola freccia in basso a sinistra (es. «▼ 2 cicli») espande o comprime la vista cicli. Vedi subito quanti cicli esistono per questo peptide.',
      },
      {
        q: 'Come cerco un peptide?',
        a: 'Quando ci sono peptidi, compare un campo di ricerca in alto. Digita un nome — l\'elenco si filtra automaticamente. Usa il menu a tendina accanto per ordinare A→Z o Z→A.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Calcolatrice',
    items: [
      {
        q: 'Cosa può fare la calcolatrice?',
        a: [
          'Dai tuoi input la calcolatrice calcola:',
          '• Unità da prelevare – quante tacche sulla siringa',
          '• Concentrazione – mg/mL della soluzione pronta',
          '• Riempimento siringa – quale percentuale della siringa prelevi',
          '• Dosi per fiala – quante iniezioni ottieni da una fiala',
        ],
      },
      {
        q: 'Cos\'è la scala della siringa?',
        a: [
          'La scala colorata in alto mostra visivamente quante unità prelevare:',
          '• La barra si riempie da sinistra (blu) a destra (viola → rosa)',
          '• La linea bianca segna il punto esatto',
          '• Il numero grande sopra mostra le unità',
          'Vedi subito se la dose entra nella siringa.',
        ],
      },
      {
        q: 'Quali input servono alla calcolatrice?',
        a: [
          '• Dimensione siringa – scegli un preset (es. 1 mL / 100 unità) o inserisci valori personalizzati',
          '• Attivo per fiala – mg sulla fiala (es. 10 mg)',
          '• Liquido aggiunto – quanti mL hai aggiunto (es. 2 mL)',
          '• Dose – dose obiettivo con unità (mcg, mg, UI)',
        ],
      },
      {
        q: 'Quali preset di siringa esistono?',
        a: [
          '• 1 mL · 100 unità (U-100) – siringa insulinica standard',
          '• 0,5 mL · 50 unità (U-100) – siringa insulinica piccola',
          '• 0,3 mL · 30 unità (U-100) – siringa molto piccola',
          '• 2 mL · 200 unità (U-100) – siringa più grande',
          '• 1 mL · 40 unità (U-40) – siringa U-40 più vecchia',
          'Oppure: inserisci mL e unità personalizzati.',
        ],
      },
      {
        q: 'Esempio – come funziona il calcolo?',
        a: [
          'Esempio: BPC-157, fiala 5 mg, 2 mL acqua, dose 500 mcg, siringa U-100',
          '→ Concentrazione: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volume: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Unità: 0,200 mL × 100 unità/mL = 20 unità',
          '→ Dosi/fiala: 5000 mcg ÷ 500 mcg = 10 dosi',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Cicli',
    items: [
      {
        q: 'Cos\'è un ciclo?',
        a: 'Un ciclo è un piano strutturato di assunzione per un peptide. Definisce dose, metodo, frequenza, intervallo temporale, orario di assunzione opzionale e promemoria.',
      },
      {
        q: 'Come creo un ciclo?',
        a: [
          '1. Sulla scheda peptide tocca «+ Aggiungi ciclo» (pulsante viola)',
          '2. Compila nome, dose, frequenza e date',
          '3. Opzionale: imposta orario di assunzione e promemoria',
          '4. Tocca «Salva»',
          'Il ciclo compare automaticamente nel calendario!',
        ],
      },
      {
        q: 'Quali opzioni di frequenza esistono?',
        a: [
          '• Giornaliero · Due volte al giorno · A giorni alterni',
          '• 5 giorni on / 2 off (5on/2off)',
          '• Lun–Ven · Settimanale',
          '• Ogni X giorni – intervallo personalizzato',
          '• Scegli giorni della settimana – es. solo lun, mer, ven',
        ],
      },
      {
        q: 'Cosa significa l\'interruttore Attivo/Inattivo?',
        a: 'Attivo = il ciclo compare nel calendario (giorni viola). Inattivo = ciclo in pausa, non visibile nel calendario. Cambia toccando l\'interruttore a destra del ciclo.',
      },
      {
        q: 'Cos\'è l\'orario di assunzione?',
        a: [
          'Opzionale – imposta l\'ora del giorno:',
          '🌅 Mattina = 08:00 · ☀️ Mezzogiorno = 12:00 · 🌙 Sera = 20:00 · 🕐 Orario personalizzato',
          'Serve per i promemoria. È opzionale — puoi lasciarlo vuoto.',
        ],
      },
      {
        q: 'Come funzionano i promemoria?',
        a: [
          'I promemoria sono a scelta multipla — puoi selezionarne più di uno:',
          '• 1 giorno prima – promemoria 24 ore prima dell\'assunzione',
          '• 2 h prima – anticipo di 2 ore',
          '• All\'assunzione – esattamente all\'orario impostato',
          'L\'app chiede il permesso alle notifiche al salvataggio.',
          'Importante: funziona solo con l\'app aperta.',
        ],
      },
      {
        q: 'Posso avere più cicli per un peptide?',
        a: 'Sì, quanti ne vuoi. Tutti i cicli attivi compaiono nel calendario. Utile ad es. per mattina + sera o fasi di dosaggio diverse.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Aumenti di dose',
    items: [
      {
        q: 'Cos\'è un aumento di dose?',
        a: 'Un incremento pianificato della dose all\'interno di un ciclo. Esempio: inizi a 200 mcg, dopo 2 settimane +100 mcg, dopo 4 settimane altri +100 mcg. Sono possibili più step.',
      },
      {
        q: 'Come aggiungo un aumento di dose?',
        a: [
          '1. Espandi peptide → trova il ciclo → sezione «Aumenti di dose»',
          '2. Tocca «+ Aggiungi»',
          '3. Inserisci importo e unità dell\'aumento',
          '4. Scegli inizio: data fissa / dopo X giorni / dopo X settimane',
          '5. Opzionale: aggiungi una nota → Salva',
        ],
      },
      {
        q: 'L\'aumento di dose compare nel calendario?',
        a: [
          'Sì! Da quando si applica un aumento:',
          '• 📈 arancione nel pannello del giorno mostra «Fase X attiva»',
          '• La dose mostrata è già il totale aumentato (base + aumento)',
          '• L\'icona aumento compare nella legenda del calendario',
        ],
      },
      {
        q: 'Cosa significano le opzioni di inizio?',
        a: [
          '• Data fissa – da quale giorno si applica l\'aumento',
          '• Dopo X giorni – X giorni dopo l\'inizio del ciclo',
          '• Dopo X settimane – giorni equivalenti dopo l\'inizio del ciclo',
        ],
      },
      {
        q: 'Posso avere più step?',
        a: 'Sì, quanti ne vuoi. Sono numerati #1, #2, #3. Tutti gli step attivi si sommano.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Diario',
    items: [
      {
        q: 'Cos\'è il diario?',
        a: 'Qui documenti effetti ed effetti collaterali dei tuoi peptidi. Ti aiuta a individuare schemi — quali effetti compaiono quando, quanto sono intensi e per quanto durano.',
      },
      {
        q: 'Qual è la differenza tra effetto ed effetto collaterale?',
        a: [
          '✅ Effetto (verde) = esito desiderato (sonno, guarigione, energia...)',
          '⚠️ Effetto collaterale (arancione) = esito indesiderato (dolore, stanchezza...)',
        ],
      },
      {
        q: 'Cosa significano le opzioni di stato?',
        a: [
          '🔘 In attesa – non ancora verificato',
          '✅ Verificato – presente attivamente',
          '⏳ Ancora in corso – continua',
          '✅ Svanito – terminato',
          'Cambia lo stato direttamente sulla scheda senza aprire il modulo.',
        ],
      },
      {
        q: 'Cos\'è la scala di intensità (1–5)?',
        a: [
          '1 = Appena percettibile · 2 = Lieve · 3 = Moderato · 4 = Forte · 5 = Molto forte',
        ],
      },
      {
        q: 'Come filtro e cerco nel diario?',
        a: [
          '• Schede: Tutti / Effetti / Effetti collaterali',
          '• Ricerca: filtra per descrizione e nome peptide',
          '• Ordinamento: data (nuovo/vecchio), intensità (alta/bassa)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Recensioni',
    items: [
      {
        q: 'Cosa sono le recensioni?',
        a: 'Resoconti personali di esperienza sui singoli peptidi. Con stelle (1–5), esperienza complessiva (buona/media/scarsa), pro e contro e testo dettagliato.',
      },
      {
        q: 'Come creo una recensione?',
        a: [
          '1. In «Recensioni» tocca «+ Nuovo»',
          '2. Scegli peptide → assegna stelle → seleziona esperienza',
          '3. Inserisci titolo (obbligatorio) → opzionale resoconto, pro, contro',
          '4. Salva',
        ],
      },
      {
        q: 'Come cerco e ordino le recensioni?',
        a: [
          '• Ricerca: titolo e nome peptide',
          '• Ordinamento: più recenti / più vecchie / voto alto / voto basso',
        ],
      },
      {
        q: 'Posso condividere le recensioni sul profilo?',
        a: 'Sì. In «Profilo» attiva l\'interruttore «Recensioni» — compariranno sul link del profilo pubblico.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profilo e condivisione',
    items: [
      {
        q: 'Cosa posso inserire nel profilo?',
        a: [
          '• Nome utente (per il link di condivisione) – obbligatorio',
          '• Nome visualizzato, età, sesso, peso, altezza',
          '• Note personali (solo per te)',
          '• Bio pubblica (mostrata sul profilo condiviso)',
        ],
      },
      {
        q: 'Come attivo il profilo pubblico?',
        a: [
          '1. Inserisci nome utente e salva il profilo',
          '2. Attiva l\'interruttore principale «Condividi profilo»',
          '3. Abilita le singole aree (Peptidi / Calendario / Diario / Recensioni)',
          '4. Salva → compare il link e puoi copiarlo',
        ],
      },
      {
        q: 'Quali contenuti posso condividere?',
        a: [
          'Ogni area ha il proprio interruttore:',
          '🧪 Peptidi · 📅 Calendario e cicli · 📖 Diario · ⭐ Recensioni',
          'Puoi ad es. condividere solo le recensioni e tenere tutto il resto privato.',
        ],
      },
      {
        q: 'Posso disattivare la condivisione in qualsiasi momento?',
        a: 'Sì. Disattiva l\'interruttore principale «Condividi profilo» → salva. Il link mostra subito «Questo profilo è privato».',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Promemoria e posticipo',
    items: [
      {
        q: 'Come imposto i promemoria?',
        a: [
          '1. Crea o modifica un ciclo',
          '2. Imposta orario di assunzione (mattina/mezzogiorno/sera/personalizzato)',
          '3. Sotto «Promemoria» scegli una o più opzioni (scelta multipla)',
          '4. Salva → l\'app chiede il permesso alle notifiche',
        ],
      },
      {
        q: 'Posso scegliere più orari di promemoria?',
        a: 'Sì. Puoi ad es. attivare «1 giorno prima» e «All\'assunzione» insieme. I segni di spunta mostrano quali sono attivi.',
      },
      {
        q: 'Qual è la differenza tra promemoria e posticipo?',
        a: [
          'Promemoria (nel ciclo) = notifica pianificata prima dell\'assunzione',
          'Posticipo (nel calendario) = promemoria di follow-up dopo aver segnato una dose «Non assunta» (15 min / 30 min / 1 h / 2 h)',
        ],
      },
      {
        q: 'Perché non ricevo promemoria?',
        a: [
          '• Permesso notifiche negato → abilita nelle impostazioni del telefono',
          '• L\'app non era aperta all\'orario del promemoria',
          '• L\'orario del promemoria per oggi è già passato',
          '• Il ciclo è «Inattivo»',
        ],
      },
      {
        q: 'I promemoria funzionano con l\'app chiusa?',
        a: 'Al momento no. Le notifiche sono basate sul browser e richiedono l\'app aperta (scheda o PWA). La consegna in background richiederebbe un servizio push.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Tecnica e privacy',
    items: [
      {
        q: 'Perché vedo «Errore nel salvataggio»?',
        a: [
          '• Nessuna connessione internet',
          '• Campi obbligatori mancanti',
          '• Sessione scaduta → esci e accedi di nuovo',
          '• Caricamento PDF: bucket storage non ancora configurato → esegui SQL in Supabase',
        ],
      },
      {
        q: 'Perché non riesco a caricare un PDF?',
        a: [
          'Il bucket storage «batch-files» va configurato una volta in Supabase:',
          '1. supabase.com → il tuo progetto → SQL Editor → nuova scheda',
          '2. Incolla ed esegui l\'SQL da «supabase-inventory.sql»',
          'I caricamenti funzionano subito dopo.',
        ],
      },
      {
        q: 'Cosa succede ai miei dati quando esco?',
        a: 'I tuoi dati restano sul server. Al prossimo accesso tutte le voci sono ancora presenti.',
      },
      {
        q: 'I dati vengono eliminati se disinstallo l\'app?',
        a: 'No. I dati sono sul server (Supabase) — indipendentemente dal dispositivo. Basta accedere di nuovo su qualsiasi dispositivo.',
      },
      {
        q: 'L\'app è adatta all\'uso medico?',
        a: 'No. Solo per ricerca e documentazione. Non sostituisce un parere medico. Consulta sempre un medico.',
      },
      {
        q: 'Posso usare l\'app su tablet o secondo dispositivo?',
        a: [
          'Sì. Poiché tutto è nel cloud, l\'app funziona su un numero qualsiasi di dispositivi:',
          '1. Apri lo stesso URL nel browser',
          '2. Accedi con lo stesso account',
          '3. Tutti i dati sono subito disponibili',
          'Per accesso al codice (sviluppo): clona il repository su GitHub.',
        ],
      },
    ],
  },
]
