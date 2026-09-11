export interface ArticleDto {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: {
    username: string;
    bio: string;
    image: string | null;
    following: boolean;
  };
}

export interface ArticleResponse {
  article: ArticleDto;
}

export interface ArticlesResponse {
  articles: ArticleDto[];
  articlesCount: number;
}
