import { useState, useEffect, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, MapPin, Clock, Users, Trash2, Pencil, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { meetingsApi, usersApi } from '../services/api'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import PageError from '../components/ui/PageError'
import useAuthStore from '../store/authStore'

// ─── Formulário de reunião ────────────────────────────────────────────────────

function MeetingForm({ meeting, users, onSave, onClose, prefilledDate }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    defaultValues: meeting
      ? {
          title: meeting.title,
          description: meeting.description || '',
          startAt: meeting.startAt?.slice(0, 16) || '',
          endAt: meeting.endAt?.slice(0, 16) || '',
          location: meeting.location || '',
          attendeeIds: meeting.attendees?.map((a) => a.userId) || [],
        }
      : (() => {
          const now  = new Date()
          const pad  = (n) => String(n).padStart(2, '0')
          const date = prefilledDate || format(now, 'yyyy-MM-dd')
          const h    = now.getHours()
          // Garante que endAt não ultrapasse 23:59 (evita "T24:00" inválido)
          const startH = pad(h)
          const endH   = h < 23 ? pad(h + 1) : '23'
          const endM   = h < 23 ? '00' : '59'
          return {
            startAt: `${date}T${startH}:00`,
            endAt:   `${date}T${endH}:${endM}`,
          }
        })(),
  })

  async function onSubmit(data) {
    try {
      // datetime-local retorna "YYYY-MM-DDTHH:mm" sem timezone.
      // Adicionamos ":00Z" para forçar UTC — evita drift de timezone entre
      // o que o usuário digitou e o que chega no backend.
      const toISO = (dt) => {
        if (!dt) return dt
        // Se já tem Z ou +, está completo; senão, assume UTC local
        return /Z|[+-]\d{2}:\d{2}$/.test(dt) ? dt : new Date(dt).toISOString()
      }
      const payload = {
        ...data,
        startAt: toISO(data.startAt),
        endAt:   toISO(data.endAt),
        attendeeIds: data.attendeeIds || [],
      }
      if (meeting) {
        await meetingsApi.update(meeting.id, payload)
        toast.success('Reunião atualizada!')
      } else {
        await meetingsApi.create(payload)
        toast.success('Reunião criada!')
      }
      onSave()
    } catch (err) {
      const details = err?.response?.data?.error?.details
      toast.error(details?.[0]?.message || err?.response?.data?.error?.message || 'Erro ao salvar reunião')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Título */}
      <div>
        <label className="label">Título *</label>
        <input type="text" placeholder="Ex: Reunião de planejamento"
          className={`input-field ${errors.title ? 'border-rose-400' : ''}`}
          {...register('title', {
            required: 'Título obrigatório',
            minLength: { value: 2, message: 'Mínimo 2 caracteres' },
            maxLength: { value: 200, message: 'Máximo 200 caracteres' },
          })}
        />
        {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title.message}</p>}
      </div>

      {/* Início / Fim */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Início *</label>
          <input type="datetime-local"
            className={`input-field ${errors.startAt ? 'border-rose-400' : ''}`}
            {...register('startAt', { required: 'Data de início obrigatória' })}
          />
          {errors.startAt && <p className="text-rose-500 text-xs mt-1">{errors.startAt.message}</p>}
        </div>
        <div>
          <label className="label">Fim *</label>
          <input type="datetime-local"
            className={`input-field ${errors.endAt ? 'border-rose-400' : ''}`}
            {...register('endAt', {
              required: 'Data de fim obrigatória',
              validate: (v) => {
                const startAt = watch('startAt')
                if (startAt && v && new Date(v) <= new Date(startAt)) {
                  return 'Fim deve ser posterior ao início'
                }
                return true
              },
            })}
          />
          {errors.endAt && <p className="text-rose-500 text-xs mt-1">{errors.endAt.message}</p>}
        </div>
      </div>

      {/* Local */}
      <div>
        <label className="label">Local</label>
        <input type="text" placeholder="Ex: Sala de reuniões, Google Meet…"
          className="input-field" maxLength={300}
          {...register('location', { maxLength: { value: 300, message: 'Máximo 300 caracteres' } })}
        />
        {errors.location && <p className="text-rose-500 text-xs mt-1">{errors.location.message}</p>}
      </div>

      {/* Descrição */}
      <div>
        <label className="label">Descrição</label>
        <textarea rows={3} placeholder="Pauta da reunião…"
          className="input-field resize-none" maxLength={2000}
          {...register('description', { maxLength: { value: 2000, message: 'Máximo 2000 caracteres' } })}
        />
        {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
      </div>

      {/* Participantes */}
      {users.length > 0 && (
        <div>
          <label className="label">Participantes</label>
          <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                <input type="checkbox" value={u.id}
                  className="rounded text-blue-600"
                  {...register('attendeeIds')}
                />
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">{u.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">{u.name}</p>
                  <p className="text-[10px] text-slate-400">{u.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
          {isSubmitting ? <Spinner size="sm" /> : meeting ? 'Salvar' : 'Criar reunião'}
        </button>
      </div>
    </form>
  )
}

// ─── Detalhe da reunião ───────────────────────────────────────────────────────

function MeetingDetail({ meeting, onEdit, onDelete, onClose }) {
  const user = useAuthStore((s) => s.user)
  const canEdit = Boolean(user) && (
    user.role === 'ADMIN' ||
    user.role === 'MANAGER' ||
    meeting.createdById === user.id
  )
  const [delLoading, setDelLoading] = useState(false)

  async function handleDelete() {
    setDelLoading(true)
    try {
      await meetingsApi.delete(meeting.id)
      toast.success('Reunião excluída')
      onDelete()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Erro ao excluir')
    } finally {
      setDelLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Data e hora */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Clock size={15} className="text-blue-500" />
        <span>
          {format(parseISO(meeting.startAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
          {' — '}
          {format(parseISO(meeting.endAt), 'HH:mm')}
        </span>
      </div>

      {/* Local */}
      {meeting.location && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin size={15} className="text-rose-400" />
          <span>{meeting.location}</span>
        </div>
      )}

      {/* Descrição */}
      {meeting.description && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
          {meeting.description}
        </p>
      )}

      {/* Participantes */}
      {meeting.attendees?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-violet-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {meeting.attendees.length} participante(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.map((a) => (
              <div key={a.userId} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">{a.user.name.charAt(0)}</span>
                </div>
                <span className="text-xs text-slate-700 font-medium">{a.user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Criado por */}
      <p className="text-xs text-slate-400">
        Criado por <span className="font-medium">{meeting.createdBy?.name}</span>
      </p>

      {/* Ações */}
      {canEdit && (
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Fechar</button>
          <button onClick={onEdit} className="btn-secondary gap-1.5 px-4">
            <Pencil size={14} /> Editar
          </button>
          <button onClick={handleDelete} disabled={delLoading} className="btn-danger gap-1.5 px-4">
            {delLoading ? <Spinner size="sm" /> : <><Trash2 size={14} /> Excluir</>}
          </button>
        </div>
      )}
      {!canEdit && (
        <button onClick={onClose} className="btn-secondary w-full">Fechar</button>
      )}
    </div>
  )
}

// ─── Página do calendário ─────────────────────────────────────────────────────

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user)
  const canWrite = Boolean(user)
  const calendarRef = useRef(null)

  const [events, setEvents] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modais
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [prefilledDate, setPrefilledDate] = useState(null)

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await meetingsApi.list({ limit: 100 })
      const evts = data.data.map((m) => ({
        id: m.id,
        title: m.title,
        start: m.startAt,
        end: m.endAt,
        extendedProps: m,
        backgroundColor: '#2563eb',
        borderColor: 'transparent',
      }))
      setEvents(evts)
    } catch (err) {
      setError(err)
      toast.error('Erro ao carregar reuniões')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeetings()
    if (user?.role === 'ADMIN') {
      usersApi.list().then((r) => setUsers(r.data.data)).catch(() => {})
    }
  }, [loadMeetings, user])

  // Clique em data vazia → abre formulário
  function handleDateClick(info) {
    if (!canWrite) return
    setPrefilledDate(info.dateStr)
    setSelectedMeeting(null)
    setEditMode(false)
    setFormOpen(true)
  }

  // Clique em evento → abre detalhe
  function handleEventClick(info) {
    setSelectedMeeting(info.event.extendedProps)
    setDetailOpen(true)
    setEditMode(false)
  }

  function handleSaved() {
    setFormOpen(false)
    setDetailOpen(false)
    setSelectedMeeting(null)
    setEditMode(false)
    loadMeetings()
  }

  function handleEdit() {
    setDetailOpen(false)
    setEditMode(true)
    setFormOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Calendário de Reuniões</h2>
          <p className="text-sm text-slate-500">
            {canWrite ? 'Clique em uma data para criar · clique no evento para ver detalhes' : 'Visualização de reuniões'}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => { setSelectedMeeting(null); setEditMode(false); setFormOpen(true) }}
            className="btn-primary">
            <Plus size={16} /> Nova reunião
          </button>
        )}
      </div>

      {/* Erro */}
      {error && !loading && (
        <PageError error={error} onRetry={loadMeetings} />
      )}

      {/* Calendário */}
      {!error && (
      <div className="card p-5 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10">
            <Spinner size="lg" className="text-blue-500" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="pt-br"
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana' }}
          height="auto"
          dayMaxEvents={3}
          eventDisplay="block"
          nowIndicator
          selectable={canWrite}
          select={(info) => {
            if (!canWrite) return
            setPrefilledDate(info.startStr)
            setSelectedMeeting(null)
            setFormOpen(true)
          }}
        />
      </div>
      )}

      {/* Modal formulário */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditMode(false) }}
        title={editMode && selectedMeeting ? 'Editar reunião' : 'Nova reunião'}
        size="lg"
      >
        <MeetingForm
          meeting={editMode ? selectedMeeting : null}
          users={users}
          prefilledDate={!editMode ? prefilledDate : null}
          onClose={() => { setFormOpen(false); setEditMode(false) }}
          onSave={handleSaved}
        />
      </Modal>

      {/* Modal detalhe */}
      <Modal
        open={detailOpen && !!selectedMeeting}
        onClose={() => { setDetailOpen(false); setSelectedMeeting(null) }}
        title={selectedMeeting?.title || 'Reunião'}
      >
        {selectedMeeting && (
          <MeetingDetail
            meeting={selectedMeeting}
            onClose={() => { setDetailOpen(false); setSelectedMeeting(null) }}
            onEdit={handleEdit}
            onDelete={handleSaved}
          />
        )}
      </Modal>
    </div>
  )
}
