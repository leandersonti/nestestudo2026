export class UsuarioRepository{
    private usuarios: any[] = [];

    async salvar(usuario){
        this.usuarios.push(usuario);
        console.log(this.usuarios)
    }
}