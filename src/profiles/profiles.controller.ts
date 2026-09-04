import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../users/user.entity';
import { ProfileResponse, ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @ApiOperation({ summary: "Get a user's profile" })
  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  getProfile(
    @Param('username') username: string,
    @OptionalCurrentUser() currentUser?: User,
  ): Promise<ProfileResponse> {
    return this.profilesService.getProfile(username, currentUser?.id);
  }

  @ApiOperation({ summary: 'Follow a user' })
  @ApiSecurity('token')
  @Post(':username/follow')
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('username') username: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProfileResponse> {
    return this.profilesService.follow(currentUser.id, username);
  }

  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiSecurity('token')
  @Delete(':username/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(
    @Param('username') username: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProfileResponse> {
    return this.profilesService.unfollow(currentUser.id, username);
  }
}
