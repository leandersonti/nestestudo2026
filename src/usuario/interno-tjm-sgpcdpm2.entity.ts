import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'interno_bi_tjm_view',
  schema: 'sgp',
  synchronize: false,
  database: 'sgp',
})
export class InternoTjmViewSgpcdpm2 {
  @ViewColumn()
  id: number;

  @ViewColumn()
  nome: string;

  @ViewColumn()
  descricao: string;

  @ViewColumn()
  data_criacao: Date;

  @ViewColumn()
  status: string;
}
