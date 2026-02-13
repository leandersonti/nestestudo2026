import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternoTjmViewIpat } from './interno-tjm-ipat.entity';

@Injectable()
export class InternoTjmIpatService {
  constructor(
    @InjectRepository(InternoTjmViewIpat, 'mysql-ipat')
    private internoTjmRepository: Repository<InternoTjmViewIpat>,
  ) {}

  async findAll(): Promise<InternoTjmViewIpat[]> {
    return this.internoTjmRepository.find();
  }

  /* async findById(id: number): Promise<InternoTjmViewIpat | null> {
    return this.internoTjmRepository.findOne({ where: { id } });
  } */
}
