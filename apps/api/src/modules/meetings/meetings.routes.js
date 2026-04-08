'use strict';

const { Router } = require('express');
const service = require('./meetings.service');
const {
  createMeetingSchema,
  updateMeetingSchema,
  listMeetingsSchema,
  idParamSchema,
} = require('./meetings.schema');
const { authenticate } = require('../../middleware/authenticate');
const { validate } = require('../../middleware/validate');
const { success, created, noContent, paginated } = require('../../utils/response');

const router = Router();

router.use(authenticate);

// GET /api/meetings/upcoming
const { z } = require('zod');
const upcomingSchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(20).default(5),
  }),
};
router.get('/upcoming', validate(upcomingSchema), async (req, res, next) => {
  try {
    const limit = req.query.limit;
    const data = await service.getUpcomingMeetings(req.user.id, req.user.role, limit);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings
router.get('/', validate(listMeetingsSchema), async (req, res, next) => {
  try {
    const { meetings, total } = await service.listMeetings(
      req.user.id,
      req.user.role,
      req.query
    );
    paginated(res, meetings, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/:id
router.get('/:id', validate(idParamSchema), async (req, res, next) => {
  try {
    const data = await service.getMeetingById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings
router.post(
  '/',
  validate(createMeetingSchema),
  async (req, res, next) => {
    try {
      const data = await service.createMeeting(req.body, req.user.id);
      created(res, data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/meetings/:id
router.patch(
  '/:id',
  validate(updateMeetingSchema),
  async (req, res, next) => {
    try {
      const data = await service.updateMeeting(
        req.params.id,
        req.body,
        req.user.id,
        req.user.role
      );
      success(res, data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/meetings/:id
router.delete(
  '/:id',
  validate(idParamSchema),
  async (req, res, next) => {
    try {
      await service.deleteMeeting(req.params.id, req.user.id, req.user.role);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
