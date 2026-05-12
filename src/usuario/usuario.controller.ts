import { Body, Controller, Get, Post, Param, Query } from "@nestjs/common";
import { UsuarioRepository } from "./usuario.repository";
import { PresosService } from "./presos.service";
import { InternoTjmService } from "./interno-tjm.service";
import { InternoTjmIpatService } from "./interno-tjm-ipat.service";
import { InternoTjmUppService } from "./interno-tjm-upp.service";
import { InternoTjmSgpcdpm2Service } from "./interno-tjm-sgpcdpm2.service";
import { InternoTjmMergeService } from './interno-tjm-merge.service';
import { SiapService } from './siap.service';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { Preso } from './preso.entity';

/** Referência principal: preso (TJ); sheet = dados da planilha (null se só veio do TJ); siap = cruzamento SIAP. */
type AgregadoPresoItem = {
  preso: unknown;
  sheet: Record<string, any> | null;
  siap: unknown;
};

type PresoSiapItem = {
  preso: Preso;
  siap: unknown | null;
};

type PresoSheetItem = {
  preso: Preso | null;
  sheet: Record<string, any> | null;
  siap: unknown | null;
};

type PresoSheetSiapInternoMergedItem = PresoSheetItem & {
  interno_tjm_merged: unknown | null;
};

type PresoSiapInternoMergedItem = {
  preso: Preso;
  siap: unknown | null;
  interno_tjm_merged: unknown | null;
};

@Controller('/usuarios')
export class UsuarioController {

    private usuarioRepository = new UsuarioRepository();
    
    constructor(
        private presosService: PresosService,
        private internoTjmService: InternoTjmService,
        private internoTjmIpatService: InternoTjmIpatService,
        private internoTjmUppService: InternoTjmUppService,
        private internoTjmSgpcdpm2Service: InternoTjmSgpcdpm2Service,
        private internoTjmMergeService: InternoTjmMergeService,
        private siapService: SiapService,
        private googleSheetsService: GoogleSheetsService,
    ) {}

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

    /**
     * Cruzamento somente entre `/usuarios/presos` (TJ) e `siap`.
     * Retorna todos os presos; os com match no SIAP vêm primeiro.
     */
    @Get('presos/siap-agregado')
    async listaPresosComSiapAgregado(): Promise<PresoSiapItem[]> {
        const [presos, siapResponse] = await Promise.all([
            this.presosService.findAll(),
            this.siapService.listagemAllUnidadesAllInternos(),
        ]);

        const siapFiltered = this.filtrarSiapParaAgregado(siapResponse);

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const normalizeDigits = (value?: string | null) => {
            if (!value) return '';
            return value.toString().replace(/\D+/g, '');
        };

        const isEmptyOrNaoCadastrado = (value?: string | null) => {
            if (!value) return true;
            const v = value.toString().trim().toUpperCase();
            return v === '' || v.includes('NAO CADASTRADO');
        };

        const preparados = (Array.isArray(siapFiltered) ? siapFiltered : []).map(
            (siap: any) => {
                const nome = normalizeText(
                    siap.nomeInterno ||
                        siap.NOME_INTERNO ||
                        siap.nome ||
                        siap.NOME ||
                        siap.nome_preso ||
                        siap.NOME_PRESO,
                );
                const rg = normalizeDigits(
                    siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
                );
                const cpf = normalizeDigits(
                    siap.cpf ||
                        siap.CPF ||
                        siap.cpfInterno ||
                        siap.CPF_INTERNO,
                );
                const mae = normalizeText(
                    siap.nomeMae ||
                        siap.NOME_MAE ||
                        siap.nome_mae ||
                        siap.NOME_DA_MAE ||
                        siap.nomedamae,
                );

                return { siap, nome, rg, cpf, mae };
            },
        );

        // Index para reduzir custo de matching
        const byCpf = new Map<string, any>();
        const byRg = new Map<string, any>();
        const byNome = new Map<string, Array<{ siap: any; mae: string }>>();

        for (const p of preparados) {
            if (p.cpf && !byCpf.has(p.cpf)) byCpf.set(p.cpf, p.siap);
            if (p.rg && !byRg.has(p.rg)) byRg.set(p.rg, p.siap);
            if (p.nome) {
                const arr = byNome.get(p.nome) || [];
                arr.push({ siap: p.siap, mae: p.mae });
                byNome.set(p.nome, arr);
            }
        }

        const matchSiapForPreso = (preso: Preso): any | null => {
            const presoNome = normalizeText(preso.identificacao_acusado);
            const presoRg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const presoCpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const presoMae = normalizeText(preso.nomedamae);

            if (presoCpf && byCpf.has(presoCpf)) return byCpf.get(presoCpf) ?? null;
            if (presoRg && byRg.has(presoRg)) return byRg.get(presoRg) ?? null;

            // Match por nome exige também compatibilidade de filiação (mae)
            if (!presoMae) return null;
            const candidatos = byNome.get(presoNome) || [];
            for (const c of candidatos) {
                if (!c.mae) continue;
                if (presoMae.includes(c.mae) || c.mae.includes(presoMae)) {
                    return c.siap ?? null;
                }
            }

            return null;
        };

        const itens = presos.map((preso, ordemOriginal) => {
            const siap = matchSiapForPreso(preso);
            return { item: { preso, siap }, ordemOriginal };
        });

        return itens
            .sort((a, b) => {
                const da = a.item.siap ? 1 : 0;
                const db = b.item.siap ? 1 : 0;
                if (db !== da) return db - da;
                return a.ordemOriginal - b.ordemOriginal;
            })
            .map((x) => x.item);
    }

    /**
     * Cruzamento somente entre `/usuarios/presos` (TJ) e uma aba do Google Sheets.
     * Retorna todos os itens: primeiro sheet com match no TJ, depois sheet sem match e por fim presos do TJ
     * que não apareceram no sheet (sheet: null).
     */
    @Get('presos/sheet-agregado')
    async listaPresosComSheetAgregado(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ): Promise<PresoSheetItem[]> {
        const id =
            spreadsheetId || '1y6wcoYFR9yeGZse4Nwg2NPtgE3kSDy0aI9iBtqIkvXE';
        const skip = skipRows ? parseInt(skipRows, 10) : 2;

        const sheetRows = sheetName
            ? await this.googleSheetsService.getSheetData(id, sheetName, skip)
            : await this.googleSheetsService.getSheetDataByGid(
                  id,
                  gid ? parseInt(gid, 10) : 427685216,
                  skip,
              );

        const presos = await this.presosService.findAll();

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const normalizeDigits = (value?: string | null) => {
            if (!value) return '';
            return value.toString().replace(/\D+/g, '');
        };

        const isEmptyOrNaoCadastrado = (value?: string | null) => {
            if (!value) return true;
            const v = value.toString().trim().toUpperCase();
            return v === '' || v.includes('NAO CADASTRADO');
        };

        const presoChaveUnica = (preso: Preso) => {
            const n = normalizeText(preso.identificacao_acusado);
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const m = normalizeText(preso.nomedamae);
            return `${n}|${cpf}|${rg}|${m}`;
        };

        // Índices do TJ para match rápido
        const byCpf = new Map<string, Preso>();
        const byRg = new Map<string, Preso>();
        const byNome = new Map<string, Array<{ preso: Preso; mae: string }>>();

        for (const preso of presos) {
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const nome = normalizeText(preso.identificacao_acusado);
            const mae = normalizeText(preso.nomedamae);

            if (cpf && !byCpf.has(cpf)) byCpf.set(cpf, preso);
            if (rg && !byRg.has(rg)) byRg.set(rg, preso);

            if (nome) {
                const arr = byNome.get(nome) || [];
                arr.push({ preso, mae });
                byNome.set(nome, arr);
            }
        }

        const itensComMatch: PresoSheetItem[] = [];
        const itensSemMatch: PresoSheetItem[] = [];
        const matchedPresos = new Set<string>();

        for (const sheetRow of sheetRows) {
            const sheetNome = normalizeText(
                sheetRow['nome_do_a_preso_a_ou_adolescente_apreendido_a'],
            );
            const sheetRg = normalizeDigits(sheetRow['rg_somente_numeros']);
            const sheetCpf = normalizeDigits(sheetRow['cpf_somente_numeros']);
            const sheetFiliacao = normalizeText(sheetRow['filiacao']);

            let match: Preso | null = null;

            if (sheetCpf && byCpf.has(sheetCpf)) {
                match = byCpf.get(sheetCpf) ?? null;
            } else if (sheetRg && byRg.has(sheetRg)) {
                match = byRg.get(sheetRg) ?? null;
            } else if (sheetNome) {
                const candidatos = byNome.get(sheetNome) || [];
                for (const c of candidatos) {
                    if (!c.mae) continue;
                    if (sheetFiliacao && sheetFiliacao.includes(c.mae)) {
                        match = c.preso;
                        break;
                    }
                }
            }

            if (match) {
                matchedPresos.add(presoChaveUnica(match));
                itensComMatch.push({ preso: match, sheet: sheetRow, siap: null });
            } else {
                itensSemMatch.push({ preso: null, sheet: sheetRow, siap: null });
            }
        }

        const itensSoPreso: PresoSheetItem[] = [];
        for (const preso of presos) {
            const chave = presoChaveUnica(preso);
            if (matchedPresos.has(chave)) continue;
            itensSoPreso.push({ preso, sheet: null, siap: null });
        }

        return [...itensComMatch, ...itensSemMatch, ...itensSoPreso];
    }

    @Get('presos/agregado')
    async listaPresosAgregado(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ) {
        const { sheetRows, presos, siapFiltered } =
            await this.carregarDadosPresosAgregado(
                spreadsheetId,
                gid,
                sheetName,
                skipRows,
            );
        return this.montarListaAgregado(sheetRows, presos, siapFiltered);
    }

    /**
     * Inclui linhas da planilha + presos do TJ que não aparecem na sheet (sheet: null).
     * Ordem: (1) preso+SIAP; (2) só preso; (3) só SIAP; (4) sem match.
     * Dentro de cada grupo mantém ordem da planilha, depois presos só-TJ.
     */
    @Get('presos/agregado-ordenado')
    async listaPresosAgregadoOrdenado(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ) {
        const { sheetRows, presos, siapFiltered } =
            await this.carregarDadosPresosAgregado(
                spreadsheetId,
                gid,
                sheetName,
                skipRows,
            );
        const lista = this.montarListaAgregado(
            sheetRows,
            presos,
            siapFiltered,
        );
        const ordenado = this.ordenarAgregadoPrioridadeCruzamento(lista);
        return ordenado.slice(0, 500);
    }

    private async carregarDadosPresosAgregado(
        spreadsheetId: string | undefined,
        gid: string | undefined,
        sheetName: string | undefined,
        skipRows: string | undefined,
    ): Promise<{
        sheetRows: Record<string, any>[];
        presos: Awaited<ReturnType<PresosService['findAll']>>;
        siapFiltered: any[];
    }> {
        const id =
            spreadsheetId || '1y6wcoYFR9yeGZse4Nwg2NPtgE3kSDy0aI9iBtqIkvXE';
        const skip = skipRows ? parseInt(skipRows, 10) : 2;

        const sheetPromise = sheetName
            ? this.googleSheetsService.getSheetData(id, sheetName, skip)
            : this.googleSheetsService.getSheetDataByGid(
                  id,
                  gid ? parseInt(gid, 10) : 427685216,
                  skip,
              );

        const [sheetRows, presos, siapResponse] = await Promise.all([
            sheetPromise,
            this.presosService.findAll(),
            this.siapService.listagemAllUnidadesAllInternos(),
        ]);

        const siapFiltered = this.filtrarSiapParaAgregado(siapResponse);

        return { sheetRows, presos, siapFiltered };
    }

    /**
     * Cruzamento TJ (presos) x sheet x SIAP.
     * Retorna até 200 itens:
     * 1) triplos com match em TJ + sheet + SIAP
     * 2) se acabar, retorna "só sheet" (sheet sem match TJ/SIAP)
     * 3) se ainda faltar, retorna "só preso" (preso sem match em nenhuma linha do sheet)
     * 4) se ainda faltar, retorna "só siap" (SIAP sem match em nenhuma linha do sheet)
     */
    @Get('presos/sheet-siap-cruzado')
    async listaPresosSheetSiapCruzado(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ): Promise<PresoSheetItem[]> {
        const id =
            spreadsheetId || '1y6wcoYFR9yeGZse4Nwg2NPtgE3kSDy0aI9iBtqIkvXE';
        const skip = skipRows ? parseInt(skipRows, 10) : 2;

        const sheetRows = sheetName
            ? await this.googleSheetsService.getSheetData(id, sheetName, skip)
            : await this.googleSheetsService.getSheetDataByGid(
                  id,
                  gid ? parseInt(gid, 10) : 427685216,
                  skip,
              );

        const [presos, siapResponse] = await Promise.all([
            this.presosService.findAll(),
            this.siapService.listagemAllUnidadesAllInternos(),
        ]);

        const siapFiltered = this.filtrarSiapParaAgregado(siapResponse);

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const normalizeDigits = (value?: string | null) => {
            if (!value) return '';
            return value.toString().replace(/\D+/g, '');
        };

        const isEmptyOrNaoCadastrado = (value?: string | null) => {
            if (!value) return true;
            const v = value.toString().trim().toUpperCase();
            return v === '' || v.includes('NAO CADASTRADO');
        };

        const presoChaveUnica = (preso: Preso) => {
            const n = normalizeText(preso.identificacao_acusado);
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const m = normalizeText(preso.nomedamae);
            return `${n}|${cpf}|${rg}|${m}`;
        };

        const siapChaveUnica = (siap: any) => {
            const nome = normalizeText(
                siap.nomeInterno ||
                    siap.NOME_INTERNO ||
                    siap.nome ||
                    siap.NOME ||
                    siap.nome_preso ||
                    siap.NOME_PRESO,
            );
            const rg = normalizeDigits(
                siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
            );
            const cpf = normalizeDigits(
                siap.cpf || siap.CPF || siap.cpfInterno || siap.CPF_INTERNO,
            );
            const mae = normalizeText(
                siap.nomeMae ||
                    siap.NOME_MAE ||
                    siap.nome_mae ||
                    siap.NOME_DA_MAE ||
                    siap.nomedamae,
            );
            return `${nome}|${cpf}|${rg}|${mae}`;
        };

        // Index TJ (presos)
        const presoByCpf = new Map<string, Preso>();
        const presoByRg = new Map<string, Preso>();
        const presoByNome = new Map<string, Array<{ preso: Preso; mae: string }>>();

        for (const preso of presos) {
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const nome = normalizeText(preso.identificacao_acusado);
            const mae = normalizeText(preso.nomedamae);

            if (cpf && !presoByCpf.has(cpf)) presoByCpf.set(cpf, preso);
            if (rg && !presoByRg.has(rg)) presoByRg.set(rg, preso);

            if (nome) {
                const arr = presoByNome.get(nome) || [];
                arr.push({ preso, mae });
                presoByNome.set(nome, arr);
            }
        }

        const matchPreso = (
            sheetNome: string,
            sheetRg: string,
            sheetCpf: string,
            sheetFiliacao: string,
        ): Preso | null => {
            if (sheetCpf && presoByCpf.has(sheetCpf)) return presoByCpf.get(sheetCpf) ?? null;
            if (sheetRg && presoByRg.has(sheetRg)) return presoByRg.get(sheetRg) ?? null;

            const candidatos = sheetNome ? presoByNome.get(sheetNome) || [] : [];
            for (const c of candidatos) {
                if (!c.mae) continue;
                if (
                    sheetFiliacao &&
                    (sheetFiliacao.includes(c.mae) || c.mae.includes(sheetFiliacao))
                ) {
                    return c.preso;
                }
            }
            return null;
        };

        // Index SIAP
        const siapByCpf = new Map<string, any>();
        const siapByRg = new Map<string, any>();
        const siapByNome = new Map<string, Array<{ siap: any; mae: string }>>();

        for (const siap of siapFiltered || []) {
            const nome = normalizeText(
                siap.nomeInterno ||
                    siap.NOME_INTERNO ||
                    siap.nome ||
                    siap.NOME ||
                    siap.nome_preso ||
                    siap.NOME_PRESO,
            );
            const rg = normalizeDigits(
                siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
            );
            const cpf = normalizeDigits(
                siap.cpf || siap.CPF || siap.cpfInterno || siap.CPF_INTERNO,
            );
            const mae = normalizeText(
                siap.nomeMae ||
                    siap.NOME_MAE ||
                    siap.nome_mae ||
                    siap.NOME_DA_MAE ||
                    siap.nomedamae,
            );

            if (cpf && !siapByCpf.has(cpf)) siapByCpf.set(cpf, siap);
            if (rg && !siapByRg.has(rg)) siapByRg.set(rg, siap);

            if (nome) {
                const arr = siapByNome.get(nome) || [];
                arr.push({ siap, mae });
                siapByNome.set(nome, arr);
            }
        }

        const matchSiap = (
            sheetNome: string,
            sheetRg: string,
            sheetCpf: string,
            sheetFiliacao: string,
        ): any | null => {
            if (sheetCpf && siapByCpf.has(sheetCpf)) return siapByCpf.get(sheetCpf) ?? null;
            if (sheetRg && siapByRg.has(sheetRg)) return siapByRg.get(sheetRg) ?? null;

            const candidatos = sheetNome ? siapByNome.get(sheetNome) || [] : [];
            for (const c of candidatos) {
                if (!c.mae) continue;
                if (
                    sheetFiliacao &&
                    (sheetFiliacao.includes(c.mae) || c.mae.includes(sheetFiliacao))
                ) {
                    return c.siap ?? null;
                }
            }
            return null;
        };

        const itensDeSheet: PresoSheetItem[] = [];

        const presosMatchedAnySheet = new Set<string>();
        const siapMatchedAnySheet = new Set<string>();

        // Gera itens para CADA linha do sheet (mesmo que seja parcial).
        for (let i = 0; i < sheetRows.length; i++) {
            const sheetRow = sheetRows[i];
            const sheetNome = normalizeText(
                sheetRow['nome_do_a_preso_a_ou_adolescente_apreendido_a'],
            );
            const sheetRg = normalizeDigits(sheetRow['rg_somente_numeros']);
            const sheetCpf = normalizeDigits(sheetRow['cpf_somente_numeros']);
            const sheetFiliacao = normalizeText(sheetRow['filiacao']);

            const preso = matchPreso(sheetNome, sheetRg, sheetCpf, sheetFiliacao);
            const siap = matchSiap(sheetNome, sheetRg, sheetCpf, sheetFiliacao);

            if (preso) presosMatchedAnySheet.add(presoChaveUnica(preso));
            if (siap) siapMatchedAnySheet.add(siapChaveUnica(siap));

            itensDeSheet.push({
                preso: preso || null,
                sheet: sheetRow,
                siap: siap || null,
            });
        }

        // Presos que NUNCA apareceram no sheet (sheet: null).
        // Se houver match no SIAP, devolvemos também (preso + siap).
        const itensSoPresoTj: PresoSheetItem[] = [];
        const siapMatchedAnyOrphanPreso = new Set<string>();

        for (let idx = 0; idx < presos.length; idx++) {
            const preso = presos[idx];
            const chave = presoChaveUnica(preso);
            if (presosMatchedAnySheet.has(chave)) continue;

            const presoNome = normalizeText(preso.identificacao_acusado);
            const presoRg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const presoCpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const presoMae = normalizeText(preso.nomedamae);

            const siap = matchSiap(presoNome, presoRg, presoCpf, presoMae);

            if (siap) siapMatchedAnyOrphanPreso.add(siapChaveUnica(siap));

            itensSoPresoTj.push({
                preso,
                sheet: null,
                siap: siap || null,
            });
        }

        // SIAP que NUNCA apareceram no sheet e não casaram com presos órfãos.
        const itensSoSiap: PresoSheetItem[] = [];
        for (const siap of siapFiltered || []) {
            const chave = siapChaveUnica(siap);
            if (siapMatchedAnySheet.has(chave)) continue;
            if (siapMatchedAnyOrphanPreso.has(chave)) continue;
            itensSoSiap.push({ preso: null, sheet: null, siap });
        }

        const scoreItem = (it: PresoSheetItem) => {
            let score = 0;
            if (it.preso != null) score += 1;
            if (it.sheet != null) score += 1;
            if (it.siap != null) score += 1;
            return score;
        };

        const resultadoOrdenado = [
            ...itensDeSheet.map((it, ordem) => ({
                it,
                score: scoreItem(it),
                ordemOriginal: ordem,
            })),
            ...itensSoPresoTj.map((it, idx) => ({
                it,
                score: scoreItem(it),
                ordemOriginal: sheetRows.length + idx,
            })),
            ...itensSoSiap.map((it, idx) => ({
                it,
                score: scoreItem(it),
                ordemOriginal: sheetRows.length + itensSoPresoTj.length + idx,
            })),
        ]
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.ordemOriginal - b.ordemOriginal;
            })
            .map((x) => x.it);

        return resultadoOrdenado.slice(0, 200);
    }

    /**
     * Cruzamento entre `/usuarios/presos`, sheet, SIAP e interno-tjm/merged.
     * Mantém os mesmos parâmetros de sheet/sIAP cruzado e prioriza itens mais completos.
     */
    @Get('presos/sheet-siap-interno-merged')
    async listaPresosSheetSiapInternoMerged(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ): Promise<PresoSheetSiapInternoMergedItem[]> {
        const [baseCruzado, internoMerged] = await Promise.all([
            this.listaPresosSheetSiapCruzado(
                spreadsheetId,
                gid,
                sheetName,
                skipRows,
            ),
            this.internoTjmMergeService.findCommonByCpf(),
        ]);

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const extractNome = (item: PresoSheetItem): string => {
            const presoNome = normalizeText(item.preso?.identificacao_acusado);
            if (presoNome) return presoNome;

            const sheetNome = normalizeText(
                item.sheet?.['nome_do_a_preso_a_ou_adolescente_apreendido_a'],
            );
            if (sheetNome) return sheetNome;

            const siap = item.siap as any;
            return normalizeText(
                siap?.nomeInterno ||
                    siap?.NOME_INTERNO ||
                    siap?.nome ||
                    siap?.NOME ||
                    siap?.nome_preso ||
                    siap?.NOME_PRESO,
            );
        };

        const extractParents = (item: PresoSheetItem): string[] => {
            const siap = item.siap as any;
            const values = [
                normalizeText(item.preso?.nomedamae),
                normalizeText(item.sheet?.['filiacao']),
                normalizeText(
                    siap?.nomeMae ||
                        siap?.NOME_MAE ||
                        siap?.nome_mae ||
                        siap?.NOME_DA_MAE ||
                        siap?.nomedamae,
                ),
                normalizeText(
                    siap?.nomePai ||
                        siap?.NOME_PAI ||
                        siap?.nome_pai ||
                        siap?.NOME_DO_PAI ||
                        siap?.nomepai,
                ),
            ];
            return values.filter((v) => !!v);
        };

        const mergedByName = new Map<string, any[]>();
        for (const mergedItem of Array.isArray(internoMerged) ? internoMerged : []) {
            const key = normalizeText(mergedItem?.name);
            if (!key) continue;
            const arr = mergedByName.get(key) || [];
            arr.push(mergedItem);
            mergedByName.set(key, arr);
        }

        const pickMergedForItem = (item: PresoSheetItem): unknown | null => {
            const nome = extractNome(item);
            if (!nome) return null;

            const candidates = mergedByName.get(nome) || [];
            if (!candidates.length) return null;

            const parents = extractParents(item);
            for (const candidate of candidates) {
                const parentValue = normalizeText(candidate?.parentValue);
                if (!parentValue) continue;
                if (parents.some((p) => p.includes(parentValue) || parentValue.includes(p))) {
                    return candidate;
                }
            }

            return candidates[0] ?? null;
        };

        const scoreItem = (it: PresoSheetSiapInternoMergedItem) => {
            let score = 0;
            if (it.preso != null) score += 1;
            if (it.sheet != null) score += 1;
            if (it.siap != null) score += 1;
            if (it.interno_tjm_merged != null) score += 1;
            return score;
        };

        const resultado = baseCruzado
            .map((item, ordemOriginal) => ({
                item: {
                    ...item,
                    interno_tjm_merged: pickMergedForItem(item),
                } as PresoSheetSiapInternoMergedItem,
                ordemOriginal,
            }))
            .sort((a, b) => {
                const sa = scoreItem(a.item);
                const sb = scoreItem(b.item);
                if (sb !== sa) return sb - sa;
                return a.ordemOriginal - b.ordemOriginal;
            })
            .map((x) => x.item);

        return resultado.slice(0, 200);
    }

    /**
     * Variação do cruzamento completo:
     * em `interno_tjm_merged`, retorna somente `matches[source="ipat"].row`.
     */
    @Get('presos/sheet-siap-interno-merged-ipat-row')
    async listaPresosSheetSiapInternoMergedIpatRow(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ): Promise<PresoSheetSiapInternoMergedItem[]> {
        const base = await this.listaPresosSheetSiapInternoMerged(
            spreadsheetId,
            gid,
            sheetName,
            skipRows,
        );

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const getIpatRow = (merged: any): unknown | null => {
            const matches = Array.isArray(merged?.matches) ? merged.matches : [];
            for (const m of matches) {
                if (normalizeText(m?.source) === 'IPAT') {
                    return m?.row ?? null;
                }
            }
            return null;
        };

        const scoreItem = (it: PresoSheetSiapInternoMergedItem) => {
            let score = 0;
            if (it.preso != null) score += 1;
            if (it.sheet != null) score += 1;
            if (it.siap != null) score += 1;
            if (it.interno_tjm_merged != null) score += 1;
            return score;
        };

        const resultado = base
            .map((item, ordemOriginal) => ({
                item: {
                    ...item,
                    interno_tjm_merged: getIpatRow(item.interno_tjm_merged as any),
                } as PresoSheetSiapInternoMergedItem,
                ordemOriginal,
            }))
            .sort((a, b) => {
                const sa = scoreItem(a.item);
                const sb = scoreItem(b.item);
                if (sb !== sa) return sb - sa;
                return a.ordemOriginal - b.ordemOriginal;
            })
            .map((x) => x.item);

        return resultado.slice(0, 200);
    }

    /**
     * Cruzamento preso x SIAP x interno-tjm/merged (somente row ipat).
     * Sem Google Sheets.
     */
    @Get('presos/siap-interno-merged-ipat-row')
    async listaPresosSiapInternoMergedIpatRow(): Promise<PresoSiapInternoMergedItem[]> {
        const [presos, siapResponse, internoMerged] = await Promise.all([
            this.presosService.findAll(),
            this.siapService.listagemAllUnidadesAllInternos(),
            this.internoTjmMergeService.findCommonByCpf(),
        ]);

        const siapFiltered = this.filtrarSiapParaAgregado(siapResponse);

        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const normalizeDigits = (value?: string | null) => {
            if (!value) return '';
            return value.toString().replace(/\D+/g, '');
        };

        const isEmptyOrNaoCadastrado = (value?: string | null) => {
            if (!value) return true;
            const v = value.toString().trim().toUpperCase();
            return v === '' || v.includes('NAO CADASTRADO');
        };

        // Index SIAP
        const siapByCpf = new Map<string, any>();
        const siapByRg = new Map<string, any>();
        const siapByNome = new Map<string, Array<{ siap: any; mae: string }>>();

        for (const siap of siapFiltered || []) {
            const nome = normalizeText(
                siap.nomeInterno ||
                    siap.NOME_INTERNO ||
                    siap.nome ||
                    siap.NOME ||
                    siap.nome_preso ||
                    siap.NOME_PRESO,
            );
            const rg = normalizeDigits(
                siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
            );
            const cpf = normalizeDigits(
                siap.cpf || siap.CPF || siap.cpfInterno || siap.CPF_INTERNO,
            );
            const mae = normalizeText(
                siap.nomeMae ||
                    siap.NOME_MAE ||
                    siap.nome_mae ||
                    siap.NOME_DA_MAE ||
                    siap.nomedamae,
            );

            if (cpf && !siapByCpf.has(cpf)) siapByCpf.set(cpf, siap);
            if (rg && !siapByRg.has(rg)) siapByRg.set(rg, siap);
            if (nome) {
                const arr = siapByNome.get(nome) || [];
                arr.push({ siap, mae });
                siapByNome.set(nome, arr);
            }
        }

        const matchSiapForPreso = (preso: Preso): any | null => {
            const presoNome = normalizeText(preso.identificacao_acusado);
            const presoRg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const presoCpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const presoMae = normalizeText(preso.nomedamae);

            if (presoCpf && siapByCpf.has(presoCpf)) return siapByCpf.get(presoCpf) ?? null;
            if (presoRg && siapByRg.has(presoRg)) return siapByRg.get(presoRg) ?? null;

            if (!presoMae) return null;
            const candidatos = siapByNome.get(presoNome) || [];
            for (const c of candidatos) {
                if (!c.mae) continue;
                if (presoMae.includes(c.mae) || c.mae.includes(presoMae)) {
                    return c.siap ?? null;
                }
            }
            return null;
        };

        // Index interno-tjm/merged por nome
        const mergedByName = new Map<string, any[]>();
        for (const mergedItem of Array.isArray(internoMerged) ? internoMerged : []) {
            const key = normalizeText(mergedItem?.name);
            if (!key) continue;
            const arr = mergedByName.get(key) || [];
            arr.push(mergedItem);
            mergedByName.set(key, arr);
        }

        const getIpatRow = (merged: any): unknown | null => {
            const matches = Array.isArray(merged?.matches) ? merged.matches : [];
            for (const m of matches) {
                if (normalizeText(m?.source) === 'IPAT') {
                    return m?.row ?? null;
                }
            }
            return null;
        };

        const pickMergedIpatForPreso = (preso: Preso): unknown | null => {
            const presoNome = normalizeText(preso.identificacao_acusado);
            if (!presoNome) return null;

            const candidates = mergedByName.get(presoNome) || [];
            if (!candidates.length) return null;

            const presoMae = normalizeText(preso.nomedamae);
            for (const candidate of candidates) {
                const parentValue = normalizeText(candidate?.parentValue);
                if (!parentValue) continue;
                if (presoMae && (presoMae.includes(parentValue) || parentValue.includes(presoMae))) {
                    return getIpatRow(candidate);
                }
            }

            return getIpatRow(candidates[0]);
        };

        const scoreItem = (it: PresoSiapInternoMergedItem) => {
            let score = 0;
            if (it.preso != null) score += 1;
            if (it.siap != null) score += 1;
            if (it.interno_tjm_merged != null) score += 1;
            return score;
        };

        const resultado = presos
            .map((preso, ordemOriginal) => ({
                item: {
                    preso,
                    siap: matchSiapForPreso(preso),
                    interno_tjm_merged: pickMergedIpatForPreso(preso),
                } as PresoSiapInternoMergedItem,
                ordemOriginal,
            }))
            .sort((a, b) => {
                const sa = scoreItem(a.item);
                const sb = scoreItem(b.item);
                if (sb !== sa) return sb - sa;
                return a.ordemOriginal - b.ordemOriginal;
            })
            .map((x) => x.item);

        return resultado.slice(0, 200);
    }

    private filtrarSiapParaAgregado(siapResponse: {
        items?: unknown;
    }): any[] {
        const allowedSiglas = [
            'CAM-AM',
            'CDF-AM',
            'CIAPA-AM',
            'COMPAJ/RF-AM',
            'UPI/M-AM',
            'UPI-AM',
        ];

        const siapItems: any[] = Array.isArray(siapResponse?.items)
            ? (siapResponse.items as any[])
            : [];

        return siapItems.filter((item: any) => {
            const sigla =
                item._siglaUnidade ||
                item.siglaUnidade ||
                item.SIGLA_UNIDADE ||
                item.SiglaUnidade ||
                item.sigla ||
                item.SIGLA ||
                item.sigla_unidade ||
                item.SIGLAUNIDADE;
            return !!sigla && allowedSiglas.includes(sigla);
        });
    }

    private montarListaAgregado(
        sheetRows: Record<string, any>[],
        presos: Awaited<ReturnType<PresosService['findAll']>>,
        siapFiltered: any[],
    ): AgregadoPresoItem[] {
        const normalizeText = (value?: string | null) => {
            if (!value) return '';
            return value
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        };

        const normalizeDigits = (value?: string | null) => {
            if (!value) return '';
            return value.toString().replace(/\D+/g, '');
        };

        const isEmptyOrNaoCadastrado = (value?: string | null) => {
            if (!value) return true;
            const v = value.toString().trim().toUpperCase();
            return v === '' || v.includes('NAO CADASTRADO');
        };

        const presoChaveUnica = (preso: Preso) => {
            const n = normalizeText(preso.identificacao_acusado);
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const m = normalizeText(preso.nomedamae);
            return `${n}|${cpf}|${rg}|${m}`;
        };

        // -----------------------
        // Índices TJ (presos)
        // -----------------------
        const presoByCpf = new Map<string, Preso>();
        const presoByRg = new Map<string, Preso>();
        const presoByNome = new Map<string, Array<{ preso: Preso; mae: string }>>();

        for (const preso of presos) {
            const cpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const rg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const nome = normalizeText(preso.identificacao_acusado);
            const mae = normalizeText(preso.nomedamae);

            if (cpf && !presoByCpf.has(cpf)) presoByCpf.set(cpf, preso);
            if (rg && !presoByRg.has(rg)) presoByRg.set(rg, preso);

            if (nome) {
                const arr = presoByNome.get(nome) || [];
                arr.push({ preso, mae });
                presoByNome.set(nome, arr);
            }
        }

        const matchPreso = (
            sheetNome: string,
            sheetRg: string,
            sheetCpf: string,
            sheetFiliacao: string,
        ): Preso | null => {
            if (sheetCpf && presoByCpf.has(sheetCpf)) {
                return presoByCpf.get(sheetCpf) ?? null;
            }
            if (sheetRg && presoByRg.has(sheetRg)) {
                return presoByRg.get(sheetRg) ?? null;
            }

            const candidatos = sheetNome ? presoByNome.get(sheetNome) || [] : [];
            if (!candidatos.length) return null;

            for (const c of candidatos) {
                if (!sheetFiliacao || !c.mae) continue;
                if (sheetFiliacao.includes(c.mae)) return c.preso;
            }
            return null;
        };

        // -----------------------
        // Índices SIAP
        // -----------------------
        const siapByCpf = new Map<string, any>();
        const siapByRg = new Map<string, any>();
        const siapByNome = new Map<string, Array<{ siap: any; mae: string }>>();

        for (const siap of siapFiltered || []) {
            const nome = normalizeText(
                siap.nomeInterno ||
                    siap.NOME_INTERNO ||
                    siap.nome ||
                    siap.NOME ||
                    siap.nome_preso ||
                    siap.NOME_PRESO,
            );
            const rg = normalizeDigits(
                siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
            );
            const cpf = normalizeDigits(
                siap.cpf ||
                    siap.CPF ||
                    siap.cpfInterno ||
                    siap.CPF_INTERNO,
            );
            const mae = normalizeText(
                siap.nomeMae ||
                    siap.NOME_MAE ||
                    siap.nome_mae ||
                    siap.NOME_DA_MAE ||
                    siap.nomedamae,
            );

            if (cpf && !siapByCpf.has(cpf)) siapByCpf.set(cpf, siap);
            if (rg && !siapByRg.has(rg)) siapByRg.set(rg, siap);

            if (nome) {
                const arr = siapByNome.get(nome) || [];
                arr.push({ siap, mae });
                siapByNome.set(nome, arr);
            }
        }

        const matchSiap = (
            sheetNome: string,
            sheetRg: string,
            sheetCpf: string,
            sheetMae: string,
        ): any | null => {
            if (sheetCpf && siapByCpf.has(sheetCpf)) {
                return siapByCpf.get(sheetCpf) ?? null;
            }
            if (sheetRg && siapByRg.has(sheetRg)) {
                return siapByRg.get(sheetRg) ?? null;
            }

            const candidatos = sheetNome ? siapByNome.get(sheetNome) || [] : [];
            if (!candidatos.length) return null;

            for (const c of candidatos) {
                if (!sheetMae || !c.mae) continue;
                if (sheetMae.includes(c.mae) || c.mae.includes(sheetMae)) {
                    return c.siap ?? null;
                }
            }

            return null;
        };

        const presosJaCruzadosComPlanilha = new Set<string>();

        const itensPlanilha: AgregadoPresoItem[] = sheetRows.map((sheetRow) => {
            const sheetNome = normalizeText(
                sheetRow['nome_do_a_preso_a_ou_adolescente_apreendido_a'],
            );
            const sheetRg = normalizeDigits(sheetRow['rg_somente_numeros']);
            const sheetCpf = normalizeDigits(sheetRow['cpf_somente_numeros']);
            const sheetFiliacao = normalizeText(sheetRow['filiacao']);

            const match = matchPreso(sheetNome, sheetRg, sheetCpf, sheetFiliacao);
            if (match) presosJaCruzadosComPlanilha.add(presoChaveUnica(match));

            const siap = matchSiap(sheetNome, sheetRg, sheetCpf, sheetFiliacao);

            return {
                preso: match || null,
                sheet: sheetRow,
                siap,
            };
        });

        const chavesOrfaosJaEmitidas = new Set<string>();
        const itensSoPresoTj: AgregadoPresoItem[] = [];
        for (const preso of presos) {
            const chave = presoChaveUnica(preso);
            if (presosJaCruzadosComPlanilha.has(chave)) continue;
            if (chavesOrfaosJaEmitidas.has(chave)) continue;
            chavesOrfaosJaEmitidas.add(chave);

            const presoNome = normalizeText(preso.identificacao_acusado);
            const presoRg = isEmptyOrNaoCadastrado(preso.rg)
                ? ''
                : normalizeDigits(preso.rg);
            const presoCpf = isEmptyOrNaoCadastrado(preso.cpf)
                ? ''
                : normalizeDigits(preso.cpf);
            const presoMae = normalizeText(preso.nomedamae);

            const siap = matchSiap(presoNome, presoRg, presoCpf, presoMae);

            itensSoPresoTj.push({
                preso,
                sheet: null,
                siap,
            });
        }

        return [...itensPlanilha, ...itensSoPresoTj];
    }

    /**
     * Prioridade à referência TJ (preso). 3 = preso+SIAP; 2 = só preso; 1 = só SIAP; 0 = nenhum.
     */
    private agregadoMatchScore(item: AgregadoPresoItem): number {
        const p = item.preso != null;
        const s = item.siap != null;
        if (p && s) return 3;
        if (p) return 2;
        if (s) return 1;
        return 0;
    }

    private ordenarAgregadoPrioridadeCruzamento(
        aggregated: AgregadoPresoItem[],
    ): AgregadoPresoItem[] {
        // Particiona sem sort (O(n)), preservando ordem original dentro de cada grupo.
        const score3: AgregadoPresoItem[] = [];
        const score2: AgregadoPresoItem[] = [];
        const score1: AgregadoPresoItem[] = [];
        const score0: AgregadoPresoItem[] = [];

        for (const item of aggregated) {
            const s = this.agregadoMatchScore(item);
            if (s === 3) score3.push(item);
            else if (s === 2) score2.push(item);
            else if (s === 1) score1.push(item);
            else score0.push(item);
        }

        return [...score3, ...score2, ...score1, ...score0];
    }

    /* @Get('presos/:id')
    async obterPreso(@Param('id') id: number) {
        return this.presosService.findById(id);
    } */

    @Get('interno-tjm')
    async listaInternoTjm() {
        return this.internoTjmService.findAll();
    }

    /* @Get('interno-tjm/:id')
    async obterInternoTjm(@Param('id') id: number) {
        return this.internoTjmService.findById(id);
    } */

    @Get('interno-tjm-ipat')
    async listaInternoTjmIpat() {
        return this.internoTjmIpatService.findAll();
    }

    /* @Get('interno-tjm-ipat/:id')
    async obterInternoTjmIpat(@Param('id') id: number) {
        return this.internoTjmIpatService.findById(id);
    } */

    @Get('interno-tjm-upp')
    async listaInternoTjmUpp() {
        return this.internoTjmUppService.findAll();
    }

    /* @Get('interno-tjm-upp/:id')
    async obterInternoTjmUpp(@Param('id') id: number) {
        return this.internoTjmUppService.findById(id);
    } */

    @Get('interno-tjm-sgpcdpm2')
    async listaInternoTjmSgpcdpm2() {
        return this.internoTjmSgpcdpm2Service.findAll();
    }

    /* @Get('interno-tjm-sgpcdpm2/:id')
    async obterInternoTjmSgpcdpm2(@Param('id') id: number) {
        return this.internoTjmSgpcdpm2Service.findById(id);
    } */

    /*@delete()
    async deletarUsuario(@Body() dadosUsuario){
        this.usuarioRepository.deletar(dadosUsuario)
        return dadosUsuario;
    }*/

    @Get('interno-tjm/merged')
    async listaInternoTjmMerged() {
        return this.internoTjmMergeService.findCommonByCpf();
    }

    @Get('siap/unidades')
    async getSiapUnidades() {
        return this.siapService.getUnidades();
    }

    @Get('siap/siglas')
    async getSiapSiglas() {
        return this.siapService.listSiglasUnidades();
    }

    @Get('siap/listagem')
    async getSiapListagem(@Query('nomeInterno') nomeInterno?: string) {
        if (typeof nomeInterno === 'undefined' || nomeInterno === null || nomeInterno === '') {
            return this.siapService.listagemAllUnidadesAllInternos();
        }
        const nome = nomeInterno || 'A';
        return this.siapService.listagemForAllUnidades(nome);
    }

    @Get('siap/listagem/all')
    async getSiapListagemTodasUnidades() {
        return this.siapService.listagemAllUnidadesAllInternos();
    }

    @Get('listagem')
    async getListagemAll(@Query('nomeInterno') nomeInterno?: string) {
        const nome = nomeInterno || 'A';
        return this.siapService.listagemForAllUnidades(nome);
    }

    // keep existing POST for compatibility
    @Post('siap/listagem')
    async postSiapListagem(@Body() filtro: any) {
        return this.siapService.listagemFichaInternos(filtro || {});
    }
}