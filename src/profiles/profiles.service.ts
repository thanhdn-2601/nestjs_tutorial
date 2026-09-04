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

export interface ProfileResponse {
  profile: {
    username: string;
    bio: string;
    image: string | null;
    following: boolean;
  };
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
  ) {}

  async getProfile(
    username: string,
    currentUserId?: number,
  ): Promise<ProfileResponse> {
    const user = await this.findUserOrFail(username);
    const following = await this.isFollowing(currentUserId, user.id);
    return this.buildProfileResponse(user, following);
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

  private async isFollowing(
    followerId: number | undefined,
    followeeId: number,
  ): Promise<boolean> {
    if (!followerId) return false;
    const follow = await this.followsRepository.findOne({
      where: { followerId, followeeId },
    });
    return follow !== null;
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
