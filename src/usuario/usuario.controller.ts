import { Body, Controller, Get, Post, Param, Query } from "@nestjs/common";
import { UsuarioRepository } from "./usuario.repository";
import { PresosService } from "./presos.service";
import { InternoTjmService } from "./interno-tjm.service";
import { InternoTjmIpatService } from "./interno-tjm-ipat.service";
import { InternoTjmUppService } from "./interno-tjm-upp.service";
import { InternoTjmSgpcdpm2Service } from "./interno-tjm-sgpcdpm2.service";
import { InternoTjmMergeService } from './interno-tjm-merge.service';
import { SiapService } from './siap.service';

@Controller('/usuarios')
export class UsuarioController {

    private usuarioRepository = new UsuarioRepository();
    
    constructor(
        private presosService: PresosService,
        private internoTjmService: InternoTjmService,
        private internoTjmIpatService: InternoTjmIpatService,
        private internoTjmUppService: InternoTjmUppService,
        private internoTjmSgpcdpm2Service: InternoTjmSgpcdpm2Service,
            private internoTjmMergeService: InternoTjmMergeService,
            private siapService: SiapService,
    ) {}

    @Post()
    async criaUsuario(@Body() dadosUsuario){
        this.usuarioRepository.salvar(dadosUsuario)
        return dadosUsuario;
    }

    @Get()
    async listaUsuarios(){
        return this.usuarioRepository.listar();
    }

    @Get('presos')
    async listaPresos() {
        return this.presosService.findAll();
    }

    /* @Get('presos/:id')
    async obterPreso(@Param('id') id: number) {
        return this.presosService.findById(id);
    } */

    @Get('interno-tjm')
    async listaInternoTjm() {
        return this.internoTjmService.findAll();
    }

    /* @Get('interno-tjm/:id')
    async obterInternoTjm(@Param('id') id: number) {
        return this.internoTjmService.findById(id);
    } */

    @Get('interno-tjm-ipat')
    async listaInternoTjmIpat() {
        return this.internoTjmIpatService.findAll();
    }

    /* @Get('interno-tjm-ipat/:id')
    async obterInternoTjmIpat(@Param('id') id: number) {
        return this.internoTjmIpatService.findById(id);
    } */

    @Get('interno-tjm-upp')
    async listaInternoTjmUpp() {
        return this.internoTjmUppService.findAll();
    }

    /* @Get('interno-tjm-upp/:id')
    async obterInternoTjmUpp(@Param('id') id: number) {
        return this.internoTjmUppService.findById(id);
    } */

    @Get('interno-tjm-sgpcdpm2')
    async listaInternoTjmSgpcdpm2() {
        return this.internoTjmSgpcdpm2Service.findAll();
    }

    /* @Get('interno-tjm-sgpcdpm2/:id')
    async obterInternoTjmSgpcdpm2(@Param('id') id: number) {
        return this.internoTjmSgpcdpm2Service.findById(id);
    } */

    /*@delete()
    async deletarUsuario(@Body() dadosUsuario){
        this.usuarioRepository.deletar(dadosUsuario)
        return dadosUsuario;
    }*/

    @Get('interno-tjm/merged')
    async listaInternoTjmMerged() {
        return this.internoTjmMergeService.findCommonByCpf();
    }

    @Get('siap/unidades')
    async getSiapUnidades() {
        return this.siapService.getUnidades();
    }

    @Get('siap/siglas')
    async getSiapSiglas() {
        return this.siapService.listSiglasUnidades();
    }

    @Get('siap/listagem')
    async getSiapListagem(@Query('nomeInterno') nomeInterno?: string) {
        if (typeof nomeInterno === 'undefined' || nomeInterno === null || nomeInterno === '') {
            return this.siapService.listagemAllUnidadesAllInternos();
        }
        const nome = nomeInterno || 'A';
        return this.siapService.listagemForAllUnidades(nome);
    }

    @Get('listagem')
    async getListagemAll(@Query('nomeInterno') nomeInterno?: string) {
        const nome = nomeInterno || 'A';
        return this.siapService.listagemForAllUnidades(nome);
    }

    // keep existing POST for compatibility
    @Post('siap/listagem')
    async postSiapListagem(@Body() filtro: any) {
        return this.siapService.listagemFichaInternos(filtro || {});
    }
}