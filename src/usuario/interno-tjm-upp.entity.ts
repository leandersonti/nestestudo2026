import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'interno_bi_tjm_view',
  schema: 'sgp',
  synchronize: false,
  database: 'sgp',
})
export class InternoTjmViewUpp {


  @ViewColumn()
  nome: string;

  @ViewColumn()
  unidade: string;

  @ViewColumn()
  sexo: string;

  @ViewColumn()
  nacionalidade: string;

  @ViewColumn()
  mae: string;

  @ViewColumn()
  pai: string;

  @ViewColumn()
  rg: string;

  @ViewColumn()
  cpf: string;

  @ViewColumn()
  data_nascimento: string;

  @ViewColumn()
  naturalidade: string;

  @ViewColumn()
  orientacao: string;

  @ViewColumn()
  inicio_ciclo_mais_recente: string;

  @ViewColumn()
  data_detencao: string;

  @ViewColumn()
  local_detencao: string;

  @ViewColumn()
  forma_entrada: string;

  @ViewColumn()
  regime: string;


}
