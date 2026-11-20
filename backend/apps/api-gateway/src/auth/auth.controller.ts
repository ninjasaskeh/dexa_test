import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Inject, Ip, Patch, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_SERVICE, AuthUser, ChangePasswordDto, EMPLOYEE_SERVICE, LoginDto, PATTERNS, ZodValidationPipe,
  changePasswordSchema, loginSchema, sendRpc,
} from '@app/common';
import { CurrentUser, Public } from './auth.decorators';
import { LoginLimiter } from './login-limiter';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
    private readonly limiter: LoginLimiter,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Ip() ip: string, @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    await this.limiter.assertAllowed(ip, dto.email);
    let result: { accessToken: string; user: AuthUser };
    try {
      result = await sendRpc(this.auth, PATTERNS.AUTH.LOGIN, dto);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === HttpStatus.UNAUTHORIZED) await this.limiter.recordFailure(ip, dto.email);
      throw e;
    }
    await this.limiter.reset(dto.email);
    const employee = await sendRpc(this.employees, PATTERNS.EMPLOYEE.FIND_BY_USER, { userId: result.user.id }).catch(() => null);
    return { ...result, user: { ...result.user, employee } };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const employee = await sendRpc(this.employees, PATTERNS.EMPLOYEE.FIND_BY_USER, { userId: user.id }).catch(() => null);
    return { ...user, employee };
  }

  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto) {
    return sendRpc(this.auth, PATTERNS.AUTH.CHANGE_PASSWORD, { userId: user.id, ...dto });
  }
}
