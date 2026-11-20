import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/** Koneksi TypeORM ke MySQL. Tiap service hanya mendaftarkan entity miliknya. */
@Module({})
export class DatabaseModule {
  static forRoot(entities: Function[]): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'mysql',
            host: config.get('DB_HOST', 'localhost'),
            port: Number(config.get('DB_PORT', 3306)),
            username: config.get('DB_USER', 'root'),
            password: config.get('DB_PASSWORD', ''),
            database: config.get('DB_NAME', 'dexa_wfh'),
            entities,
            synchronize: false, // skema dikelola lewat database/schema.sql
            timezone: 'local',
            dateStrings: ['DATE'],
          }),
        }),
      ],
    };
  }
}

export const AppConfigModule = ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] });
