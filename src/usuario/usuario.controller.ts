import { Body, Controller, Get, Post, Param } from "@nestjs/common";
import { UsuarioRepository } from "./usuario.repository";
import { PresosService } from "./presos.service";

@Controller('/usuarios')
export class UsuarioController {

    private usuarioRepository = new UsuarioRepository();
    
    constructor(private presosService: PresosService) {}

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

    /*@delete()
    async deletarUsuario(@Body() dadosUsuario){
        this.usuarioRepository.deletar(dadosUsuario)
        return dadosUsuario;
    }*/
}