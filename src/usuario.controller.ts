import { Body, Controller, Get, Post } from "@nestjs/common";

@Controller('/usuarios')
export class UsuarioController {
    @Post()
    async criaUsuario(@Body() dadosUsuario){
        return dadosUsuario;
    }

    @Get()
    async respostaUsuario(){
        return "ta lendo"
    }
}