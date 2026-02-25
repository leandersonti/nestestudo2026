import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsuarioController } from './usuario.controller';
import { PresosService } from "./presos.service";
import { Preso } from "./preso.entity";
import { InternoTjmService } from "./interno-tjm.service";
import { InternoTjmView } from "./interno-tjm.entity";
import { InternoTjmIpatService } from "./interno-tjm-ipat.service";
import { InternoTjmViewIpat } from "./interno-tjm-ipat.entity";
import { InternoTjmUppService } from "./interno-tjm-upp.service";
import { InternoTjmViewUpp } from "./interno-tjm-upp.entity";
import { InternoTjmSgpcdpm2Service } from "./interno-tjm-sgpcdpm2.service";
import { InternoTjmViewSgpcdpm2 } from "./interno-tjm-sgpcdpm2.entity";
import { InternoTjmMergeService } from "./interno-tjm-merge.service";
import { SiapService } from './siap.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Preso], 'postgres'),
        TypeOrmModule.forFeature([InternoTjmView], 'mysql'),
        TypeOrmModule.forFeature([InternoTjmViewIpat], 'mysql-ipat'),
        TypeOrmModule.forFeature([InternoTjmViewUpp], 'mysql-upp'),
        TypeOrmModule.forFeature([InternoTjmViewSgpcdpm2], 'mysql-sgpcdpm2'),
    ],
    controllers: [UsuarioController],
    providers: [PresosService, InternoTjmService, InternoTjmIpatService, InternoTjmUppService, InternoTjmSgpcdpm2Service, InternoTjmMergeService, SiapService]
})
export class usuarioModule {

}
