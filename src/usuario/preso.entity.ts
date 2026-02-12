import { Entity, Column, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  schema: 'public',
  name: 'view_presos_pg',
  synchronize: false,
})
export class Preso {
  @ViewColumn()
  identificacao_acusado: string;

  @ViewColumn()
  cpf: string;

  @ViewColumn()
  rg: string;

  @ViewColumn()
  processo: string;

  @ViewColumn()
  vara: string;

  @ViewColumn()
  cod_classe: Number;

  @ViewColumn()
  classe: string;

  @ViewColumn()
  situacao_processual: string;

  @ViewColumn()
  quantidade_de_reus: Number;

}
