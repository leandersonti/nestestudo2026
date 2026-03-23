# Instru??es r?pidas para agentes de c?digo (Copilot)

Objetivo: permitir que um agente de IA seja produtivo rapidamente neste reposit?rio NestJS multi-banco.

**Vis?o Geral**:
- Arquitetura: aplica??o NestJS modular. M?dulo principal em `src/app.module.ts` carrega m?ltiplas conex?es TypeORM nomeadas (postgres, mysql, mysql-ipat, mysql-upp, mysql-sgpcdpm2).
- Padr?o principal: cada m?dulo registra entidades com `TypeOrmModule.forFeature([...], '<connectionName>')` e servi?os usam `@InjectRepository(Entity, '<connectionName>')`.

**Pontos cr?ticos do projeto**:
- Conex?es m?ltiplas: veja `src/app.module.ts` ? altera??es de entidades/DB devem respeitar o `name` da conex?o.
- Entidades de leitura: v?rias classes usam `@ViewEntity` (ex.: arquivos em `src/usuario/`), indicando views/consultas somente leitura.
- Reposit?rio local: `src/usuario/usuario.repository.ts` ? um reposit?rio em mem?ria instanciado diretamente em `UsuarioController` (n?o ? injetado pelo Nest).

**Comandos ?teis (do `package.json`)**
- `npm run start:dev` ? inicia em modo watch
- `npm run build` ? compila para `dist/`
- `npm run test` / `npm run test:e2e` ? executa testes unit?rios / e2e (Jest). E2E usa `test/jest-e2e.json`.

**Vari?veis de ambiente**
- A configura??o usa `@nestjs/config` e carrega `.env`. Vari?veis que aparecem em `src/app.module.ts`:
  - Postgres: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
  - MySQL(s): `MYSQL_*`, `MYSQL_IPAT_*`, `MYSQL_UPP_*`, `MYSQL_SGPCDPM2_*`

**Como estender/alterar um m?dulo de dados**
1. Adicione/edite a entidade (ou ViewEntity) em `src/usuario/`.
2. No m?dulo (ex.: `usuario.module.ts`) chame `TypeOrmModule.forFeature([MyEntity], '<connectionName>')` com o mesmo nome usado em `app.module.ts`.
3. Injetar o reposit?rio no servi?o com `@InjectRepository(MyEntity, '<connectionName>')`.

**Padr?es e armadilhas a observar**
- N?o supor uma ?nica conex?o: sempre confirmar o `connectionName` em `app.module.ts` antes de modificar consultas ou migrations.
- `@ViewEntity` indica que a entidade mapeia uma view no banco ? n?o altere `synchronize` ou tente gerar migrations a partir dessas entidades.
- O `UsuarioRepository` ? local e em mem?ria; mudan?as nele n?o persistir?o no banco. Para persist?ncia, use um `Repository` TypeORM injetado.

**Arquivos exemplares**
- [src/app.module.ts](src/app.module.ts)
- [src/usuario/usuario.module.ts](src/usuario/usuario.module.ts)
- [src/usuario/presos.service.ts](src/usuario/presos.service.ts)
- [src/usuario/interno-tjm.entity.ts](src/usuario/interno-tjm.entity.ts)
- [package.json](package.json)

Se algo estiver faltando ou se quiser que eu adicione exemplos de c?digo (ex.: adicionar entidade e service ligados a uma conex?o espec?fica), diga qual parte prefere que eu detalhe.
