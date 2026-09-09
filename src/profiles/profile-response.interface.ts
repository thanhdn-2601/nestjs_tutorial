export interface ProfileResponse {
  profile: {
    username: string;
    bio: string;
    image: string | null;
    following: boolean;
  };
}

export interface UserWithFollowingRaw {
  following: boolean;
}
