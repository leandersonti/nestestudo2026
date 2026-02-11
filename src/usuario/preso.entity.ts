import { Entity, Column, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  schema: 'public',
  name: 'view_presos_pg',
  synchronize: false,
})
export class Preso {
  @ViewColumn()
  identificacao_acusado: string;

  /*@ViewColumn()
  nome: string;

  @ViewColumn()
  cpf: string;

  @ViewColumn()
  status: string;

  @ViewColumn()
  data_inclusao: Date;*/
}
