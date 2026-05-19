import type { FaqCategory } from '../types'

/** Preguntas frecuentes en español */
export const esCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Primeros pasos y navegación',
    items: [
      {
        q: '¿Qué es Peptid Tracker?',
        a: 'Peptid Tracker es una aplicación personal para uso en investigación. Puede gestionar sus péptidos, planificar ciclos de ingesta, registrar dosis, calcular dosificación, anotar efectos en el diario y escribir reseñas, todo en un solo lugar.',
      },
      {
        q: '¿Cómo me muevo entre secciones?',
        a: 'En la parte inferior de la pantalla hay una navegación con 5 iconos: Stock, Péptidos, Inicio (centro), Calendario y Perfil. El resto de áreas se alcanzan desde la pantalla de Inicio en el centro.',
      },
      {
        q: '¿Qué es la pantalla de Inicio?',
        a: [
          'La pantalla de Inicio (botón central de la navegación) es su centro:',
          '• Arriba verá 3 estadísticas rápidas: Ciclos activos, Viales en stock, Mis péptidos',
          '• Debajo hay mosaicos para las 8 áreas de la aplicación',
          '• Toque un mosaico para ir directamente a esa sección',
        ],
      },
      {
        q: '¿Cuáles son todas las áreas de la aplicación?',
        a: [
          '📅 Calendario – registro diario, confirmar dosis y resumen de ciclos',
          '📦 Stock – inventario de materia prima, almacenar y gestionar viales',
          '🧪 Péptidos – péptidos reconstituidos y crear ciclos',
          '🧮 Calculadora – calculadora de dosis con escala de jeringa',
          '📓 Diario – registrar efectos y efectos secundarios',
          '⭐ Reseñas – informes de experiencia sobre péptidos concretos',
          '👤 Perfil – datos de cuenta, perfil público y enlace para compartir',
          '❓ FAQ – esta página de ayuda',
        ],
      },
      {
        q: '¿Cómo cierro sesión?',
        a: 'Vaya a «Perfil» y toque el botón rojo «Cerrar sesión» arriba a la derecha.',
      },
      {
        q: '¿Mis datos se almacenan de forma segura?',
        a: 'Sí. Todos los datos se guardan en una base de datos Supabase. Cada usuario solo ve los suyos; esto se garantiza con Row Level Security (RLS). Los archivos de lote (PDF/imágenes) están en un bucket de almacenamiento aparte y solo usted puede acceder a ellos.',
      },
      {
        q: '¿Puedo instalar la aplicación en mi teléfono?',
        a: [
          '¡Sí! Peptid Tracker es una PWA (aplicación web progresiva):',
          'iPhone/Safari: icono Compartir → «Añadir a pantalla de inicio» → «Añadir»',
          'Android/Chrome: tres puntos → «Instalar aplicación» o «Añadir a pantalla de inicio»',
          'La app se ejecuta sin la barra del navegador y se siente como una app nativa.',
        ],
      },
      {
        q: '¿Por dónde debería empezar?',
        a: [
          'Orden sugerido:',
          '1. «Péptidos» → «+ Nuevo» → crear un péptido (nombre, principio activo, reconstitución, stock)',
          '2. «Añadir ciclo» directamente en la tarjeta del péptido',
          '3. Usar «Calculadora» para calcular unidades y concentración',
          '4. Abrir «Calendario» – el ciclo aparece con fondo morado',
          '5. Toque un día del ciclo → registrar dosis y confirmar',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Calendario y registro',
    items: [
      {
        q: '¿Qué muestra el calendario?',
        a: [
          'El calendario ofrece una vista general de un vistazo:',
          '🟣 Fondo morado = ciclo activo planificado ese día',
          '🔵 Punto azul = se registró una dosis ese día',
          '🔵 Anillo celeste = hoy',
          '🟠 Icono de flecha naranja = hay un aumento de dosis activo ese día',
        ],
      },
      {
        q: '¿Cómo registro una dosis?',
        a: [
          '1. Toque un día en el calendario',
          '2. Los ciclos activos aparecen como tarjetas en el panel del día debajo',
          '3. Toque un ciclo → se abre el formulario de registro precargado',
          '4. Ajuste dosis, método u hora si hace falta',
          '5. Toque «Guardar»',
        ],
      },
      {
        q: '¿Qué es la confirmación de dosis?',
        a: [
          'Tras registrar puede confirmar cada dosis:',
          '✅ «Tomada» – la entrada se marca en verde',
          '❌ «No tomada» – la entrada se marca en rojo y aparecen opciones de aplazar',
          'Hasta que confirme, ambos botones aparecen en la tarjeta de la entrada.',
        ],
      },
      {
        q: '¿Qué es aplazar?',
        a: [
          'Al tocar «No tomada» aparecen botones de aplazar:',
          '⏰ 15 min – recordatorio en 15 minutos',
          '⏰ 30 min – recordatorio en 30 minutos',
          '⏰ 1 h – recordatorio en 1 hora',
          '⏰ 2 h – recordatorio en 2 horas',
          'Al activarse, una notificación muestra el péptido y la dosis.',
        ],
      },
      {
        q: '¿Qué significa la flecha naranja en el calendario?',
        a: 'La flecha naranja (📈 aumento activo) indica que ese día aplica un aumento de dosis de su ciclo. La dosis mostrada en el panel del día ya es la dosis total aumentada.',
      },
      {
        q: '¿Cómo cambio de mes?',
        a: 'Toque las flechas izquierda/derecha del nombre del mes.',
      },
      {
        q: '¿Puedo eliminar una dosis registrada?',
        a: 'Sí. En el panel del día hay un botón ✕ a la derecha de cada entrada → tóquelo y confirme.',
      },
      {
        q: '¿Por qué no hay fondo morado aunque tengo un ciclo?',
        a: [
          'Posibles motivos:',
          '• El ciclo está «Inactivo» → en Péptidos → ciclo → active el interruptor',
          '• Se muestra el mes equivocado → vaya al mes de inicio del ciclo',
          '• Las fechas de inicio/fin excluyen este mes',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Péptidos y stock',
    items: [
      {
        q: '¿Cómo creo un péptido nuevo?',
        a: [
          '1. Toque «+ Nuevo» arriba a la derecha',
          '2. Introduzca un nombre o elija de «Conocidos»',
          '3. Complete principio activo y reconstitución (mg/vial, líquido, jeringa)',
          '4. Introduzca stock, datos de lote y dosificación',
          '5. Opcionalmente suba un PDF o imagen del documento de análisis',
          '6. Toque «Guardar»',
        ],
      },
      {
        q: '¿Qué muestra el vial animado en la tarjeta del péptido?',
        a: [
          'Si introdujo stock, aparece un vial animado a la izquierda de la tarjeta:',
          '🟢 Verde = queda más del 50 % de stock',
          '🟡 Amarillo = 25–50 % de stock',
          '🔴 Rojo = menos del 25 % – se agota pronto',
          'El líquido se anima. En el móvil el vial se inclina con la orientación del dispositivo.',
        ],
      },
      {
        q: '¿Qué es el botón de información (icono de nota) en la tarjeta?',
        a: [
          'El icono de nota (📄) abre una ficha con todos los datos guardados:',
          '• Dosis y vía',
          '• Principio activo, volumen de líquido, jeringa',
          '• Fecha de reconstitución y caducidad con cuenta atrás',
          '• Stock y barra de progreso',
          '• Número de lote y origen',
          '• Documento de análisis: imágenes en línea, PDF como enlace',
          '• Notas',
        ],
      },
      {
        q: '¿Qué es la gestión de stock?',
        a: [
          'Puede indicar cuántos viales tiene:',
          '• «Viales disponibles» = stock actual',
          '• Al guardar por primera vez ese valor se toma como referencia del 100 %',
          '• La barra de progreso en la tarjeta muestra el consumo en color',
          '• La caducidad se calcula a partir de la fecha de reconstitución + vida útil',
        ],
      },
      {
        q: '¿Qué es la información de lote?',
        a: [
          'La información de lote documenta el origen de su péptido:',
          '• Número de lote = identificador del lote del fabricante',
          '• Origen = fabricante o proveedor (p. ej. «Peptide Sciences»)',
          '• Documento de análisis = subir PDF o imagen (COA, informe de laboratorio, factura)',
          'También aparece en la ficha de información del péptido.',
        ],
      },
      {
        q: '¿Qué significa «Líquido añadido (mL)»?',
        a: 'Es la cantidad de agua (p. ej. agua bacteriostática, NaCl o agua estéril para inyección) que añade al vial. Más líquido implica menor concentración. Los valores habituales son 1–2 mL.',
      },
      {
        q: '¿Qué significan los campos de jeringa «mL» y «unidades»?',
        a: [
          'Estos dos campos describen su jeringa:',
          '• mL = volumen total de la jeringa (p. ej. 1 mL)',
          '• Unidades = marcas máximas de la escala (p. ej. 100 en una jeringa U-100)',
          '→ De ahí: unidades/mL = marcas por mililitro',
          'Jeringa de insulina U-100 estándar: 1 mL / 100 unidades = 100 unidades/mL',
        ],
      },
      {
        q: '¿Qué es la vida útil tras la reconstitución?',
        a: [
          'Tras disolver el péptido solo es estable un tiempo limitado (en nevera):',
          '10–14 días = péptidos de vida corta',
          '21–28 días = habitual para péptidos reconstituidos',
          '42–90 días = péptidos especialmente estables',
          'La caducidad se calcula con fecha de reconstitución + días elegidos y se muestra en color.',
        ],
      },
      {
        q: '¿Cómo añado un ciclo desde la tarjeta del péptido?',
        a: 'Cada tarjeta tiene un botón morado «Añadir ciclo» abajo a la derecha. Tóquelo; no hace falta expandir el péptido antes.',
      },
      {
        q: '¿Qué muestra la flecha con el recuento de ciclos abajo?',
        a: 'La flecha pequeña abajo a la izquierda (p. ej. «▼ 2 ciclos») expande o contrae la vista de ciclos. Ve de un vistazo cuántos ciclos hay para ese péptido.',
      },
      {
        q: '¿Cómo busco un péptido?',
        a: 'Cuando hay péptidos, aparece un campo de búsqueda arriba. Escriba un nombre: la lista se filtra sola. Use el desplegable al lado para ordenar A→Z o Z→A.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Calculadora',
    items: [
      {
        q: '¿Qué puede hacer la calculadora?',
        a: [
          'Con sus datos la calculadora obtiene:',
          '• Unidades a aspirar – cuántas marcas en la jeringa',
          '• Concentración – mg/mL de la solución final',
          '• Llenado de jeringa – qué porcentaje de la jeringa aspira',
          '• Dosis por vial – cuántas inyecciones salen de un vial',
        ],
      },
      {
        q: '¿Qué es la escala de la jeringa?',
        a: [
          'La escala de colores arriba muestra visualmente cuántas unidades aspirar:',
          '• La barra se llena de izquierda (azul) a derecha (morado → rosa)',
          '• La línea blanca marca el punto exacto',
          '• El número grande arriba muestra las unidades',
          'Ve al momento si su dosis cabe en la jeringa.',
        ],
      },
      {
        q: '¿Qué datos necesita la calculadora?',
        a: [
          '• Tamaño de jeringa – elija un preset (p. ej. 1 mL / 100 unidades) o valores personalizados',
          '• Activo por vial – mg del vial (p. ej. 10 mg)',
          '• Líquido añadido – cuántos mL añadió (p. ej. 2 mL)',
          '• Dosis – dosis objetivo con unidad (mcg, mg, UI)',
        ],
      },
      {
        q: '¿Qué presets de jeringa hay?',
        a: [
          '• 1 mL · 100 unidades (U-100) – jeringa de insulina estándar',
          '• 0,5 mL · 50 unidades (U-100) – jeringa de insulina pequeña',
          '• 0,3 mL · 30 unidades (U-100) – jeringa muy pequeña',
          '• 2 mL · 200 unidades (U-100) – jeringa más grande',
          '• 1 mL · 40 unidades (U-40) – jeringa U-40 antigua',
          'O: introduzca mL y unidades personalizados.',
        ],
      },
      {
        q: 'Ejemplo – ¿cómo funciona el cálculo?',
        a: [
          'Ejemplo: BPC-157, vial 5 mg, 2 mL de agua, dosis 500 mcg, jeringa U-100',
          '→ Concentración: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volumen: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Unidades: 0,200 mL × 100 unidades/mL = 20 unidades',
          '→ Dosis/vial: 5000 mcg ÷ 500 mcg = 10 dosis',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Ciclos',
    items: [
      {
        q: '¿Qué es un ciclo?',
        a: 'Un ciclo es un plan de ingesta estructurado para un péptido. Define dosis, método, frecuencia, intervalo de fechas, hora de ingesta opcional y recordatorios.',
      },
      {
        q: '¿Cómo creo un ciclo?',
        a: [
          '1. En la tarjeta del péptido toque «+ Añadir ciclo» (botón morado)',
          '2. Complete nombre, dosis, frecuencia y fechas',
          '3. Opcionalmente configure hora de ingesta y recordatorios',
          '4. Toque «Guardar»',
          '¡El ciclo aparece en el calendario automáticamente!',
        ],
      },
      {
        q: '¿Qué opciones de frecuencia hay?',
        a: [
          '• Diario · Dos veces al día · Día sí, día no',
          '• 5 días activos / 2 de descanso (5on/2off)',
          '• Lun–Vie · Semanal',
          '• Cada X días – intervalo personalizado',
          '• Elegir días de la semana – p. ej. solo lun, mié, vie',
        ],
      },
      {
        q: '¿Qué significa el interruptor Activo/Inactivo?',
        a: 'Activo = el ciclo aparece en el calendario (días morados). Inactivo = ciclo en pausa, no visible en el calendario. Cambie tocando el interruptor a la derecha del ciclo.',
      },
      {
        q: '¿Qué es la hora de ingesta?',
        a: [
          'Opcional – fija la hora del día:',
          '🌅 Mañana = 08:00 · ☀️ Mediodía = 12:00 · 🌙 Noche = 20:00 · 🕐 Hora personalizada',
          'Se usa para recordatorios. Es opcional; puede dejarlo vacío.',
        ],
      },
      {
        q: '¿Cómo funcionan los recordatorios?',
        a: [
          'Los recordatorios son de selección múltiple; puede elegir varios:',
          '• 1 día antes – aviso 24 horas antes de la ingesta',
          '• 2 h antes – aviso con 2 horas de antelación',
          '• En la ingesta – justo a la hora configurada',
          'La app pide permiso de notificaciones al guardar.',
          'Importante: solo funciona con la app abierta.',
        ],
      },
      {
        q: '¿Puedo tener varios ciclos para un péptido?',
        a: 'Sí, los que quiera. Todos los ciclos activos aparecen en el calendario. Útil, p. ej., para mañana + noche o fases de dosificación distintas.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Aumentos de dosis',
    items: [
      {
        q: '¿Qué es un aumento de dosis?',
        a: 'Una subida planificada de dosis dentro de un ciclo. Ejemplo: empezar en 200 mcg, a las 2 semanas +100 mcg, a las 4 semanas otros +100 mcg. Son posibles varios escalones.',
      },
      {
        q: '¿Cómo añado un aumento de dosis?',
        a: [
          '1. Expanda el péptido → busque el ciclo → sección «Aumentos de dosis»',
          '2. Toque «+ Añadir»',
          '3. Introduzca cantidad del aumento y unidad',
          '4. Elija inicio: fecha fija / tras X días / tras X semanas',
          '5. Opcionalmente añada una nota → Guardar',
        ],
      },
      {
        q: '¿Se muestra el aumento de dosis en el calendario?',
        a: [
          '¡Sí! Desde que aplica un aumento:',
          '• El 📈 naranja en el panel del día indica «Escalón X activo»',
          '• La dosis mostrada ya es el total aumentado (base + aumento)',
          '• El icono de aumento aparece en la leyenda del calendario',
        ],
      },
      {
        q: '¿Qué significan las opciones de inicio?',
        a: [
          '• Fecha fija – desde qué día aplica el aumento',
          '• Tras X días – X días después del inicio del ciclo',
          '• Tras X semanas – días equivalentes tras el inicio del ciclo',
        ],
      },
      {
        q: '¿Puedo tener varios escalones?',
        a: 'Sí, los que quiera. Se numeran #1, #2, #3. Todos los escalones activos se suman.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Diario',
    items: [
      {
        q: '¿Qué es el diario?',
        a: 'Aquí documenta efectos y efectos secundarios de sus péptidos. Le ayuda a ver patrones: qué efectos aparecen, cuándo, con qué intensidad y cuánto duran.',
      },
      {
        q: '¿Cuál es la diferencia entre efecto y efecto secundario?',
        a: [
          '✅ Efecto (verde) = resultado deseado (sueño, curación, energía...)',
          '⚠️ Efecto secundario (naranja) = resultado no deseado (dolor, fatiga...)',
        ],
      },
      {
        q: '¿Qué significan las opciones de estado?',
        a: [
          '🔘 Pendiente – aún no ha ocurrido',
          '✅ Ocurrido – presente de forma activa',
          '⏳ Sigue en curso – continúa',
          '✅ Desvanecido – terminado',
          'Cambie el estado en la tarjeta directamente sin abrir el formulario.',
        ],
      },
      {
        q: '¿Qué es la escala de intensidad (1–5)?',
        a: [
          '1 = Apenas perceptible · 2 = Leve · 3 = Moderado · 4 = Fuerte · 5 = Muy fuerte',
        ],
      },
      {
        q: '¿Cómo filtro y busco en el diario?',
        a: [
          '• Pestañas: Todos / Efectos / Efectos secundarios',
          '• Búsqueda: filtra por descripción y nombre del péptido',
          '• Orden: fecha (nueva/antigua), intensidad (alta/baja)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Reseñas',
    items: [
      {
        q: '¿Qué son las reseñas?',
        a: 'Informes personales de experiencia sobre péptidos concretos. Con estrellas (1–5), experiencia global (buena/media/mala), pros y contras, y un texto detallado.',
      },
      {
        q: '¿Cómo creo una reseña?',
        a: [
          '1. En «Reseñas» toque «+ Nuevo»',
          '2. Elija péptido → asigne estrellas → elija experiencia',
          '3. Introduzca título (obligatorio) → opcionalmente informe, pros, contras',
          '4. Guardar',
        ],
      },
      {
        q: '¿Cómo busco y ordeno reseñas?',
        a: [
          '• Búsqueda: título y nombre del péptido',
          '• Orden: más recientes / más antiguas / valoración alta / valoración baja',
        ],
      },
      {
        q: '¿Puedo compartir reseñas en mi perfil?',
        a: 'Sí. En «Perfil» active el interruptor «Reseñas»; entonces aparecen en su enlace de perfil público.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Perfil y compartir',
    items: [
      {
        q: '¿Qué puedo introducir en mi perfil?',
        a: [
          '• Nombre de usuario (para el enlace para compartir) – obligatorio',
          '• Nombre visible, edad, sexo, peso, altura',
          '• Notas personales (solo para usted)',
          '• Bio pública (visible en el perfil compartido)',
        ],
      },
      {
        q: '¿Cómo activo el perfil público?',
        a: [
          '1. Introduzca nombre de usuario y guarde el perfil',
          '2. Active el interruptor principal «Compartir perfil»',
          '3. Active áreas concretas (Péptidos / Calendario / Diario / Reseñas)',
          '4. Guardar → aparece el enlace y puede copiarlo',
        ],
      },
      {
        q: '¿Qué contenido puedo compartir?',
        a: [
          'Cada área tiene su propio interruptor:',
          '🧪 Péptidos · 📅 Calendario y ciclos · 📖 Diario · ⭐ Reseñas',
          'Puede, p. ej., compartir solo reseñas y dejar el resto en privado.',
        ],
      },
      {
        q: '¿Puedo desactivar el compartir en cualquier momento?',
        a: 'Sí. Desactive «Compartir perfil» → guarde. El enlace muestra al instante «Este perfil es privado».',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Recordatorios y aplazar',
    items: [
      {
        q: '¿Cómo configuro recordatorios?',
        a: [
          '1. Cree o edite un ciclo',
          '2. Configure la hora de ingesta (mañana/mediodía/noche/personalizada)',
          '3. En «Recordatorio» elija una o más opciones (selección múltiple)',
          '4. Guardar → la app pide permiso de notificaciones',
        ],
      },
      {
        q: '¿Puedo elegir varias horas de recordatorio?',
        a: 'Sí. Puede activar, p. ej., «1 día antes» y «En la ingesta» a la vez. Las marcas indican cuáles están activos.',
      },
      {
        q: '¿Cuál es la diferencia entre recordatorio y aplazar?',
        a: [
          'Recordatorio (en el ciclo) = aviso planificado antes de la ingesta',
          'Aplazar (en el calendario) = aviso de seguimiento tras marcar una dosis como «No tomada» (15 min / 30 min / 1 h / 2 h)',
        ],
      },
      {
        q: '¿Por qué no recibo recordatorios?',
        a: [
          '• Permiso de notificaciones denegado → actívelo en ajustes del teléfono',
          '• La app no estaba abierta a la hora del recordatorio',
          '• La hora del recordatorio de hoy ya pasó',
          '• El ciclo está «Inactivo»',
        ],
      },
      {
        q: '¿Funcionan los recordatorios con la app cerrada?',
        a: 'De momento no. Las notificaciones son del navegador y requieren la app abierta (pestaña o PWA). La entrega en segundo plano necesitaría un servicio push.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Técnica y privacidad',
    items: [
      {
        q: '¿Por qué veo «Error al guardar»?',
        a: [
          '• Sin conexión a internet',
          '• Faltan campos obligatorios',
          '• Sesión caducada → cierre sesión y vuelva a entrar',
          '• Subida de PDF: el bucket de almacenamiento aún no está configurado → ejecute el SQL en Supabase',
        ],
      },
      {
        q: '¿Por qué no puedo subir un PDF?',
        a: [
          'El bucket de almacenamiento «batch-files» debe configurarse una vez en Supabase:',
          '1. supabase.com → su proyecto → Editor SQL → pestaña nueva',
          '2. Pegue y ejecute el SQL de «supabase-inventory.sql»',
          'Las subidas funcionan enseguida después.',
        ],
      },
      {
        q: '¿Qué pasa con mis datos al cerrar sesión?',
        a: 'Sus datos permanecen en el servidor. Tras el siguiente inicio de sesión todas las entradas siguen ahí.',
      },
      {
        q: '¿Se borran los datos si desinstalo la app?',
        a: 'No. Los datos están en el servidor (Supabase), independientes del dispositivo. Solo inicie sesión de nuevo en cualquier dispositivo.',
      },
      {
        q: '¿La app es apta para uso médico?',
        a: 'No. Solo para investigación y documentación. No sustituye el consejo médico. Consulte siempre a un médico.',
      },
      {
        q: '¿Puedo usar la app en una tablet u otro dispositivo?',
        a: [
          'Sí. Al estar todo en la nube, la app funciona en cualquier número de dispositivos:',
          '1. Abra la misma URL en el navegador',
          '2. Inicie sesión con la misma cuenta',
          '3. Todos los datos están disponibles al instante',
          'Para acceso al código (desarrollo): clone el repositorio en GitHub.',
        ],
      },
    ],
  },
]
