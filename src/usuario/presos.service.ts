import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Preso } from './preso.entity';

@Injectable()
export class PresosService {
  constructor(
    @InjectRepository(Preso, 'postgres')
    private presosRepository: Repository<Preso>,
  ) {}

  async findAll(): Promise<Preso[]> {
    return this.presosRepository.find();
  }

  /* async findById(id: number): Promise<Preso | null> {
    return this.presosRepository.findOne({ where: { id } });
  }

  async findByNome(nome: string): Promise<Preso[]> {
    return this.presosRepository.find({
      where: { nome: Like(`%${nome}%`) },
    });
  } */
}
