import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsuarioController } from './usuario.controller';
import { PresosService } from "./presos.service";
import { Preso } from "./preso.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Preso])],
    controllers: [UsuarioController],
    providers: [PresosService]
})
export class usuarioModule {

}