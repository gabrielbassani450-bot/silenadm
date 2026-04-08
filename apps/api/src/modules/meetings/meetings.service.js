'use strict';

// BUG CORRIGIDO: attendeeIds não eram validados contra o banco — IDs inexistentes
// causavam erro P2003 (FK violation) em vez de mensagem amigável
// BUG CORRIGIDO: endDate filter usava `T23:59:59Z` que pode falhar com datas inválidas
// BUG CORRIGIDO: createMeeting não verificava se attendeeIds são de usuários ativos

const prisma = require('../../lib/prisma');
const { NotFoundError, AuthorizationError, ValidationError } = require('../../utils/errors');
const logger = require('../../lib/logger');

const meetingInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  attendees: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
};

/**
 * Valida que todos os IDs em attendeeIds existem e são de usuários ativos.
 * Lança ValidationError com lista de IDs inválidos se houver problemas.
 */
async function validateAttendeeIds(attendeeIds, tx = prisma) {
  if (!attendeeIds || attendeeIds.length === 0) return;

  const foundUsers = await tx.user.findMany({
    where: { id: { in: attendeeIds }, isActive: true },
    select: { id: true },
  });

  const foundIds = new Set(foundUsers.map((u) => u.id));
  const invalidIds = attendeeIds.filter((id) => !foundIds.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError('Participantes inválidos ou inativos', [
      {
        field: 'attendeeIds',
        message: `IDs não encontrados: ${invalidIds.join(', ')}`,
      },
    ]);
  }
}

async function listMeetings(userId, userRole, query) {
  const { page, limit, startDate, endDate } = query;
  const skip = (page - 1) * limit;

  // BUG CORRIGIDO: endDate com `T23:59:59Z` pode ter problemas de timezone;
  // usar início do dia seguinte é mais seguro
  const dateFilter =
    startDate || endDate
      ? {
          startAt: {
            ...(startDate && { gte: new Date(startDate + 'T00:00:00Z') }),
            ...(endDate && {
              lt: new Date(new Date(endDate + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000),
            }),
          },
        }
      : {};

  // VIEWERs veem apenas reuniões das quais participam ou criaram
  const accessFilter =
    userRole === 'VIEWER'
      ? {
          OR: [
            { createdById: userId },
            { attendees: { some: { userId } } },
          ],
        }
      : {};

  const where = { ...dateFilter, ...accessFilter };

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startAt: 'asc' },
      include: meetingInclude,
    }),
    prisma.meeting.count({ where }),
  ]);

  return { meetings, total };
}

async function getMeetingById(id, userId, userRole) {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: meetingInclude,
  });

  if (!meeting) throw new NotFoundError('Reunião');

  // VIEWER não pode ver reuniões que não lhe dizem respeito
  if (userRole === 'VIEWER') {
    const isAttendee = meeting.attendees.some((a) => a.userId === userId);
    const isCreator = meeting.createdById === userId;
    if (!isAttendee && !isCreator) throw new NotFoundError('Reunião');
  }

  return meeting;
}

async function createMeeting(data, userId) {
  const { attendeeIds, ...meetingData } = data;

  // BUG CORRIGIDO: valida attendeeIds antes de tentar criar (evita P2003)
  await validateAttendeeIds(attendeeIds);

  const meeting = await prisma.meeting.create({
    data: {
      ...meetingData,
      startAt: new Date(meetingData.startAt),
      endAt: new Date(meetingData.endAt),
      createdById: userId,
      attendees: {
        create: attendeeIds.map((uid) => ({ userId: uid })),
      },
    },
    include: meetingInclude,
  });

  logger.info(
    { meetingId: meeting.id, userId, attendees: attendeeIds?.length || 0 },
    'meetings.create: reunião criada'
  );
  return meeting;
}

async function updateMeeting(id, data, userId, userRole) {
  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Reunião');

  // Somente criador ou ADMIN/MANAGER podem editar
  if (userRole === 'VIEWER' && existing.createdById !== userId) {
    throw new AuthorizationError('Somente o criador pode editar esta reunião');
  }

  const { attendeeIds, ...meetingData } = data;

  // Atualiza reunião em transação para garantir consistência dos attendees
  const updated = await prisma.$transaction(async (tx) => {
    if (attendeeIds !== undefined) {
      // BUG CORRIGIDO: valida attendeeIds dentro da transação
      await validateAttendeeIds(attendeeIds, tx);

      // Remove todos e recria (replace completo)
      await tx.meetingAttendee.deleteMany({ where: { meetingId: id } });

      if (attendeeIds.length > 0) {
        await tx.meetingAttendee.createMany({
          data: attendeeIds.map((uid) => ({ meetingId: id, userId: uid })),
        });
      }
    }

    return tx.meeting.update({
      where: { id },
      data: {
        ...meetingData,
        ...(meetingData.startAt && { startAt: new Date(meetingData.startAt) }),
        ...(meetingData.endAt && { endAt: new Date(meetingData.endAt) }),
      },
      include: meetingInclude,
    });
  });

  logger.info({ meetingId: id, userId }, 'meetings.update: reunião atualizada');
  return updated;
}

async function deleteMeeting(id, userId, userRole) {
  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Reunião');

  if (userRole === 'VIEWER' && existing.createdById !== userId) {
    throw new AuthorizationError('Somente o criador pode excluir esta reunião');
  }

  await prisma.meeting.delete({ where: { id } });
  logger.info({ meetingId: id, userId }, 'meetings.delete: reunião removida');
}

// Retorna reuniões futuras (usado pelo widget do dashboard)
async function getUpcomingMeetings(userId, userRole, limit = 5) {
  const accessFilter =
    userRole === 'VIEWER'
      ? {
          OR: [
            { createdById: userId },
            { attendees: { some: { userId } } },
          ],
        }
      : {};

  return prisma.meeting.findMany({
    where: {
      ...accessFilter,
      startAt: { gte: new Date() },
    },
    take: limit,
    orderBy: { startAt: 'asc' },
    include: meetingInclude,
  });
}

module.exports = {
  listMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getUpcomingMeetings,
};
