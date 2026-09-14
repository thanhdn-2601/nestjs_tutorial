export interface CommentDto {
  id: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  author: {
    username: string;
    bio: string;
    image: string | null;
    following: boolean;
  };
}

export interface CommentResponse {
  comment: CommentDto;
}

export interface CommentsResponse {
  comments: CommentDto[];
}
