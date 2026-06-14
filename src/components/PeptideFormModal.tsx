import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown, ChevronRight, ChevronUp, Check, FileUp, FlaskConical, X,
} from 'lucide-react'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import type { PeptideForm, PkProfileOption } from '../lib/peptideFormTypes'

const EXPIRY_PRESETS = [10, 14, 21, 28, 42, 90]
const POPULAR_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295', 'GHK-Cu', 'Epitalon',
  'Selank', 'Semax', 'PT-141', 'Retatrutide', 'Semaglutid', 'Tirzepatid',
  'IGF-1 LR3', 'GHRP-2', 'GHRP-6', 'Sermorelin', 'AOD 9604',
  'Thymosin Alpha-1', 'LL-37', 'Hexarelin', 'MGF',
]
const UNITS = ['mcg', 'mg', 'IU', 'ml', 'nmol']
const METHODS = ['Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere']
const METHOD_KEYS: Record<string, string> = {
  Subkutan: 'method_subkutan', Intramuskulär: 'method_intramusk', Nasal: 'method_nasal',
  Oral: 'method_oral', Transdermal: 'method_transdermal', Intravenös: 'method_intravenoese', Andere: 'method_andere',
}
const COLOR_OPTIONS = [
  '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#34d399', '#f97316',
  '#60a5fa', '#fb7185', '#2dd4bf', '#facc15', '#c084fc', '#4ade80',
]

type FieldId =
  | 'name' | 'color' | 'vial_amount_mg' | 'reconstitution_ml'
  | 'reconstitution_date' | 'expiry_days' | 'vials_in_stock'
  | 'batch_number' | 'batch_source' | 'batch_doc'
  | 'default_method' | 'default_dose' | 'notes'

interface PeptideFormModalProps {
  editingPeptideId: string | null
  pForm: PeptideForm
  setPForm: React.Dispatch<React.SetStateAction<PeptideForm>>
  batchFile: File | null
  setBatchFile: (file: File | null) => void
  savingPeptide: boolean
  uploadingFile: boolean
  onClose: () => void
  onSave: () => void
  pkSuggestOpen: boolean
  setPkSuggestOpen: (open: boolean) => void
  pepPkSuggestions: PkProfileOption[]
  selectPepPkProfile: (profile: PkProfileOption) => void
  handlePepNameChange: (value: string) => void
  showDropdown: boolean
  setShowDropdown: React.Dispatch<React.SetStateAction<boolean>>
}

function FormListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-800/25 overflow-hidden">
      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="divide-y divide-slate-800/80">{children}</div>
    </div>
  )
}

function FormListRow({
  label,
  value,
  valueNode,
  onClick,
  dataOb,
}: {
  label: string
  value?: string
  valueNode?: ReactNode
  onClick: () => void
  dataOb?: string
}) {
  return (
    <button
      type="button"
      data-ob={dataOb}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/50 transition-colors"
    >
      <span className="text-sm text-slate-200 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 flex justify-end items-center gap-2">
        {valueNode ?? (
          <span className={`text-sm truncate ${value && value !== '—' ? 'text-slate-400' : 'text-slate-600'}`}>
            {value}
          </span>
        )}
      </span>
      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </button>
  )
}

export function PeptideFormModal({
  editingPeptideId,
  pForm,
  setPForm,
  batchFile,
  setBatchFile,
  savingPeptide,
  uploadingFile,
  onClose,
  onSave,
  pkSuggestOpen,
  setPkSuggestOpen,
  pepPkSuggestions,
  selectPepPkProfile,
  handlePepNameChange,
  showDropdown,
  setShowDropdown,
}: PeptideFormModalProps) {
  const { t } = useTranslation()
  const [activeField, setActiveField] = useState<FieldId | null>(null)
  const [moreOpen, setMoreOpen] = useState(true)

  const notSet = String(t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' }))

  useEffect(() => {
    if (!activeField) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveField(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeField])

  const displayValues: Record<FieldId, string> = {
    name: pForm.name.trim() || notSet,
    color: pForm.color_hex ? t('peptide_form_color_set', { defaultValue: 'Gewählt' }) : notSet,
    vial_amount_mg: pForm.vial_amount_mg ? `${pForm.vial_amount_mg} mg` : notSet,
    reconstitution_ml: pForm.reconstitution_ml ? `${pForm.reconstitution_ml} mL` : notSet,
    reconstitution_date: pForm.reconstitution_date
      ? format(parseISO(pForm.reconstitution_date), 'dd.MM.yyyy')
      : notSet,
    expiry_days: pForm.expiry_days
      ? t('n_tage_expiry', { n: parseInt(pForm.expiry_days, 10) || pForm.expiry_days })
      : notSet,
    vials_in_stock: pForm.vials_in_stock !== '' ? pForm.vials_in_stock : notSet,
    batch_number: pForm.batch_number.trim() || notSet,
    batch_source: pForm.batch_source.trim() || notSet,
    batch_doc: batchFile
      ? batchFile.name
      : pForm.batch_file_url
        ? t('datei_vorhanden_text')
        : notSet,
    default_method: pForm.default_method
      ? String(t(METHOD_KEYS[pForm.default_method] ?? pForm.default_method))
      : notSet,
    default_dose: pForm.default_dose
      ? `${pForm.default_dose} ${pForm.default_unit}`
      : notSet,
    notes: pForm.notes.trim()
      ? (pForm.notes.length > 28 ? `${pForm.notes.slice(0, 28)}…` : pForm.notes)
      : notSet,
  }

  const fieldLabels: Record<FieldId, string> = {
    name: t('peptidname_star'),
    color: String(t('peptide_form_color_label', { defaultValue: 'Farbe' })),
    vial_amount_mg: t('wirkstoff_pro_vial_form'),
    reconstitution_ml: t('zugefuegte_fl_ml'),
    reconstitution_date: t('datum_rekonstitution'),
    expiry_days: t('haltbarkeit'),
    vials_in_stock: t('vorraetige_vials'),
    batch_number: t('batch'),
    batch_source: t('quelle'),
    batch_doc: t('analyse_dok_pdf_bild'),
    default_method: t('applikationsart_label'),
    default_dose: t('standard_dosis_label'),
    notes: t('notizen_optional'),
  }

  const closeField = () => setActiveField(null)

  const renderFieldEditor = () => {
    if (!activeField) return null

    let body: ReactNode = null

    switch (activeField) {
      case 'name':
        body = (
          <div className="space-y-3">
            <div className="relative">
              <input
                className="input w-full text-base"
                placeholder={t('peptidname_star')}
                value={pForm.name}
                onChange={e => handlePepNameChange(e.target.value)}
                onFocus={() => setPkSuggestOpen(true)}
                autoComplete="off"
                autoFocus
              />
              {pkSuggestOpen && pepPkSuggestions.length > 0 && (
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  {pepPkSuggestions.map(profile => (
                    <button
                      key={profile.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                      onClick={() => { selectPepPkProfile(profile); setPkSuggestOpen(false) }}
                    >
                      <span className="text-white font-medium">{profile.name}</span>
                      {profile.aliases.length > 0 && (
                        <span className="block text-xs text-slate-500 mt-0.5 truncate">{profile.aliases.join(', ')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                className="btn-secondary w-full flex items-center justify-center gap-1 text-sm"
                onClick={() => { setShowDropdown(d => !d); setPkSuggestOpen(false) }}
              >
                {t('bekannte_btn')} <ChevronDown size={14} />
              </button>
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 max-h-52 overflow-y-auto">
                  {POPULAR_PEPTIDES.map(name => (
                    <button
                      key={name}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
                      onClick={() => { handlePepNameChange(name); setShowDropdown(false) }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {pForm.pk_profile_id && (
              <span data-ob="pep-pk-badge" className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{ color: 'var(--accent)', background: 'var(--accent-weak)', border: '1px solid var(--accent-border)' }}>
                <Check size={11} /> {t('pk_profil_verknuepft', { defaultValue: 'PK-Profil verknüpft' })}
              </span>
            )}
          </div>
        )
        break
      case 'color':
        body = (
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setPForm(f => ({ ...f, color_hex: c }))}
                style={{
                  width: 36, height: 36, borderRadius: 10, background: c, flexShrink: 0,
                  border: pForm.color_hex === c ? '2px solid #fff' : '2px solid transparent',
                  opacity: pForm.color_hex === c ? 1 : 0.55,
                }}
              />
            ))}
          </div>
        )
        break
      case 'vial_amount_mg':
        body = (
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1 text-base"
              type="number"
              inputMode="decimal"
              placeholder={t('eg_10')}
              value={pForm.vial_amount_mg}
              onChange={e => setPForm(f => ({ ...f, vial_amount_mg: e.target.value }))}
              autoFocus
            />
            <span className="text-slate-500 text-sm font-semibold shrink-0">mg</span>
          </div>
        )
        break
      case 'reconstitution_ml':
        body = (
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1 text-base"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={t('eg_2')}
              value={pForm.reconstitution_ml}
              onChange={e => setPForm(f => ({ ...f, reconstitution_ml: e.target.value }))}
              autoFocus
            />
            <span className="text-slate-500 text-sm font-semibold shrink-0">mL</span>
          </div>
        )
        break
      case 'reconstitution_date':
        body = (
          <input
            className="input w-full text-base"
            type="date"
            value={pForm.reconstitution_date}
            onChange={e => setPForm(f => ({ ...f, reconstitution_date: e.target.value }))}
            autoFocus
          />
        )
        break
      case 'expiry_days':
        body = (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {EXPIRY_PRESETS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPForm(f => ({ ...f, expiry_days: d.toString() }))}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    pForm.expiry_days === d.toString()
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {t('n_tage_expiry', { n: d })}
                </button>
              ))}
            </div>
            <input
              className="input w-full text-base"
              type="number"
              placeholder={t('individuel_ph')}
              value={EXPIRY_PRESETS.includes(parseInt(pForm.expiry_days, 10)) ? '' : pForm.expiry_days}
              onChange={e => setPForm(f => ({ ...f, expiry_days: e.target.value }))}
            />
            {pForm.reconstitution_date && pForm.expiry_days && (() => {
              const exp = addDays(parseISO(pForm.reconstitution_date), parseInt(pForm.expiry_days, 10))
              const days = differenceInDays(exp, new Date())
              return (
                <p className={`text-xs ${days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {days > 0
                    ? t('ablaufdatum_text', { date: format(exp, 'dd.MM.yyyy'), n: days })
                    : t('ablaufdatum_abgelaufen', { date: format(exp, 'dd.MM.yyyy') })}
                </p>
              )
            })()}
          </div>
        )
        break
      case 'vials_in_stock':
        body = (
          <div className="space-y-2">
            <input
              className="input w-full text-base"
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={pForm.vials_in_stock}
              onChange={e => setPForm(f => ({ ...f, vials_in_stock: e.target.value }))}
              autoFocus
            />
            <p className="text-slate-600 text-xs">{t('basis_info')}</p>
          </div>
        )
        break
      case 'batch_number':
        body = (
          <input
            className="input w-full text-base"
            placeholder={t('eg_batch_nr')}
            value={pForm.batch_number}
            onChange={e => setPForm(f => ({ ...f, batch_number: e.target.value }))}
            autoFocus
          />
        )
        break
      case 'batch_source':
        body = (
          <input
            className="input w-full text-base"
            placeholder={t('eg_source_name')}
            value={pForm.batch_source}
            onChange={e => setPForm(f => ({ ...f, batch_source: e.target.value }))}
            autoFocus
          />
        )
        break
      case 'batch_doc':
        body = (
          <div className="space-y-3">
            <label className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
              batchFile ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600'
            }`}>
              <FileUp size={20} className={batchFile ? 'text-sky-400' : 'text-slate-500'} />
              <div className="flex-1 min-w-0">
                {batchFile
                  ? <p className="text-sky-400 text-sm font-medium truncate">{batchFile.name}</p>
                  : pForm.batch_file_url
                    ? <p className="text-slate-300 text-sm truncate">{t('datei_vorhanden_text')}</p>
                    : <p className="text-slate-500 text-sm">{t('pdf_bild_auswaehlen')}</p>}
                <p className="text-slate-600 text-xs mt-0.5">{t('coa_rechnung_label')}</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => { if (e.target.files?.[0]) setBatchFile(e.target.files[0]) }}
              />
            </label>
            {pForm.batch_file_url && !batchFile && (
              <div className="flex items-center gap-2">
                <a href={pForm.batch_file_url} target="_blank" rel="noopener noreferrer"
                  className="text-sky-400 text-xs hover:underline flex-1 truncate">
                  {t('dokument_anzeigen')}
                </a>
                <button
                  type="button"
                  className="text-red-400 text-xs hover:text-red-300"
                  onClick={() => setPForm(f => ({ ...f, batch_file_url: '' }))}
                >
                  {t('entfernen')}
                </button>
              </div>
            )}
          </div>
        )
        break
      case 'default_method':
        body = (
          <select
            className="select w-full text-base"
            value={pForm.default_method}
            onChange={e => setPForm(f => ({ ...f, default_method: e.target.value }))}
            autoFocus
          >
            {METHODS.map(m => (
              <option key={m} value={m}>{t(METHOD_KEYS[m] ?? m)}</option>
            ))}
          </select>
        )
        break
      case 'default_dose':
        body = (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="input flex-1 text-base"
                type="number"
                inputMode="decimal"
                placeholder={t('eg_500')}
                value={pForm.default_dose}
                onChange={e => setPForm(f => ({ ...f, default_dose: e.target.value }))}
                autoFocus
              />
              <select
                className="select w-24 text-base"
                value={pForm.default_unit}
                onChange={e => setPForm(f => ({ ...f, default_unit: e.target.value }))}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <p className="text-slate-600 text-xs">{t('fallback_info')}</p>
          </div>
        )
        break
      case 'notes':
        body = (
          <textarea
            className="input resize-none w-full text-base"
            rows={4}
            value={pForm.notes}
            onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))}
            autoFocus
          />
        )
        break
    }

    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-[60]" onClick={closeField} />
        <div className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center pointer-events-none">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700/60 border-b-0 rounded-t-2xl pointer-events-auto shadow-card max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-8 h-1 bg-slate-700 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-white">{fieldLabels[activeField]}</h3>
              <button type="button" onClick={closeField} className="p-1.5 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">{body}</div>
            <div className="px-5 py-4 border-t border-slate-800 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" className="btn-primary w-full" onClick={closeField}>
                {t('peptide_form_apply', { defaultValue: 'Übernehmen' })}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal onClick={onClose}>
      <div
        className="bg-slate-900 rounded-t-2xl w-full max-w-lg flex flex-col max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-sky-400" />
            <h2 className="font-bold text-white text-lg">
              {editingPeptideId ? t('peptid_bearbeiten_title') : t('neues_peptid_title')}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <FormListCard title={t('peptide_form_group_substance', { defaultValue: 'Substanz' })}>
            <FormListRow
              label={t('peptidname_star')}
              value={displayValues.name}
              onClick={() => setActiveField('name')}
              dataOb="pep-name"
            />
            <FormListRow
              label={String(t('peptide_form_color_label', { defaultValue: 'Farbe' }))}
              value={displayValues.color}
              valueNode={pForm.color_hex ? (
                <span
                  className="w-5 h-5 rounded-md shrink-0 border border-white/20"
                  style={{ background: pForm.color_hex }}
                />
              ) : undefined}
              onClick={() => setActiveField('color')}
              dataOb="pep-color"
            />
          </FormListCard>

          <FormListCard title={t('peptide_form_group_recon', { defaultValue: 'Rekonstitution' })}>
            <FormListRow
              label={t('wirkstoff_pro_vial_form')}
              value={displayValues.vial_amount_mg}
              onClick={() => setActiveField('vial_amount_mg')}
              dataOb="pep-mg"
            />
            <FormListRow
              label={t('zugefuegte_fl_ml')}
              value={displayValues.reconstitution_ml}
              onClick={() => setActiveField('reconstitution_ml')}
              dataOb="pep-liquid"
            />
            <FormListRow
              label={t('datum_rekonstitution')}
              value={displayValues.reconstitution_date}
              onClick={() => setActiveField('reconstitution_date')}
              dataOb="pep-recon-date"
            />
            <FormListRow
              label={t('haltbarkeit')}
              value={displayValues.expiry_days}
              onClick={() => setActiveField('expiry_days')}
              dataOb="pep-expiry"
            />
          </FormListCard>

          <FormListCard title={t('bestand_section')}>
            <FormListRow
              label={t('vorraetige_vials')}
              value={displayValues.vials_in_stock}
              onClick={() => setActiveField('vials_in_stock')}
              dataOb="pep-vials"
            />
          </FormListCard>

          <FormListCard title={t('peptide_form_group_dosage', { defaultValue: 'Dosierung' })}>
            <FormListRow
              label={t('applikationsart_label')}
              value={displayValues.default_method}
              onClick={() => setActiveField('default_method')}
              dataOb="pep-method"
            />
            <FormListRow
              label={t('standard_dosis_label')}
              value={displayValues.default_dose}
              onClick={() => setActiveField('default_dose')}
              dataOb="pep-dose-amount"
            />
          </FormListCard>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/25 overflow-hidden">
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/50 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex-1">
                {t('peptide_form_group_more', { defaultValue: 'Mehr Optionen' })}
              </span>
              {moreOpen ? <ChevronUp size={16} className="text-slate-600" /> : <ChevronDown size={16} className="text-slate-600" />}
            </button>
            {moreOpen && (
              <div className="divide-y divide-slate-800/80 border-t border-slate-800/80">
                <FormListRow
                  label={t('batch')}
                  value={displayValues.batch_number}
                  onClick={() => setActiveField('batch_number')}
                  dataOb="pep-batch"
                />
                <FormListRow
                  label={t('quelle')}
                  value={displayValues.batch_source}
                  onClick={() => setActiveField('batch_source')}
                  dataOb="pep-source"
                />
                <FormListRow
                  label={t('analyse_dok_pdf_bild')}
                  value={displayValues.batch_doc}
                  onClick={() => setActiveField('batch_doc')}
                  dataOb="pep-doc"
                />
                <FormListRow
                  label={t('notizen_optional')}
                  value={displayValues.notes}
                  onClick={() => setActiveField('notes')}
                  dataOb="pep-notes"
                />
              </div>
            )}
          </div>
        </div>

        <div
          className="shrink-0 border-t border-slate-800 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-900"
          data-ob="pep-dose"
        >
          <button
            type="button"
            data-ob="btn-pep-save"
            className="btn-primary w-full"
            onClick={onSave}
            disabled={savingPeptide || uploadingFile}
          >
            {uploadingFile ? t('laedt_hoch') : savingPeptide ? t('loading') : t('save')}
          </button>
        </div>
      </div>

      {renderFieldEditor()}
    </div>
  )
}
