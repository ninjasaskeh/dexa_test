import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LoginDto, PATTERNS, Role } from '@app/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(PATTERNS.AUTH.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @MessagePattern(PATTERNS.AUTH.VERIFY)
  verify(@Payload() data: { token: string }) {
    return this.auth.verify(data.token);
  }

  @MessagePattern(PATTERNS.AUTH.CREATE_USER)
  createUser(@Payload() data: { email: string; password: string; role: Role }) {
    return this.auth.createUser(data);
  }

  @MessagePattern(PATTERNS.AUTH.UPDATE_USER)
  updateUser(@Payload() data: { id: number; email?: string; password?: string; role?: Role; isActive?: boolean }) {
    return this.auth.updateUser(data);
  }

  @MessagePattern(PATTERNS.AUTH.DELETE_USER)
  deleteUser(@Payload() data: { id: number }) {
    return this.auth.deleteUser(data.id);
  }

  @MessagePattern(PATTERNS.AUTH.CHANGE_PASSWORD)
  changePassword(@Payload() data: { userId: number; currentPassword: string; newPassword: string }) {
    return this.auth.changePassword(data);
  }

  @MessagePattern(PATTERNS.AUTH.FIND_USERS)
  findUsers(@Payload() data: { ids: number[] }) {
    return this.auth.findUsers(data.ids ?? []);
  }
}
