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


}
