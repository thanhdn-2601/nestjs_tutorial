import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/postgres-errors';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Follow } from './follow.entity';
import {
  ProfileResponse,
  UserWithFollowingRaw,
} from './profile-response.interface';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getProfile(
    username: string,
    currentUserId?: number,
  ): Promise<ProfileResponse> {
    const { entities, raw } = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(
        'follows',
        'follow',
        'follow."followerId" = :currentUserId AND follow."followeeId" = user.id',
        { currentUserId: currentUserId ?? null },
      )
      .addSelect('follow.id IS NOT NULL', 'following')
      .where('user.username = :username', { username })
      .getRawAndEntities<UserWithFollowingRaw>();

    const user = entities[0];
    if (!user) {
      throw new NotFoundException({
        errors: { username: [this.i18n.t('auth.user_not_found')] },
      });
    }

    return this.buildProfileResponse(user, Boolean(raw[0].following));
  }

  async follow(
    currentUserId: number,
    username: string,
  ): Promise<ProfileResponse> {
    const user = await this.findUserOrFail(username);
    if (user.id === currentUserId) {
      throw new UnprocessableEntityException({
        errors: { username: [this.i18n.t('auth.cannot_follow_self')] },
      });
    }

    try {
      await this.followsRepository.insert({
        followerId: currentUserId,
        followeeId: user.id,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.buildProfileResponse(user, true);
  }

  async unfollow(
    currentUserId: number,
    username: string,
  ): Promise<ProfileResponse> {
    const user = await this.findUserOrFail(username);
    await this.followsRepository.delete({
      followerId: currentUserId,
      followeeId: user.id,
    });
    return this.buildProfileResponse(user, false);
  }

  private async findUserOrFail(username: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException({
        errors: { username: [this.i18n.t('auth.user_not_found')] },
      });
    }
    return user;
  }

  async getUsersWithFollowing(
    userIds: number[],
    currentUserId?: number,
  ): Promise<Map<number, { user: User; following: boolean }>> {
    if (!userIds.length) return new Map();

    const { entities, raw } = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.bio', 'user.image'])
      .leftJoin(
        'follows',
        'follow',
        'follow."followerId" = :currentUserId AND follow."followeeId" = user.id',
        { currentUserId: currentUserId ?? null },
      )
      .addSelect('follow.id IS NOT NULL', 'following')
      .where('user.id IN (:...userIds)', { userIds })
      .getRawAndEntities<UserWithFollowingRaw>();

    const result = new Map<number, { user: User; following: boolean }>();
    entities.forEach((user, index) => {
      result.set(user.id, { user, following: Boolean(raw[index].following) });
    });
    return result;
  }

  private buildProfileResponse(
    user: User,
    following: boolean,
  ): ProfileResponse {
    return {
      profile: {
        username: user.username,
        bio: user.bio,
        image: user.image,
        following,
      },
    };
  }
}
