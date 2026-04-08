'use strict';

const { AuthorizationError } = require('../utils/errors');

// Hierarquia de roles: ADMIN > MANAGER > VIEWER
const ROLE_HIERARCHY = { ADMIN: 3, MANAGER: 2, VIEWER: 1 };

/**
 * Middleware de autorização baseado em role.
 * Uso: authorize('MANAGER') — requer MANAGER ou superior
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError());
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const hasAccess = allowedRoles.some(
      (role) => userLevel >= (ROLE_HIERARCHY[role] ?? 0)
    );

    if (!hasAccess) {
      return next(
        new AuthorizationError(
          `Esta ação requer role: ${allowedRoles.join(' ou ')}`
        )
      );
    }

    next();
  };
}

module.exports = { authorize };
