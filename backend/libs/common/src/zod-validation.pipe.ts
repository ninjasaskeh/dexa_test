import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/** Validasi body/query/param dengan schema Zod. Error dikembalikan per field. */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        errors[key] ??= issue.message;
      }
      throw new BadRequestException({ statusCode: 400, message: 'Validasi gagal', errors });
    }
    return result.data;
  }
}
