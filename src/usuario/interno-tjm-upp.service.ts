import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternoTjmViewUpp } from './interno-tjm-upp.entity';

@Injectable()
export class InternoTjmUppService {
  constructor(
    @InjectRepository(InternoTjmViewUpp, 'mysql-upp')
    private internoTjmRepository: Repository<InternoTjmViewUpp>,
  ) {}

  async findAll(): Promise<InternoTjmViewUpp[]> {
    return this.internoTjmRepository.find();
  }

  /* async findById(id: number): Promise<InternoTjmViewUpp | null> {
    return this.internoTjmRepository.findOne({ where: { id } });
  } */
}
