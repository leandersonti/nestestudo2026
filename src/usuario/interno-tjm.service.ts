import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternoTjmView } from './interno-tjm.entity';

@Injectable()
export class InternoTjmService {
  constructor(
    @InjectRepository(InternoTjmView, 'mysql')
    private internoTjmRepository: Repository<InternoTjmView>,
  ) {}

  async findAll(): Promise<InternoTjmView[]> {
    return this.internoTjmRepository.find();
  }

  /* async findById(id: number): Promise<InternoTjmView | null> {
    return this.internoTjmRepository.findOne({ where: { id } });
  }

  async findByNome(nome: string): Promise<InternoTjmView[]> {
    return this.internoTjmRepository.find({
      where: { nome: { like: `%${nome}%` } },
    });
  } */
}
