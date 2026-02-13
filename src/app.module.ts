import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usuarioModule } from './usuario/usuario.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      name: 'postgres',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'mysql',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('MYSQL_HOST'),
        port: configService.get<number>('MYSQL_PORT'),
        username: configService.get<string>('MYSQL_USERNAME'),
        password: configService.get<string>('MYSQL_PASSWORD'),
        database: configService.get<string>('MYSQL_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'mysql-ipat',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('MYSQL_IPAT_HOST'),
        port: configService.get<number>('MYSQL_IPAT_PORT'),
        username: configService.get<string>('MYSQL_IPAT_USERNAME'),
        password: configService.get<string>('MYSQL_IPAT_PASSWORD'),
        database: configService.get<string>('MYSQL_IPAT_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'mysql-upp',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('MYSQL_UPP_HOST'),
        port: configService.get<number>('MYSQL_UPP_PORT'),
        username: configService.get<string>('MYSQL_UPP_USERNAME'),
        password: configService.get<string>('MYSQL_UPP_PASSWORD'),
        database: configService.get<string>('MYSQL_UPP_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'mysql-sgpcdpm2',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('MYSQL_SGPCDPM2_HOST'),
        port: configService.get<number>('MYSQL_SGPCDPM2_PORT'),
        username: configService.get<string>('MYSQL_SGPCDPM2_USERNAME'),
        password: configService.get<string>('MYSQL_SGPCDPM2_PASSWORD'),
        database: configService.get<string>('MYSQL_SGPCDPM2_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    usuarioModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
