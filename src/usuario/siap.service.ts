import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SiapService {
  private baseUrl: string;
  private apiToken: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('SIAP_BASE_URL') || 'https://siap-am.com/SIAP5/APISIAP_GMF.rule?sys=WWW';
    this.apiToken = this.configService.get<string>('SIAP_API_TOKEN') || '';
  }

  async callRecurso(recurso: string, body: Record<string, any> = {}) {
    const payload = { apiToken: this.apiToken, recurso, ...body };
    const resp = await axios.post(this.baseUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });
    return resp.data;
  }

  async getUnidades() {
    return this.callRecurso('UNIDADES');
  }

  async listagemFichaInternos(filters: Record<string, any> = {}) {
    return this.callRecurso('LISTAGEM_FICHA_INTERNOS', filters);
  }

  async listagemForAllUnidades(nomeInterno = 'A') {
    const unidadesResp: any = await this.getUnidades();
    let unidadesRaw = (unidadesResp && (unidadesResp.resultado ?? unidadesResp)) || [];

    // Normalize to an array in case API returns an object or a keyed map
    let unidades: any[] = [];
    if (Array.isArray(unidadesRaw)) {
      unidades = unidadesRaw;
    } else if (unidadesRaw && typeof unidadesRaw === 'object') {
      if (Array.isArray(unidadesRaw.UNIDADES)) {
        unidades = unidadesRaw.UNIDADES;
      } else if (Array.isArray(unidadesRaw.unidades)) {
        unidades = unidadesRaw.unidades;
      } else if (unidadesRaw.siglaUnidade || unidadesRaw.SIGLA_UNIDADE || unidadesRaw.SiglaUnidade || unidadesRaw.sigla) {
        unidades = [unidadesRaw];
      } else {
        // try to find the first array value whose items look like unidades
        const arr = Object.values(unidadesRaw).find((v: any) => Array.isArray(v) && v.length && typeof v[0] === 'object');
        if (Array.isArray(arr)) {
          unidades = arr;
        } else {
          unidades = [];
        }
      }
    } else {
      unidades = [];
    }

    // Extract siglaUnidade values. Try a few common shapes and casings.
    const siglas = unidades
      .map((u: any) =>
        u.siglaUnidade || u.SIGLA_UNIDADE || u.SiglaUnidade || u.sigla || u.sigla_unidade || u.SIGLAUNIDADE || u.SIGLA
      )
      .filter(Boolean);

    const errors: any[] = [];
    const promises = siglas.map(async (sigla: string) => {
      const paramKeys = ['siglaUnidade', 'SIGLA_UNIDADE', 'SiglaUnidade', 'sigla', 'SIGLA'];
      for (const key of paramKeys) {
        try {
          const payload: any = { nomeInterno };
          payload[key] = sigla;
          const r: any = await this.listagemFichaInternos(payload);
          const data = (r && r.resultado) || r || [];
          if (Array.isArray(data) && data.length > 0) {
            return { sigla, data };
          }
        } catch (e: any) {
          errors.push({ sigla, key, error: e.message || e });
          // try next key
        }
      }
      // none succeeded or returned data
      return { sigla, data: [] };
    });

    const results = await Promise.all(promises);
    // Flatten data and attach source sigla
    const aggregated = results.reduce((acc: any[], item: any) => {
      if (item.data && Array.isArray(item.data)) {
        const mapped = item.data.map((d: any) => ({ _siglaUnidade: item.sigla, ...d }));
        return acc.concat(mapped);
      }
      return acc;
    }, []);

    return { count: aggregated.length, items: aggregated, attempted: siglas.length, errors };
  }

  async listagemAllUnidadesAllInternos() {
    const unidadesResp: any = await this.getUnidades();
    let unidadesRaw = (unidadesResp && (unidadesResp.resultado ?? unidadesResp)) || [];

    let unidades: any[] = [];
    if (Array.isArray(unidadesRaw)) {
      unidades = unidadesRaw;
    } else if (unidadesRaw && typeof unidadesRaw === 'object') {
      if (Array.isArray(unidadesRaw.UNIDADES)) {
        unidades = unidadesRaw.UNIDADES;
      } else if (Array.isArray(unidadesRaw.unidades)) {
        unidades = unidadesRaw.unidades;
      } else {
        const arr = Object.values(unidadesRaw).find((v: any) => Array.isArray(v) && v.length && typeof v[0] === 'object');
        if (Array.isArray(arr)) unidades = arr;
      }
    }

    const siglas = unidades
      .map((u: any) => u.siglaUnidade || u.SIGLA_UNIDADE || u.SiglaUnidade || u.sigla || u.sigla_unidade || u.SIGLAUNIDADE || u.SIGLA)
      .filter(Boolean);

    const errors: any[] = [];
    const promises = siglas.map(async (sigla: string) => {
      const paramKeys = ['siglaUnidade', 'SIGLA_UNIDADE', 'SiglaUnidade', 'sigla', 'SIGLA'];
      for (const key of paramKeys) {
        try {
          const payload: any = {};
          payload[key] = sigla;
          const r: any = await this.listagemFichaInternos(payload);
          const data = (r && r.resultado) || r || [];
          if (Array.isArray(data) && data.length > 0) {
            return { sigla, data };
          }
        } catch (e: any) {
          errors.push({ sigla, key, error: e.message || e });
        }
      }
      return { sigla, data: [] };
    });

    const results = await Promise.all(promises);
    const aggregated = results.reduce((acc: any[], item: any) => {
      if (item.data && Array.isArray(item.data)) {
        const mapped = item.data.map((d: any) => ({ _siglaUnidade: item.sigla, ...d }));
        return acc.concat(mapped);
      }
      return acc;
    }, []);

    return { count: aggregated.length, items: aggregated, attempted: siglas.length, errors };
  }

  async listSiglasUnidades(): Promise<string[]> {
    const unidadesResp: any = await this.getUnidades();
    let unidadesRaw = (unidadesResp && (unidadesResp.resultado ?? unidadesResp)) || [];

    // Normalize similar to listagemForAllUnidades
    let unidades: any[] = [];
    if (Array.isArray(unidadesRaw)) {
      unidades = unidadesRaw;
    } else if (unidadesRaw && typeof unidadesRaw === 'object') {
      if (Array.isArray(unidadesRaw.UNIDADES)) {
        unidades = unidadesRaw.UNIDADES;
      } else if (Array.isArray(unidadesRaw.unidades)) {
        unidades = unidadesRaw.unidades;
      } else if (unidadesRaw.siglaUnidade || unidadesRaw.SIGLA_UNIDADE || unidadesRaw.SiglaUnidade || unidadesRaw.sigla) {
        unidades = [unidadesRaw];
      } else {
        const arr = Object.values(unidadesRaw).find((v: any) => Array.isArray(v) && v.length && typeof v[0] === 'object');
        if (Array.isArray(arr)) unidades = arr;
      }
    }

    const siglas = unidades
      .map((u: any) =>
        u.siglaUnidade || u.SIGLA_UNIDADE || u.SiglaUnidade || u.Sigla || u.sigla || u.sigla_unidade || u.SIGLA
      )
      .filter(Boolean);

    // unique
    return Array.from(new Set(siglas));
  }
}
