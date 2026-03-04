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

    @Get('presos/agregado')
    async listaPresosAgregado(
        @Query('spreadsheetId') spreadsheetId?: string,
        @Query('gid') gid?: string,
        @Query('sheetName') sheetName?: string,
        @Query('skipRows') skipRows?: string,
    ) {
        const id = spreadsheetId || '1y6wcoYFR9yeGZse4Nwg2NPtgE3kSDy0aI9iBtqIkvXE';
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
      const digits = value.toString().replace(/\D+/g, '');
      return digits;
    };

    const isEmptyOrNaoCadastrado = (value?: string | null) => {
      if (!value) return true;
      const v = value.toString().trim().toUpperCase();
      return v === '' || v.includes('NAO CADASTRADO');
    };

    // Dados do SIAP agregados para todas as siglas relevantes
    const siapResponse = await this.siapService.listagemAllUnidadesAllInternos();
    const allowedSiglas = [
      'CAM-AM',
      'CDF-AM',
      'CIAPA-AM',
      'COMPAJ/RF-AM',
      'UPI/M-AM',
      'UPI-AM',
    ];

    const siapItemsSource: any[] =
      (siapResponse && siapResponse.items) || [];
    const siapItems = Array.isArray(siapItemsSource) ? siapItemsSource : [];

    const siapFiltered = siapItems.filter((item: any) => {
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

    const findSiapMatch = (
      sheetNome: string,
      sheetRg: string,
      sheetCpf: string,
      sheetMae: string,
    ) => {
      const match = siapFiltered.find((siap: any) => {
        const siapNome = normalizeText(
          siap.nomeInterno ||
            siap.NOME_INTERNO ||
            siap.nome ||
            siap.NOME ||
            siap.nome_preso ||
            siap.NOME_PRESO,
        );
        const siapRg = normalizeDigits(
          siap.rg || siap.RG || siap.rgInterno || siap.RG_INTERNO,
        );
        const siapCpf = normalizeDigits(
          siap.cpf || siap.CPF || siap.cpfInterno || siap.CPF_INTERNO,
        );
        const siapMae = normalizeText(
          siap.nomeMae ||
            siap.NOME_MAE ||
            siap.nome_mae ||
            siap.NOME_DA_MAE ||
            siap.nomedamae,
        );

        const sameNome = sheetNome && siapNome && sheetNome === siapNome;
        const sameRg = sheetRg && siapRg && sheetRg === siapRg;
        const sameCpf = sheetCpf && siapCpf && sheetCpf === siapCpf;
        const sameMae =
          sheetMae &&
          siapMae &&
          (sheetMae.includes(siapMae) || siapMae.includes(sheetMae));

        return (sameNome && sameMae) || sameCpf || sameRg;
      });

      return match || null;
    };

    const aggregated = sheetRows.map((sheetRow) => {
      const sheetNome = normalizeText(
        sheetRow['nome_do_a_preso_a_ou_adolescente_apreendido_a'],
      );
      const sheetRg = normalizeDigits(sheetRow['rg_somente_numeros']);
      const sheetCpf = normalizeDigits(sheetRow['cpf_somente_numeros']);
      const sheetFiliacao = normalizeText(sheetRow['filiacao']);

      const match = presos.find((preso) => {
        const presoNome = normalizeText(preso.identificacao_acusado);
        const presoRg = isEmptyOrNaoCadastrado(preso.rg)
          ? ''
          : normalizeDigits(preso.rg);
        const presoCpf = isEmptyOrNaoCadastrado(preso.cpf)
          ? ''
          : normalizeDigits(preso.cpf);
        const presoMae = normalizeText(preso.nomedamae);

        const sameNome = sheetNome && presoNome && sheetNome === presoNome;
        const sameRg = sheetRg && presoRg && sheetRg === presoRg;
        const sameCpf = sheetCpf && presoCpf && sheetCpf === presoCpf;
        const sameMae =
          sheetFiliacao && presoMae && sheetFiliacao.includes(presoMae);

        return (sameNome && sameMae) || sameCpf || sameRg;
      });

      const siap = findSiapMatch(sheetNome, sheetRg, sheetCpf, sheetFiliacao);

      return {
        sheet: sheetRow,
        preso: match || null,
        siap,
      };
    });

    return aggregated;
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