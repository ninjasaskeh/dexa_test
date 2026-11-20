import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser, Role } from '@app/common';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Endpoint tanpa login */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Batasi endpoint ke role tertentu */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Ambil user yang sedang login */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
