import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternoTjmViewSgpcdpm2 } from './interno-tjm-sgpcdpm2.entity';

@Injectable()
export class InternoTjmSgpcdpm2Service {
  constructor(
    @InjectRepository(InternoTjmViewSgpcdpm2, 'mysql-sgpcdpm2')
    private internoTjmRepository: Repository<InternoTjmViewSgpcdpm2>,
  ) {}

  async findAll(): Promise<InternoTjmViewSgpcdpm2[]> {
    return this.internoTjmRepository.find();
  }

  async findById(id: number): Promise<InternoTjmViewSgpcdpm2 | null> {
    return this.internoTjmRepository.findOne({ where: { id } });
  }
}
