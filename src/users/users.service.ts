import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findConflicts(
    criteria: { email?: string; username?: string },
    excludeId?: number,
  ): Promise<User[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (criteria.email) {
      conditions.push('user.email = :email');
      params.email = criteria.email.toLowerCase();
    }
    if (criteria.username) {
      conditions.push('user.username = :username');
      params.username = criteria.username;
    }
    if (!conditions.length) return Promise.resolve([]);

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where(conditions.join(' OR '), params);
    if (excludeId !== undefined) {
      qb.andWhere('user.id != :excludeId', { excludeId });
    }
    return qb.getMany();
  }

  async create(data: CreateUserDto): Promise<User> {
    const dto = plainToInstance(CreateUserDto, data);
    const errors = await validate(dto);
    if (errors.length) {
      throw new UnprocessableEntityException(errors);
    }

    const user = this.usersRepository.create({
      ...dto,
      email: dto.email.toLowerCase(),
    });
    return this.usersRepository.save(user);
  }
}
