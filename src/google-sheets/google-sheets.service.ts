import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets;

  constructor(private configService: ConfigService) {
    this.initializeGoogleSheets();
  }

  private initializeGoogleSheets() {
    const credentials = this.configService.get<string>('GOOGLE_CREDENTIALS');

    if (credentials) {
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      this.logger.log('Google Sheets API initialized with service account');
    } else {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (apiKey) {
        this.sheets = google.sheets({ version: 'v4', auth: apiKey });
        this.logger.log('Google Sheets API initialized with API key');
      } else {
        this.logger.warn(
          'No Google credentials found. Set GOOGLE_CREDENTIALS or GOOGLE_API_KEY in .env',
        );
      }
    }
  }

  async getSheetData(
    spreadsheetId: string,
    range: string,
    skipRows: number = 2,
  ): Promise<Record<string, any>[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= skipRows) {
        return [];
      }

      const headers = rows[skipRows] as string[];
      const data = rows.slice(skipRows + 1).map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header && header.trim()) {
            obj[this.normalizeHeader(header)] = row[index] || null;
          }
        });
        return obj;
      });

      return data;
    } catch (error) {
      this.logger.error(`Error fetching sheet data: ${error.message}`);
      throw error;
    }
  }

  async getSheetMetadata(spreadsheetId: string) {
    if (!this.sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });

      return {
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map((sheet) => ({
          sheetId: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          rowCount: sheet.properties?.gridProperties?.rowCount,
          columnCount: sheet.properties?.gridProperties?.columnCount,
        })),
      };
    } catch (error) {
      this.logger.error(`Error fetching sheet metadata: ${error.message}`);
      throw error;
    }
  }

  async getAllSheetsData(
    spreadsheetId: string,
    skipRows: number = 2,
  ): Promise<Record<string, any>> {
    const metadata = await this.getSheetMetadata(spreadsheetId);
    const result: Record<string, any> = {
      spreadsheetTitle: metadata.title,
      sheets: {},
    };

    for (const sheet of metadata.sheets || []) {
      if (sheet.title) {
        try {
          const data = await this.getSheetData(spreadsheetId, sheet.title, skipRows);
          result.sheets[sheet.title] = data;
        } catch (error) {
          this.logger.warn(`Could not fetch data from sheet: ${sheet.title}`);
          result.sheets[sheet.title] = [];
        }
      }
    }

    return result;
  }

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
