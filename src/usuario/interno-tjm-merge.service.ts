import { Injectable } from '@nestjs/common';
import { InternoTjmService } from './interno-tjm.service';
import { InternoTjmIpatService } from './interno-tjm-ipat.service';
import { InternoTjmUppService } from './interno-tjm-upp.service';
import { InternoTjmSgpcdpm2Service } from './interno-tjm-sgpcdpm2.service';

@Injectable()
export class InternoTjmMergeService {
  constructor(
    private main: InternoTjmService,
    private ipat: InternoTjmIpatService,
    private upp: InternoTjmUppService,
    private sgpcdpm2: InternoTjmSgpcdpm2Service,
  ) {}

  async findCommonByCpf() {
    const [a, b, c, d] = await Promise.all([
      this.main.findAll(),
      this.ipat.findAll(),
      this.upp.findAll(),
      this.sgpcdpm2.findAll(),
    ]);

    const sources = [
      { name: 'sgp', rows: a },
      { name: 'ipat', rows: b },
      { name: 'upp', rows: c },
      { name: 'sgpcdpm2', rows: d },
    ];

    // match condition: nome AND (mae OR pai)
    const normalize = (v: any) =>
      v === undefined || v === null ? '' : String(v).toLowerCase().trim().replace(/\s+/g, ' ');

    const map = new Map<string, Array<{ source: string; row: any }>>();

    for (const s of sources) {
      const rows: any[] = s.rows || [];
      for (const row of rows) {
        const r: any = row as any;
        const name = normalize(r?.nome ?? r?.Nome ?? r?.name);
        if (!name) continue;

        const mother = normalize(r?.mae ?? r?.Mae ?? r?.mother);
        const father = normalize(r?.pai ?? r?.Pai ?? r?.father);

        // create key for name+mother if mother is present
        if (mother) {
          const key = `name::${name}::mae::${mother}`;
          let bucket = map.get(key);
          if (!bucket) {
            bucket = [];
            map.set(key, bucket);
          }
          bucket.push({ source: s.name, row });
        }

        // create key for name+father if father is present
        if (father) {
          const key = `name::${name}::pai::${father}`;
          let bucket = map.get(key);
          if (!bucket) {
            bucket = [];
            map.set(key, bucket);
          }
          bucket.push({ source: s.name, row });
        }
      }
    }

    // Keep only groups that appear in more than one source
    const result: Array<{
      name: string;
      relation: 'mae' | 'pai';
      parentValue: string;
      matches: Array<{ source: string; row: any }>;
    }> = [];

    for (const [key, matches] of map.entries()) {
      if (matches.length <= 1) continue;
      // parse key: name::{name}::(mae|pai)::parentValue
      const parts = key.split('::');
      // expected parts[0] = 'name', parts[1]=name, parts[2]=relation, parts[3]=parentValue
      if (parts.length >= 4) {
        const name = parts[1];
        const relation = parts[2] === 'mae' ? 'mae' : 'pai';
        const parentValue = parts.slice(3).join('::');
        result.push({ name, relation, parentValue, matches });
      } else {
        // fallback: include as-is
        result.push({ name: key, relation: 'mae', parentValue: '', matches });
      }
    }

    // Optionally sort by number of matches desc
    result.sort((x, y) => y.matches.length - x.matches.length);

    return result;
  }
}
