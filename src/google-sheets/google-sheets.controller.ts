import { Controller, Get, Param, Query } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';

@Controller('sheets')
export class GoogleSheetsController {
  private readonly defaultSpreadsheetId =
    '1y6wcoYFR9yeGZse4Nwg2NPtgE3kSDy0aI9iBtqIkvXE';

  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  @Get()
  async getAllData(
    @Query('spreadsheetId') spreadsheetId?: string,
    @Query('skipRows') skipRows?: string,
  ) {
    const id = spreadsheetId || this.defaultSpreadsheetId;
    const skip = skipRows ? parseInt(skipRows, 10) : 2;
    return this.googleSheetsService.getAllSheetsData(id, skip);
  }

  @Get('metadata')
  async getMetadata(@Query('spreadsheetId') spreadsheetId?: string) {
    const id = spreadsheetId || this.defaultSpreadsheetId;
    return this.googleSheetsService.getSheetMetadata(id);
  }

  @Get(':sheetName')
  async getSheetData(
    @Param('sheetName') sheetName: string,
    @Query('spreadsheetId') spreadsheetId?: string,
    @Query('skipRows') skipRows?: string,
  ) {
    const id = spreadsheetId || this.defaultSpreadsheetId;
    const skip = skipRows ? parseInt(skipRows, 10) : 2;
    return this.googleSheetsService.getSheetData(id, sheetName, skip);
  }
}
